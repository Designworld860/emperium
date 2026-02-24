import { Hono } from 'hono'
import { getAuthUser } from '../lib/auth'

type Bindings = { DB: D1Database }
const search = new Hono<{ Bindings: Bindings }>()

// Universal search
search.get('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const q = c.req.query('q') || ''
  if (q.length < 2) return c.json({ results: [], message: 'Query too short' })

  const s = `%${q}%`

  // Search units
  const units = await c.env.DB.prepare(
    `SELECT u.id, u.unit_no, u.particulars, u.billing_area,
     c.name as owner_name, c.email as owner_email, c.mobile1 as owner_mobile,
     t.name as tenant_name
     FROM units u
     LEFT JOIN customers c ON u.id = c.unit_id AND c.is_active=1
     LEFT JOIN tenants t ON u.id = t.unit_id AND t.is_active=1
     WHERE u.unit_no LIKE ? OR c.name LIKE ? OR t.name LIKE ? OR c.email LIKE ? OR c.mobile1 LIKE ?
     LIMIT 10`
  ).bind(s, s, s, s, s).all()

  // Search complaints
  let complaintsQuery = `SELECT comp.id, comp.complaint_no, comp.status, comp.description, comp.created_at,
     u.unit_no, cc.name as category_name, c.name as customer_name
     FROM complaints comp
     JOIN units u ON comp.unit_id = u.id
     JOIN complaint_categories cc ON comp.category_id = cc.id
     LEFT JOIN customers c ON comp.customer_id = c.id
     WHERE comp.complaint_no LIKE ? OR comp.description LIKE ? OR u.unit_no LIKE ?`
  const compParams: any[] = [s, s, s]

  if (user.type === 'customer') {
    complaintsQuery += ` AND comp.customer_id = ?`
    compParams.push(user.id)
  } else if (user.type === 'employee' && user.role === 'employee') {
    complaintsQuery += ` AND comp.assigned_to_employee_id = ?`
    compParams.push(user.id)
  }
  complaintsQuery += ` LIMIT 10`

  const comps = await c.env.DB.prepare(complaintsQuery).bind(...compParams).all()

  return c.json({
    units: units.results,
    complaints: comps.results,
    total: (units.results?.length || 0) + (comps.results?.length || 0)
  })
})

export default search
