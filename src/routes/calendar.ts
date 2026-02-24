import { Hono } from 'hono'
import { getAuthUser } from '../lib/auth'
import { auditLog, createNotification } from '../lib/db'

type Bindings = { DB: D1Database }
const calendar = new Hono<{ Bindings: Bindings }>()

// ─── GET /calendar — scheduled visits ──────────────────────────────────────
// Query: view=month|week|today|all  year=  month=  week_start=YYYY-MM-DD
calendar.get('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const view       = c.req.query('view') || 'month'
  const year       = parseInt(c.req.query('year')  || new Date().getFullYear().toString())
  const month      = parseInt(c.req.query('month') || (new Date().getMonth() + 1).toString())
  const week_start = c.req.query('week_start') || ''
  const empFilter  = c.req.query('employee_id') ? parseInt(c.req.query('employee_id')!) : null
  const isManager  = ['admin', 'sub_admin'].includes(user.role as string)

  let targetEmpId: number | null = isManager ? empFilter : (user.id as number)

  // Build date filter
  const params: any[] = []
  let dateFilter = ''
  if (view === 'month') {
    const mm = month.toString().padStart(2, '0')
    dateFilter = `AND comp.visit_date LIKE '${year}-${mm}%'`
  } else if (view === 'week' && week_start) {
    dateFilter = `AND comp.visit_date >= ? AND comp.visit_date <= date(?, '+6 days')`
    params.push(week_start, week_start)
  } else if (view === 'today') {
    dateFilter = `AND comp.visit_date = date('now')`
  }

  let empClause = ''
  if (targetEmpId) {
    empClause = `AND comp.assigned_to_employee_id = ?`
    params.push(targetEmpId)
  }

  const visits = await c.env.DB.prepare(`
    SELECT comp.id, comp.complaint_no, comp.visit_date, comp.visit_time,
           comp.status, comp.priority, comp.description,
           comp.sub_category_id,
           u.unit_no,
           cc.name  AS category_name, cc.icon AS category_icon,
           sc.name  AS sub_category_name,
           cust.name AS customer_name, cust.mobile1 AS customer_mobile,
           e.id    AS employee_id,    e.name AS employee_name
    FROM complaints comp
    JOIN units u              ON comp.unit_id    = u.id
    JOIN complaint_categories cc ON comp.category_id = cc.id
    LEFT JOIN complaint_sub_categories sc   ON comp.sub_category_id = sc.id
    LEFT JOIN customers cust              ON comp.customer_id = cust.id
    LEFT JOIN employees e                 ON comp.assigned_to_employee_id = e.id
    WHERE comp.visit_date IS NOT NULL
      AND comp.status IN ('Scheduled','Assigned','In Progress')
      ${dateFilter}
      ${empClause}
    ORDER BY comp.visit_date ASC, comp.visit_time ASC
  `).bind(...params).all()

  // Approved leaves in the same window
  const leaveParams: any[] = []
  let leaveEmpClause = ''
  if (targetEmpId) {
    leaveEmpClause = `AND el.employee_id = ?`
    leaveParams.push(targetEmpId)
  }
  const leaves = await c.env.DB.prepare(`
    SELECT el.id, el.employee_id, el.leave_date, el.leave_type, el.status,
           e.name AS employee_name
    FROM employee_leaves el
    JOIN employees e ON el.employee_id = e.id
    WHERE el.status = 'Approved'
      ${leaveEmpClause}
    ORDER BY el.leave_date ASC
  `).bind(...leaveParams).all()

  const today = new Date().toISOString().split('T')[0]
  const vArr  = visits.results as any[]
  return c.json({
    visits : vArr,
    leaves : leaves.results,
    summary: {
      total   : vArr.length,
      today   : vArr.filter(v => v.visit_date === today).length,
      upcoming: vArr.filter(v => v.visit_date >  today).length,
      overdue : vArr.filter(v => v.visit_date <  today).length,
    }
  })
})

// ─── GET /calendar/leaves — list leaves for the current employee (or all for manager) ─
calendar.get('/leaves', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const isManager = ['admin', 'sub_admin'].includes(user.role as string)
  const statusFilter = c.req.query('status') || ''
  const empFilter    = c.req.query('employee_id') ? parseInt(c.req.query('employee_id')!) : null

  const params: any[] = []
  const where: string[] = []

  if (isManager) {
    if (empFilter) { where.push(`el.employee_id = ?`); params.push(empFilter) }
    // Manager can also see subordinates (employees who report to them)
  } else {
    where.push(`el.employee_id = ?`); params.push(user.id)
  }

  if (statusFilter) { where.push(`el.status = ?`); params.push(statusFilter) }

  const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const result = await c.env.DB.prepare(`
    SELECT el.*,
           e.name  AS employee_name,  e.department,
           r.name  AS reviewer_name
    FROM employee_leaves el
    JOIN employees e ON el.employee_id = e.id
    LEFT JOIN employees r ON el.reviewed_by_employee_id = r.id
    ${whereSQL}
    ORDER BY el.leave_date DESC
  `).bind(...params).all()

  // Pending count for managers (to show badge)
  let pendingCount = 0
  if (isManager) {
    const pc = await c.env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM employee_leaves WHERE status = 'Pending'`
    ).first<any>()
    pendingCount = pc?.cnt || 0
  }

  return c.json({ leaves: result.results, pendingCount })
})

// ─── POST /calendar/leaves — employee applies for leave ────────────────────
calendar.post('/leaves', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const body       = await c.req.json()
  const leave_date = (body.leave_date || '').trim()
  const leave_type = body.leave_type || 'Full Day'
  const reason     = (body.reason || '').trim()

  if (!leave_date) return c.json({ error: 'Leave date required' }, 400)

  // Prevent duplicate leave for same date
  const existing = await c.env.DB.prepare(
    `SELECT id, status FROM employee_leaves WHERE employee_id = ? AND leave_date = ?`
  ).bind(user.id, leave_date).first<any>()
  if (existing && existing.status !== 'Rejected') {
    return c.json({ error: 'Leave already applied for this date' }, 409)
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO employee_leaves (employee_id, leave_date, leave_type, reason, status)
     VALUES (?, ?, ?, ?, 'Pending')`
  ).bind(user.id, leave_date, leave_type, reason || null).run()

  const leaveId = result.meta.last_row_id as number

  await auditLog(c.env.DB, 'created', 'employee', user.id as number,
    `Leave applied for ${leave_date} (${leave_type})`,
    'employee', user.id as number, user.name as string)

  // Notify admins / sub-admins
  const managers = await c.env.DB.prepare(
    `SELECT id FROM employees WHERE role IN ('admin','sub_admin') AND is_active = 1`
  ).all()
  for (const m of managers.results as any[]) {
    await createNotification(c.env.DB, 'employee', (m as any).id,
      'Leave Application',
      `${user.name} has applied for leave on ${leave_date}.`,
      'info', null)
  }

  return c.json({ id: leaveId, message: 'Leave application submitted' })
})

// ─── POST /calendar/leaves/:id/approve — manager approves ─────────────────
calendar.post('/leaves/:id/approve', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || !['admin', 'sub_admin'].includes(user.role as string)) {
    return c.json({ error: 'Only managers can approve leaves' }, 403)
  }

  const id = parseInt(c.req.param('id'))
  const { remarks } = await c.req.json().catch(() => ({ remarks: '' }))

  const leave = await c.env.DB.prepare(
    `SELECT * FROM employee_leaves WHERE id = ?`
  ).bind(id).first<any>()
  if (!leave) return c.json({ error: 'Leave not found' }, 404)

  await c.env.DB.prepare(
    `UPDATE employee_leaves
     SET status='Approved', reviewed_by_employee_id=?, reviewed_at=CURRENT_TIMESTAMP,
         review_remarks=?
     WHERE id=?`
  ).bind(user.id, remarks || null, id).run()

  await auditLog(c.env.DB, 'updated', 'employee', leave.employee_id,
    `Leave approved for ${leave.leave_date}`,
    'employee', user.id as number, user.name as string)

  // Notify the employee
  await createNotification(c.env.DB, 'employee', leave.employee_id,
    'Leave Approved',
    `Your leave on ${leave.leave_date} has been approved by ${user.name}.`,
    'success', null)

  return c.json({ message: 'Leave approved' })
})

// ─── POST /calendar/leaves/:id/reject — manager rejects ───────────────────
calendar.post('/leaves/:id/reject', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || !['admin', 'sub_admin'].includes(user.role as string)) {
    return c.json({ error: 'Only managers can reject leaves' }, 403)
  }

  const id = parseInt(c.req.param('id'))
  const { remarks } = await c.req.json().catch(() => ({ remarks: '' }))

  const leave = await c.env.DB.prepare(
    `SELECT * FROM employee_leaves WHERE id = ?`
  ).bind(id).first<any>()
  if (!leave) return c.json({ error: 'Leave not found' }, 404)

  await c.env.DB.prepare(
    `UPDATE employee_leaves
     SET status='Rejected', reviewed_by_employee_id=?, reviewed_at=CURRENT_TIMESTAMP,
         review_remarks=?
     WHERE id=?`
  ).bind(user.id, remarks || null, id).run()

  await createNotification(c.env.DB, 'employee', leave.employee_id,
    'Leave Rejected',
    `Your leave on ${leave.leave_date} has been rejected by ${user.name}.${remarks ? ' Reason: ' + remarks : ''}`,
    'warning', null)

  return c.json({ message: 'Leave rejected' })
})

// ─── DELETE /calendar/leaves/:id — employee cancels pending leave ──────────
calendar.delete('/leaves/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const id = parseInt(c.req.param('id'))
  const leave = await c.env.DB.prepare(
    `SELECT * FROM employee_leaves WHERE id = ? AND employee_id = ?`
  ).bind(id, user.id).first<any>()

  if (!leave) return c.json({ error: 'Leave not found' }, 404)
  if (leave.status !== 'Pending') return c.json({ error: 'Only pending leaves can be cancelled' }, 400)

  await c.env.DB.prepare(`DELETE FROM employee_leaves WHERE id = ?`).bind(id).run()
  return c.json({ message: 'Leave cancelled' })
})

// ─── GET /calendar/leaves/approved-dates — dates blocked for scheduling ────
// Used by scheduling UI to disable dates
calendar.get('/leaves/approved-dates', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const employee_id = c.req.query('employee_id') ? parseInt(c.req.query('employee_id')!) : (user.id as number)

  const result = await c.env.DB.prepare(
    `SELECT leave_date, leave_type FROM employee_leaves
     WHERE employee_id = ? AND status = 'Approved'
     ORDER BY leave_date ASC`
  ).bind(employee_id).all()

  return c.json({ blocked_dates: result.results })
})

export default calendar
