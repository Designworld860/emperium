import { Hono } from 'hono'
import { getAuthUser, hashPassword } from '../lib/auth'
import { auditLog } from '../lib/db'

type Bindings = { DB: D1Database }
const customers = new Hono<{ Bindings: Bindings }>()

// List all customers (admin/sub_admin)
customers.get('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = (page - 1) * limit
  const search = c.req.query('search') || ''

  let query = `SELECT c.*, u.unit_no, u.particulars, u.billing_area, u.area_unit FROM customers c 
               JOIN units u ON c.unit_id = u.id WHERE c.is_active = 1`
  const params: any[] = []

  if (search) {
    query += ` AND (c.name LIKE ? OR c.email LIKE ? OR u.unit_no LIKE ? OR c.mobile1 LIKE ?)`
    const s = `%${search}%`
    params.push(s, s, s, s)
  }

  const countQuery = query.replace('SELECT c.*, u.unit_no, u.particulars, u.billing_area, u.area_unit', 'SELECT COUNT(*) as total')
  const total = await c.env.DB.prepare(countQuery).bind(...params).first<any>()

  query += ` ORDER BY CAST(u.unit_no AS INTEGER) LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const result = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ customers: result.results, total: total?.total || 0, page, limit })
})

// Get single customer
customers.get('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const customer = await c.env.DB.prepare(
    `SELECT c.*, u.unit_no, u.particulars, u.billing_area, u.area_unit FROM customers c 
     JOIN units u ON c.unit_id = u.id WHERE c.id = ?`
  ).bind(id).first<any>()

  if (!customer) return c.json({ error: 'Customer not found' }, 404)

  // Get KYC docs
  const kyc = await c.env.DB.prepare(
    `SELECT * FROM kyc_documents WHERE entity_type = 'customer' AND entity_id = ?`
  ).bind(id).all()

  // Get tenant info
  const tenant = await c.env.DB.prepare(
    `SELECT * FROM tenants WHERE customer_id = ? AND is_active = 1`
  ).bind(id).first<any>()

  // Get tenant KYC
  let tenantKyc: any[] = []
  if (tenant) {
    const tk = await c.env.DB.prepare(
      `SELECT * FROM kyc_documents WHERE entity_type = 'tenant' AND entity_id = ?`
    ).bind(tenant.id).all()
    tenantKyc = tk.results as any[]
  }

  // Get complaint history
  const complaints = await c.env.DB.prepare(
    `SELECT comp.*, cc.name as category_name, e.name as assigned_to_name 
     FROM complaints comp
     JOIN complaint_categories cc ON comp.category_id = cc.id
     LEFT JOIN employees e ON comp.assigned_to_employee_id = e.id
     WHERE comp.customer_id = ?
     ORDER BY comp.created_at DESC LIMIT 10`
  ).bind(id).all()

  return c.json({
    customer,
    kyc_documents: kyc.results,
    tenant,
    tenant_kyc: tenantKyc,
    complaints: complaints.results
  })
})

// Add new customer
customers.post('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || !['admin', 'sub_admin'].includes(user.role as string)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const body = await c.req.json()
  const { unit_id, name, email, mobile1, mobile2, address, password } = body

  if (!unit_id || !name) return c.json({ error: 'Unit and name required' }, 400)

  const pwdHash = await hashPassword(password || 'Customer@123')

  const result = await c.env.DB.prepare(
    `INSERT INTO customers (unit_id, name, email, mobile1, mobile2, address, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(unit_id, name, email || null, mobile1 || null, mobile2 || null, address || null, pwdHash).run()

  // Update unit particulars
  await c.env.DB.prepare(`UPDATE units SET particulars = 'Occupied', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(unit_id).run()

  // Property history
  await c.env.DB.prepare(
    `INSERT INTO property_history (unit_id, event_type, description, changed_by_employee_id) VALUES (?, ?, ?, ?)`
  ).bind(unit_id, 'owner_change', `New owner added: ${name}`, user.id).run()

  await auditLog(c.env.DB, 'created', 'customer', result.meta.last_row_id as number,
    `Customer added: ${name}`, 'employee', user.id as number, user.name as string)

  return c.json({ id: result.meta.last_row_id, message: 'Customer added successfully' })
})

// Update customer
customers.put('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, email, mobile1, mobile2, address } = body

  await c.env.DB.prepare(
    `UPDATE customers SET name=?, email=?, mobile1=?, mobile2=?, address=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(name, email || null, mobile1 || null, mobile2 || null, address || null, id).run()

  await auditLog(c.env.DB, 'updated', 'customer', parseInt(id),
    `Customer updated: ${name}`, 'employee', user.id as number, user.name as string)

  return c.json({ message: 'Customer updated successfully' })
})

// Delete customer (soft delete)
customers.delete('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  await c.env.DB.prepare(`UPDATE customers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run()

  await auditLog(c.env.DB, 'deleted', 'customer', parseInt(id),
    'Customer deactivated', 'employee', user.id as number, user.name as string)

  return c.json({ message: 'Customer removed successfully' })
})

// Add/Update Tenant
customers.post('/:id/tenant', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const customerId = c.req.param('id')
  const body = await c.req.json()
  const { name, email, mobile1, mobile2, tenancy_start, tenancy_expiry, unit_id } = body

  // Deactivate existing tenant
  await c.env.DB.prepare(`UPDATE tenants SET is_active = 0 WHERE customer_id = ? AND is_active = 1`).bind(customerId).run()

  const result = await c.env.DB.prepare(
    `INSERT INTO tenants (unit_id, customer_id, name, email, mobile1, mobile2, tenancy_start, tenancy_expiry)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(unit_id, customerId, name, email || null, mobile1 || null, mobile2 || null, tenancy_start || null, tenancy_expiry || null).run()

  // Update unit particulars
  await c.env.DB.prepare(`UPDATE units SET particulars = 'Occupied', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(unit_id).run()

  // Property history
  await c.env.DB.prepare(
    `INSERT INTO property_history (unit_id, event_type, description, changed_by_employee_id) VALUES (?, ?, ?, ?)`
  ).bind(unit_id, 'tenant_change', `Tenant added: ${name}, Expiry: ${tenancy_expiry || 'N/A'}`, user.id).run()

  await auditLog(c.env.DB, 'created', 'tenant', result.meta.last_row_id as number,
    `Tenant added: ${name}`, 'employee', user.id as number, user.name as string)

  return c.json({ id: result.meta.last_row_id, message: 'Tenant added successfully' })
})

// Remove tenant
customers.delete('/:id/tenant/:tenantId', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const tenantId = c.req.param('tenantId')
  await c.env.DB.prepare(`UPDATE tenants SET is_active = 0 WHERE id = ?`).bind(tenantId).run()

  return c.json({ message: 'Tenant removed' })
})

// Property history
customers.get('/:id/history', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const customer = await c.env.DB.prepare(`SELECT unit_id FROM customers WHERE id = ?`).bind(id).first<any>()
  if (!customer) return c.json({ error: 'Not found' }, 404)

  const history = await c.env.DB.prepare(
    `SELECT ph.*, e.name as changed_by_name FROM property_history ph
     LEFT JOIN employees e ON ph.changed_by_employee_id = e.id
     WHERE ph.unit_id = ? ORDER BY ph.changed_at DESC`
  ).bind(customer.unit_id).all()

  const auditHistory = await c.env.DB.prepare(
    `SELECT * FROM audit_logs WHERE entity_type = 'customer' AND entity_id = ? ORDER BY created_at DESC`
  ).bind(id).all()

  return c.json({ property_history: history.results, audit_logs: auditHistory.results })
})

export default customers
