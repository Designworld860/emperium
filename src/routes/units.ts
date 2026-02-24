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
  const particularsFilter = c.req.query('particulars') || ''
  const search = c.req.query('search') || ''

  // Build WHERE clauses explicitly (no fragile regex)
  const whereClauses: string[] = []
  const params: any[] = []

  if (particularsFilter) {
    whereClauses.push(`UPPER(u.particulars) LIKE ?`)
    params.push(`%${particularsFilter.toUpperCase()}%`)
  }
  if (search) {
    whereClauses.push(`(u.unit_no LIKE ? OR c.name LIKE ? OR t.name LIKE ? OR c.mobile1 LIKE ?)`)
    const s = `%${search}%`
    params.push(s, s, s, s)
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const baseJoin = `FROM units u
    LEFT JOIN customers c ON u.id = c.unit_id AND c.is_active = 1
    LEFT JOIN tenants t ON u.id = t.unit_id AND t.is_active = 1`

  // Count query using explicit build
  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total ${baseJoin} ${whereSQL}`
  ).bind(...params).first<any>()

  // Data query
  const dataParams = [...params, limit, offset]
  const result = await c.env.DB.prepare(
    `SELECT u.id, u.unit_no, u.particulars, u.area_unit, u.billing_area, u.created_at,
     c.id as customer_id, c.name as owner_name, c.email as owner_email, c.mobile1 as owner_mobile,
     t.id as tenant_id, t.name as tenant_name, t.tenancy_expiry
     ${baseJoin} ${whereSQL}
     ORDER BY CAST(u.unit_no AS INTEGER) LIMIT ? OFFSET ?`
  ).bind(...dataParams).all()

  return c.json({ units: result.results, total: countResult?.total || 0, page, limit })
})

// Get single unit by unit_no
units.get('/:unitNo', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const unitNo = c.req.param('unitNo')
  const unit = await c.env.DB.prepare(
    `SELECT * FROM units WHERE unit_no = ?`
  ).bind(unitNo).first<any>()
  if (!unit) return c.json({ error: 'Unit not found' }, 404)

  const owner = await c.env.DB.prepare(
    `SELECT id, name, email, mobile1, mobile2, address FROM customers WHERE unit_id = ? AND is_active = 1 LIMIT 1`
  ).bind(unit.id).first<any>()

  const tenant = await c.env.DB.prepare(
    `SELECT id, name, email, mobile1, mobile2, tenancy_start, tenancy_expiry FROM tenants WHERE unit_id = ? AND is_active = 1 LIMIT 1`
  ).bind(unit.id).first<any>()

  // KYC status
  let ownerKyc: Record<string, boolean> = {
    aadhar: false, pan: false, photo: false, sale_deed: false, maintenance_agreement: false
  }
  let tenantKyc: Record<string, boolean> = {
    tenancy_contract: false, aadhar: false, pan: false, photo: false, police_verification: false
  }

  if (owner) {
    const docs = await c.env.DB.prepare(
      `SELECT doc_type FROM kyc_documents WHERE entity_type='customer' AND entity_id=?`
    ).bind(owner.id).all()
    ;(docs.results as any[]).forEach(d => { ownerKyc[d.doc_type] = true })
  }
  if (tenant) {
    const docs = await c.env.DB.prepare(
      `SELECT doc_type FROM kyc_documents WHERE entity_type='tenant' AND entity_id=?`
    ).bind(tenant.id).all()
    ;(docs.results as any[]).forEach(d => { tenantKyc[d.doc_type] = true })
  }

  // Complaint stats
  const compStats = await c.env.DB.prepare(
    `SELECT status, COUNT(*) as cnt FROM complaints WHERE unit_id = ? GROUP BY status`
  ).bind(unit.id).all()

  // Property history
  const history = await c.env.DB.prepare(
    `SELECT ph.*, e.name as changed_by
     FROM property_history ph
     LEFT JOIN employees e ON ph.changed_by_employee_id = e.id
     WHERE ph.unit_id = ? ORDER BY ph.changed_at DESC LIMIT 10`
  ).bind(unit.id).all()

  return c.json({
    unit, owner, tenant,
    owner_kyc: ownerKyc, tenant_kyc: tenantKyc,
    complaint_stats: compStats.results,
    property_history: history.results
  })
})

// Update unit particulars
units.put('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const { particulars } = await c.req.json()
  if (!particulars) return c.json({ error: 'particulars required' }, 400)

  await c.env.DB.prepare(
    `UPDATE units SET particulars=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(particulars, parseInt(id)).run()

  return c.json({ message: 'Unit updated' })
})

export default units
