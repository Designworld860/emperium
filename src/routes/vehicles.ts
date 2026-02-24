import { Hono } from 'hono'
import { getAuthUser } from '../lib/auth'
import { auditLog } from '../lib/db'

type Bindings = { DB: D1Database }
const vehicles = new Hono<{ Bindings: Bindings }>()

// ─── GET /vehicles — list vehicles ────────────────────────────────────────
// Query params: unit_id, customer_id
vehicles.get('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const unit_id     = c.req.query('unit_id')     ? parseInt(c.req.query('unit_id')!)     : null
  const customer_id = c.req.query('customer_id') ? parseInt(c.req.query('customer_id')!) : null

  const where: string[] = ['v.is_active = 1']
  const params: any[]   = []

  if (unit_id)     { where.push(`v.unit_id = ?`);     params.push(unit_id) }
  if (customer_id) { where.push(`v.customer_id = ?`); params.push(customer_id) }

  // Customers see only their own vehicles
  if (user.type === 'customer') {
    where.push(`v.customer_id = ?`)
    params.push(user.id)
  }

  const whereSQL = `WHERE ${where.join(' AND ')}`

  const result = await c.env.DB.prepare(`
    SELECT v.*,
           u.unit_no,
           c.name  AS owner_name,
           t.name  AS tenant_name,
           e.name  AS registered_by_name
    FROM vehicles v
    JOIN units u             ON v.unit_id = u.id
    LEFT JOIN customers c    ON v.customer_id = c.id
    LEFT JOIN tenants t      ON v.tenant_id   = t.id
    LEFT JOIN employees e    ON v.registered_by_employee_id = e.id
    ${whereSQL}
    ORDER BY v.registered_at DESC
  `).bind(...params).all()

  return c.json({ vehicles: result.results })
})

// ─── GET /vehicles/:id — single vehicle detail ────────────────────────────
vehicles.get('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const id = parseInt(c.req.param('id'))
  const v  = await c.env.DB.prepare(`
    SELECT v.*,
           u.unit_no,
           c.name  AS owner_name,
           t.name  AS tenant_name,
           e.name  AS registered_by_name
    FROM vehicles v
    JOIN units u             ON v.unit_id = u.id
    LEFT JOIN customers c    ON v.customer_id = c.id
    LEFT JOIN tenants t      ON v.tenant_id   = t.id
    LEFT JOIN employees e    ON v.registered_by_employee_id = e.id
    WHERE v.id = ?
  `).bind(id).first<any>()

  if (!v) return c.json({ error: 'Vehicle not found' }, 404)

  // Customers can only view their own vehicles
  if (user.type === 'customer' && v.customer_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  return c.json({ vehicle: v })
})

// ─── POST /vehicles — register new vehicle ────────────────────────────────
vehicles.post('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const {
    unit_id:        unitIdRaw,
    customer_id:    customerIdRaw,
    tenant_id:      tenantIdRaw,
    vehicle_number,
    vehicle_type,
    vehicle_make,
    vehicle_model,
    vehicle_color,
    rc_file_name,
    rc_file_data,
  } = body

  const unit_id     = parseInt(unitIdRaw)
  const customer_id = customerIdRaw ? parseInt(customerIdRaw) : null
  const tenant_id   = tenantIdRaw   ? parseInt(tenantIdRaw)   : null

  if (!unit_id || !vehicle_number?.trim()) {
    return c.json({ error: 'Unit ID and vehicle number are required' }, 400)
  }

  // Customers can only register for their own unit
  if (user.type === 'customer') {
    const cust = await c.env.DB.prepare(
      `SELECT unit_id FROM customers WHERE id = ?`
    ).bind(user.id).first<any>()
    if (!cust || cust.unit_id !== unit_id) {
      return c.json({ error: 'You can only register vehicles for your own unit' }, 403)
    }
  }

  const regBy = user.type === 'employee' ? user.id : null

  const result = await c.env.DB.prepare(`
    INSERT INTO vehicles
      (unit_id, customer_id, tenant_id, vehicle_number, vehicle_type,
       make, model, color, rc_file_name, rc_file_data,
       registered_by_employee_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    unit_id,
    customer_id,
    tenant_id,
    vehicle_number.trim().toUpperCase(),
    vehicle_type  || 'Car',
    vehicle_make  || null,
    vehicle_model || null,
    vehicle_color || null,
    rc_file_name  || null,
    rc_file_data  || null,
    regBy
  ).run()

  const vehicleId = result.meta.last_row_id as number

  await auditLog(c.env.DB, 'created', 'customer', unit_id,
    `Vehicle ${vehicle_number.toUpperCase()} registered for unit ${unit_id}`,
    user.type as string, user.id as number, user.name as string)

  return c.json({ id: vehicleId, message: 'Vehicle registered successfully' })
})

// ─── PUT /vehicles/:id — update vehicle ───────────────────────────────────
vehicles.put('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const id   = parseInt(c.req.param('id'))
  const body = await c.req.json()

  const existing = await c.env.DB.prepare(
    `SELECT * FROM vehicles WHERE id = ?`
  ).bind(id).first<any>()
  if (!existing) return c.json({ error: 'Vehicle not found' }, 404)

  if (user.type === 'customer' && existing.customer_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const {
    vehicle_number, vehicle_type, vehicle_make,
    vehicle_model, vehicle_color, rc_file_name, rc_file_data
  } = body

  await c.env.DB.prepare(`
    UPDATE vehicles SET
      vehicle_number = ?, vehicle_type = ?, make = ?,
      model = ?, color = ?,
      rc_file_name = ?, rc_file_data = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    vehicle_number?.trim().toUpperCase() || existing.vehicle_number,
    vehicle_type  || existing.vehicle_type,
    vehicle_make  ?? existing.make,
    vehicle_model ?? existing.model,
    vehicle_color ?? existing.color,
    rc_file_name  ?? existing.rc_file_name,
    rc_file_data  ?? existing.rc_file_data,
    id
  ).run()

  return c.json({ message: 'Vehicle updated successfully' })
})

// ─── DELETE /vehicles/:id — deactivate vehicle ────────────────────────────
vehicles.delete('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const id = parseInt(c.req.param('id'))
  const existing = await c.env.DB.prepare(
    `SELECT * FROM vehicles WHERE id = ?`
  ).bind(id).first<any>()
  if (!existing) return c.json({ error: 'Vehicle not found' }, 404)

  if (user.type === 'customer' && existing.customer_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await c.env.DB.prepare(
    `UPDATE vehicles SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(id).run()

  return c.json({ message: 'Vehicle removed' })
})

export default vehicles
