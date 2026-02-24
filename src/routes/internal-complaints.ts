import { Hono } from 'hono'
import { getAuthUser } from '../lib/auth'
import { auditLog } from '../lib/db'

type Bindings = { DB: D1Database }
const ic = new Hono<{ Bindings: Bindings }>()

// Only employees (all roles) can access
function requireEmployee(user: any) {
  return user && user.type === 'employee'
}
function isManager(user: any) {
  return user && user.type === 'employee' && ['admin', 'sub_admin'].includes(user.role)
}

function generateICNo(): string {
  const now = new Date()
  const yr  = now.getFullYear().toString().slice(-2)
  const mo  = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `IC-${yr}${mo}${day}-${rand}`
}

// ── List ──────────────────────────────────────────────────────
ic.get('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || !requireEmployee(user)) return c.json({ error: 'Unauthorized' }, 401)

  const page   = parseInt(c.req.query('page')   || '1')
  const limit  = parseInt(c.req.query('limit')  || '30')
  const offset = (page - 1) * limit
  const status = c.req.query('status') || ''

  const whereClauses: string[] = []
  const params: any[] = []

  // Non-managers see only their own + complaints assigned to them
  if (!isManager(user)) {
    whereClauses.push(`(ic.reported_by_employee_id = ? OR ic.assigned_to_employee_id = ?)`)
    params.push(user.id, user.id)
  }
  if (status) { whereClauses.push(`ic.status = ?`); params.push(status) }

  const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const baseJoin = `FROM internal_complaints ic
    JOIN employees rep ON ic.reported_by_employee_id = rep.id
    LEFT JOIN employees asgn ON ic.assigned_to_employee_id = asgn.id
    LEFT JOIN employees res  ON ic.resolved_by_employee_id = res.id`

  const total = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt ${baseJoin} ${whereSQL}`
  ).bind(...params).first<any>()

  const rows = await c.env.DB.prepare(
    `SELECT ic.*, rep.name as reporter_name, rep.department as reporter_dept,
     asgn.name as assigned_to_name, res.name as resolved_by_name
     ${baseJoin} ${whereSQL}
     ORDER BY ic.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all()

  return c.json({ complaints: rows.results, total: total?.cnt || 0, page, limit })
})

// ── Get single ────────────────────────────────────────────────
ic.get('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || !requireEmployee(user)) return c.json({ error: 'Unauthorized' }, 401)

  const id = parseInt(c.req.param('id'))

  const row = await c.env.DB.prepare(
    `SELECT ic.*, rep.name as reporter_name, rep.email as reporter_email, rep.department as reporter_dept,
     asgn.name as assigned_to_name, res.name as resolved_by_name
     FROM internal_complaints ic
     JOIN employees rep ON ic.reported_by_employee_id = rep.id
     LEFT JOIN employees asgn ON ic.assigned_to_employee_id = asgn.id
     LEFT JOIN employees res  ON ic.resolved_by_employee_id = res.id
     WHERE ic.id = ?`
  ).bind(id).first<any>()

  if (!row) return c.json({ error: 'Not found' }, 404)

  // Access control: non-managers only see own / assigned
  if (!isManager(user) && row.reported_by_employee_id !== user.id && row.assigned_to_employee_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const audit = await c.env.DB.prepare(
    `SELECT * FROM audit_logs WHERE entity_type = 'internal_complaint' AND entity_id = ? ORDER BY created_at DESC`
  ).bind(id).all()

  return c.json({ complaint: row, audit_trail: audit.results })
})

// ── Create ────────────────────────────────────────────────────
ic.post('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || !requireEmployee(user)) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { category, sub_category, description, photo_data, priority } = body
  if (!category?.trim() || !description?.trim()) {
    return c.json({ error: 'Category and description are required' }, 400)
  }

  const no = generateICNo()
  const result = await c.env.DB.prepare(
    `INSERT INTO internal_complaints
     (complaint_no, reported_by_employee_id, category, sub_category, description, photo_data, priority, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(no, user.id, category.trim(), sub_category || null, description.trim(), photo_data || null, priority || 'Normal').run()

  await auditLog(c.env.DB, 'created', 'internal_complaint', result.meta.last_row_id as number,
    `Internal complaint ${no} registered`, 'employee', user.id as number, user.name as string)

  return c.json({ message: 'Internal complaint registered', complaint_no: no, id: result.meta.last_row_id })
})

// ── Assign (managers only) ────────────────────────────────────
ic.post('/:id/assign', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || !isManager(user)) return c.json({ error: 'Unauthorized' }, 403)

  const id = parseInt(c.req.param('id'))
  const { employee_id } = await c.req.json()
  if (!employee_id) return c.json({ error: 'employee_id required' }, 400)

  const emp = await c.env.DB.prepare(`SELECT name FROM employees WHERE id=?`).bind(employee_id).first<any>()
  if (!emp) return c.json({ error: 'Employee not found' }, 404)

  await c.env.DB.prepare(
    `UPDATE internal_complaints SET assigned_to_employee_id=?, assigned_at=CURRENT_TIMESTAMP, status='In-Progress', updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(employee_id, id).run()

  await auditLog(c.env.DB, 'assigned', 'internal_complaint', id,
    `Assigned to ${emp.name}`, 'employee', user.id as number, user.name as string)

  return c.json({ message: `Assigned to ${emp.name}` })
})

// ── Update status (assignee or manager) ──────────────────────
ic.patch('/:id/status', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || !requireEmployee(user)) return c.json({ error: 'Unauthorized' }, 401)

  const id = parseInt(c.req.param('id'))
  const { status, resolution_notes } = await c.req.json()
  const validStatuses = ['Pending', 'In-Progress', 'Resolved']
  if (!validStatuses.includes(status)) return c.json({ error: 'Invalid status' }, 400)

  const existing = await c.env.DB.prepare(`SELECT * FROM internal_complaints WHERE id=?`).bind(id).first<any>()
  if (!existing) return c.json({ error: 'Not found' }, 404)
  if (!isManager(user) && existing.assigned_to_employee_id !== user.id && existing.reported_by_employee_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const updates: string[] = ['status=?', 'updated_at=CURRENT_TIMESTAMP']
  const bindVals: any[] = [status]

  if (status === 'Resolved') {
    updates.push('resolved_at=CURRENT_TIMESTAMP', 'resolved_by_employee_id=?')
    bindVals.push(user.id)
    if (resolution_notes) { updates.push('resolution_notes=?'); bindVals.push(resolution_notes) }
  }
  bindVals.push(id)

  await c.env.DB.prepare(`UPDATE internal_complaints SET ${updates.join(',')} WHERE id=?`).bind(...bindVals).run()

  await auditLog(c.env.DB, 'status_changed', 'internal_complaint', id,
    `Status → ${status}${resolution_notes ? '. Notes: ' + resolution_notes.substring(0,80) : ''}`,
    'employee', user.id as number, user.name as string)

  return c.json({ message: `Status updated to ${status}` })
})

// ── Delete (admin only) ───────────────────────────────────────
ic.delete('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 403)

  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare(`DELETE FROM internal_complaints WHERE id=?`).bind(id).run()

  await auditLog(c.env.DB, 'deleted', 'internal_complaint', id,
    `Internal complaint #${id} deleted`, 'employee', user.id as number, user.name as string)

  return c.json({ message: 'Deleted' })
})

export default ic
