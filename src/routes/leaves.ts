import { Hono } from 'hono'
import { getAuthUser } from '../lib/auth'
import { auditLog, createNotification } from '../lib/db'

type Bindings = { DB: D1Database }
const leaves = new Hono<{ Bindings: Bindings }>()

// GET /leaves — employee sees own leaves; admin/sub_admin sees subordinates + pending
leaves.get('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const isManager = ['admin', 'sub_admin'].includes(user.role as string)
  const status = c.req.query('status') || ''
  const emp_filter = c.req.query('employee_id') ? parseInt(c.req.query('employee_id')!) : null

  let where = 'WHERE 1=1'
  const params: any[] = []

  if (!isManager) {
    where += ' AND el.employee_id = ?'
    params.push(user.id)
  } else if (emp_filter) {
    where += ' AND el.employee_id = ?'
    params.push(emp_filter)
  }

  if (status) {
    where += ' AND el.status = ?'
    params.push(status)
  }

  const result = await c.env.DB.prepare(`
    SELECT el.*,
           e.name as employee_name, e.department, e.reporting_manager_id,
           mgr.name as manager_name,
           rev.name as reviewed_by_name
    FROM employee_leaves el
    JOIN employees e ON el.employee_id = e.id
    LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id
    LEFT JOIN employees rev ON el.reviewed_by_employee_id = rev.id
    ${where}
    ORDER BY el.applied_at DESC
    LIMIT 200
  `).bind(...params).all()

  // Pending count for managers
  let pendingCount = 0
  if (isManager) {
    const pc = await c.env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM employee_leaves el
      JOIN employees e ON el.employee_id = e.id
      WHERE el.status = 'Pending'
        AND (e.reporting_manager_id = ? OR ? IN (SELECT id FROM employees WHERE role='admin'))
    `).bind(user.id, user.id).first<any>()
    pendingCount = pc?.cnt || 0
  }

  return c.json({ leaves: result.results, pending_count: pendingCount })
})

// GET /leaves/blocked-dates?employee_id=x — returns approved leave dates for scheduling check
leaves.get('/blocked-dates', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const emp_id = c.req.query('employee_id') ? parseInt(c.req.query('employee_id')!) : user.id as number

  const result = await c.env.DB.prepare(`
    SELECT leave_date, leave_type FROM employee_leaves
    WHERE employee_id = ? AND status = 'Approved'
    ORDER BY leave_date
  `).bind(emp_id).all()

  return c.json({ blocked_dates: result.results })
})

// POST /leaves — apply for leave
leaves.post('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { leave_date, leave_type, reason, dates } = body  // dates = array for multi-day

  if (!leave_date && (!dates || !dates.length)) {
    return c.json({ error: 'leave_date or dates array required' }, 400)
  }

  const datesArr: string[] = dates?.length ? dates : [leave_date]
  const inserted: string[] = []
  const skipped: string[] = []

  for (const ld of datesArr) {
    // Check for duplicate
    const existing = await c.env.DB.prepare(
      `SELECT id FROM employee_leaves WHERE employee_id=? AND leave_date=? AND leave_type=?`
    ).bind(user.id, ld, leave_type || 'Full Day').first<any>()

    if (existing) { skipped.push(ld); continue }

    await c.env.DB.prepare(`
      INSERT INTO employee_leaves (employee_id, leave_date, leave_type, reason, status)
      VALUES (?, ?, ?, ?, 'Pending')
    `).bind(user.id, ld, leave_type || 'Full Day', reason || null).run()
    inserted.push(ld)
  }

  // Notify reporting manager
  const emp = await c.env.DB.prepare(
    `SELECT name, reporting_manager_id FROM employees WHERE id=?`
  ).bind(user.id).first<any>()

  if (emp?.reporting_manager_id) {
    await createNotification(
      c.env.DB, 'employee', emp.reporting_manager_id,
      'Leave Application',
      `${emp.name} applied for leave on ${inserted.join(', ')}. Please review.`,
      'info', null
    )
  }

  // Also notify admins if no reporting manager
  if (!emp?.reporting_manager_id) {
    const admins = await c.env.DB.prepare(
      `SELECT id FROM employees WHERE role='admin' AND is_active=1`
    ).all()
    for (const a of admins.results as any[]) {
      await createNotification(c.env.DB, 'employee', (a as any).id,
        'Leave Application',
        `${emp?.name || 'Employee'} applied for leave on ${inserted.join(', ')}.`,
        'info', null)
    }
  }

  await auditLog(c.env.DB, 'leave_applied', 'employee', user.id as number,
    `Leave applied for: ${inserted.join(', ')} (${leave_type || 'Full Day'})`,
    'employee', user.id as number, user.name as string)

  return c.json({
    message: `Leave applied for ${inserted.length} day(s)${skipped.length ? `. ${skipped.length} skipped (duplicate).` : ''}`,
    inserted, skipped
  })
})

// PATCH /leaves/:id — approve or reject (manager/admin)
leaves.patch('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const { status, remarks } = body

  if (!['Approved', 'Rejected'].includes(status)) {
    return c.json({ error: 'Status must be Approved or Rejected' }, 400)
  }

  // Get the leave
  const leave = await c.env.DB.prepare(`
    SELECT el.*, e.name as emp_name, e.reporting_manager_id
    FROM employee_leaves el JOIN employees e ON el.employee_id = e.id
    WHERE el.id = ?
  `).bind(id).first<any>()

  if (!leave) return c.json({ error: 'Leave not found' }, 404)

  // Check authority: admin always can; sub_admin can if reporting manager
  const isAdmin = user.role === 'admin'
  const isSubAdmin = user.role === 'sub_admin'
  const isReportingMgr = leave.reporting_manager_id === user.id

  if (!isAdmin && !isReportingMgr && !isSubAdmin) {
    return c.json({ error: 'You are not authorized to review this leave' }, 403)
  }

  await c.env.DB.prepare(`
    UPDATE employee_leaves SET status=?, reviewed_by_employee_id=?, reviewed_at=CURRENT_TIMESTAMP, review_remarks=?
    WHERE id=?
  `).bind(status, user.id, remarks || null, id).run()

  // Notify the employee
  await createNotification(c.env.DB, 'employee', leave.employee_id,
    `Leave ${status}`,
    `Your leave for ${leave.leave_date} (${leave.leave_type}) has been ${status.toLowerCase()}${remarks ? '. Remarks: ' + remarks : ''}.`,
    status === 'Approved' ? 'success' : 'alert', null)

  await auditLog(c.env.DB, 'leave_reviewed', 'employee', leave.employee_id,
    `Leave ${status} for ${leave.leave_date} by ${user.name}${remarks ? '. Remarks: ' + remarks : ''}`,
    'employee', user.id as number, user.name as string)

  return c.json({ message: `Leave ${status.toLowerCase()} successfully` })
})

// DELETE /leaves/:id — cancel (own) leave if still pending
leaves.delete('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const id = parseInt(c.req.param('id'))
  const leave = await c.env.DB.prepare(
    `SELECT * FROM employee_leaves WHERE id=? AND employee_id=?`
  ).bind(id, user.id).first<any>()

  if (!leave) return c.json({ error: 'Leave not found' }, 404)
  if (leave.status !== 'Pending') return c.json({ error: 'Cannot cancel a reviewed leave' }, 400)

  await c.env.DB.prepare(`DELETE FROM employee_leaves WHERE id=?`).bind(id).run()
  return c.json({ message: 'Leave cancelled' })
})

export default leaves
