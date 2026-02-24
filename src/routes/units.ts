import { Hono } from 'hono'
import { getAuthUser } from '../lib/auth'

type Bindings = { DB: D1Database }
const units = new Hono<{ Bindings: Bindings }>()

// List all units
units.get('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = (page - 1) * limit
  const particulars = c.req.query('particulars') || ''
  const search = c.req.query('search') || ''

  let query = `SELECT u.*, c.name as owner_name, c.email as owner_email, c.mobile1 as owner_mobile,
               t.name as tenant_name, t.tenancy_expiry
               FROM units u
               LEFT JOIN customers c ON u.id = c.unit_id AND c.is_active = 1
               LEFT JOIN tenants t ON u.id = t.unit_id AND t.is_active = 1
               WHERE 1=1`
  const params: any[] = []

  if (particulars) { query += ` AND UPPER(u.particulars) LIKE ?`; params.push(`%${particulars.toUpperCase()}%`) }
  if (search) {
    query += ` AND (u.unit_no LIKE ? OR c.name LIKE ? OR t.name LIKE ?)`
    const s = `%${search}%`
    params.push(s, s, s)
  }

  const total = await c.env.DB.prepare(query.replace(/SELECT u\.\*.*?WHERE/, 'SELECT COUNT(*) as total FROM units u LEFT JOIN customers c ON u.id = c.unit_id AND c.is_active = 1 LEFT JOIN tenants t ON u.id = t.unit_id AND t.is_active = 1 WHERE')).bind(...params).first<any>()

  query += ` ORDER BY CAST(u.unit_no AS INTEGER) LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const result = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ units: result.results, total: total?.total || 0, page, limit })
})

// Get single unit details
units.get('/:unitNo', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const unitNo = c.req.param('unitNo')
  const unit = await c.env.DB.prepare(`SELECT * FROM units WHERE unit_no = ?`).bind(unitNo).first<any>()
  if (!unit) return c.json({ error: 'Unit not found' }, 404)

  const owner = await c.env.DB.prepare(`SELECT id, name, email, mobile1, mobile2, address FROM customers WHERE unit_id = ? AND is_active = 1`).bind(unit.id).first<any>()
  const tenant = await c.env.DB.prepare(`SELECT id, name, email, mobile1, mobile2, tenancy_start, tenancy_expiry FROM tenants WHERE unit_id = ? AND is_active = 1`).bind(unit.id).first<any>()

  // KYC status
  let ownerKyc: any = {}
  let tenantKyc: any = {}
  if (owner) {
    const docs = await c.env.DB.prepare(`SELECT doc_type FROM kyc_documents WHERE entity_type='customer' AND entity_id=?`).bind(owner.id).all()
    const types = (docs.results as any[]).map(d => d.doc_type)
    ownerKyc = {
      aadhar: types.includes('aadhar'),
      pan: types.includes('pan'),
      photo: types.includes('photo'),
      sale_deed: types.includes('sale_deed'),
      maintenance_agreement: types.includes('maintenance_agreement'),
    }
  }
  if (tenant) {
    const docs = await c.env.DB.prepare(`SELECT doc_type FROM kyc_documents WHERE entity_type='tenant' AND entity_id=?`).bind(tenant.id).all()
    const types = (docs.results as any[]).map(d => d.doc_type)
    tenantKyc = {
      tenancy_contract: types.includes('tenancy_contract'),
      aadhar: types.includes('aadhar'),
      pan: types.includes('pan'),
      photo: types.includes('photo'),
      police_verification: types.includes('police_verification'),
    }
  }

  // Complaint stats
  const compStats = await c.env.DB.prepare(
    `SELECT status, COUNT(*) as cnt FROM complaints WHERE unit_id = ? GROUP BY status`
  ).bind(unit.id).all()

  // Property history
  const history = await c.env.DB.prepare(
    `SELECT ph.*, e.name as changed_by FROM property_history ph LEFT JOIN employees e ON ph.changed_by_employee_id = e.id WHERE ph.unit_id = ? ORDER BY ph.changed_at DESC LIMIT 10`
  ).bind(unit.id).all()

  return c.json({ unit, owner, tenant, owner_kyc: ownerKyc, tenant_kyc: tenantKyc, complaint_stats: compStats.results, property_history: history.results })
})

// Update unit particulars
units.put('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const { particulars } = await c.req.json()
  await c.env.DB.prepare(`UPDATE units SET particulars=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(particulars, id).run()

  return c.json({ message: 'Unit updated' })
})

export default units
