import { Hono } from 'hono'
import { getAuthUser } from '../lib/auth'
import { auditLog, createNotification, generateComplaintNo } from '../lib/db'

type Bindings = { DB: D1Database }
const complaints = new Hono<{ Bindings: Bindings }>()

// ─── IMPORTANT: Static routes MUST come before /:id wildcard ───

// Complaint categories — registered FIRST to avoid being caught by /:id
complaints.get('/categories/list', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT * FROM complaint_categories WHERE is_active = 1 ORDER BY sort_order`
  ).all()
  return c.json({ categories: result.results })
})

// List complaints
complaints.get('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = (page - 1) * limit
  const status = c.req.query('status') || ''
  const category = c.req.query('category') || ''

  // Build WHERE clauses separately to avoid fragile regex replacement
  const whereClauses: string[] = []
  const countParams: any[] = []

  if (user.type === 'customer') {
    whereClauses.push(`comp.customer_id = ?`)
    countParams.push(user.id)
  } else if (user.type === 'employee' && user.role === 'employee') {
    whereClauses.push(`comp.assigned_to_employee_id = ?`)
    countParams.push(user.id)
  }

  if (status) { whereClauses.push(`comp.status = ?`); countParams.push(status) }
  if (category) { whereClauses.push(`comp.category_id = ?`); countParams.push(parseInt(category)) }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

  const baseJoin = `FROM complaints comp
    JOIN units u ON comp.unit_id = u.id
    JOIN complaint_categories cc ON comp.category_id = cc.id
    LEFT JOIN customers c ON comp.customer_id = c.id
    LEFT JOIN employees e ON comp.assigned_to_employee_id = e.id
    LEFT JOIN employees e2 ON comp.resolved_by_employee_id = e2.id`

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total ${baseJoin} ${whereSQL}`
  ).bind(...countParams).first<any>()

  const listParams = [...countParams, limit, offset]
  const result = await c.env.DB.prepare(
    `SELECT comp.*, u.unit_no, cc.name as category_name, cc.icon as category_icon,
     c.name as customer_name, e.name as assigned_to_name, e2.name as resolved_by_name
     ${baseJoin} ${whereSQL}
     ORDER BY comp.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...listParams).all()

  return c.json({ complaints: result.results, total: countResult?.total || 0, page, limit })
})

// Get single complaint
complaints.get('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  // Validate id is numeric to avoid catching "categories" etc.
  if (!/^\d+$/.test(id)) return c.json({ error: 'Invalid complaint ID' }, 400)

  const comp = await c.env.DB.prepare(
    `SELECT comp.*, u.unit_no, cc.name as category_name, cc.icon as category_icon,
     cust.name as customer_name, cust.email as customer_email, cust.mobile1 as customer_mobile,
     e.name as assigned_to_name, e.email as assigned_to_email,
     e2.name as assigned_by_name, e3.name as resolved_by_name
     FROM complaints comp
     JOIN units u ON comp.unit_id = u.id
     JOIN complaint_categories cc ON comp.category_id = cc.id
     LEFT JOIN customers cust ON comp.customer_id = cust.id
     LEFT JOIN employees e ON comp.assigned_to_employee_id = e.id
     LEFT JOIN employees e2 ON comp.assigned_by_employee_id = e2.id
     LEFT JOIN employees e3 ON comp.resolved_by_employee_id = e3.id
     WHERE comp.id = ?`
  ).bind(parseInt(id)).first<any>()

  if (!comp) return c.json({ error: 'Complaint not found' }, 404)

  const audit = await c.env.DB.prepare(
    `SELECT * FROM audit_logs WHERE entity_type = 'complaint' AND entity_id = ? ORDER BY created_at DESC`
  ).bind(parseInt(id)).all()

  return c.json({ complaint: comp, audit_trail: audit.results })
})

// Register complaint (customer or employee)
complaints.post('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  // Coerce to integers to avoid type mismatch
  const unit_id = parseInt(body.unit_id)
  const category_id = parseInt(body.category_id)
  const { description, photo_data, priority } = body

  if (!unit_id || !category_id || !description?.trim()) {
    return c.json({ error: 'Unit, category and description required' }, 400)
  }

  const complaintNo = generateComplaintNo()
  let customerId: number | null = null

  if (user.type === 'customer') {
    customerId = user.id as number
    // Verify unit belongs to this customer
    const cust = await c.env.DB.prepare(`SELECT unit_id FROM customers WHERE id = ?`).bind(user.id).first<any>()
    if (!cust || parseInt(cust.unit_id) !== unit_id) {
      return c.json({ error: 'You can only raise complaints for your own unit' }, 403)
    }
  } else {
    // Employee raising on behalf — find the owner of that unit
    const cust = await c.env.DB.prepare(
      `SELECT id FROM customers WHERE unit_id = ? AND is_active = 1 LIMIT 1`
    ).bind(unit_id).first<any>()
    if (cust) customerId = cust.id
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO complaints (complaint_no, unit_id, customer_id, category_id, description, photo_data, priority, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Open')`
  ).bind(complaintNo, unit_id, customerId, category_id, description.trim(), photo_data || null, priority || 'Normal').run()

  const complaintId = result.meta.last_row_id as number

  await auditLog(c.env.DB, 'created', 'complaint', complaintId,
    `Complaint ${complaintNo} registered: ${description.substring(0, 80)}`,
    user.type as string, user.id as number, user.name as string)

  // Notify sub_admins and admins
  const subAdmins = await c.env.DB.prepare(
    `SELECT id FROM employees WHERE role IN ('sub_admin', 'admin') AND is_active = 1`
  ).all()
  for (const sa of subAdmins.results as any[]) {
    await createNotification(c.env.DB, 'employee', (sa as any).id,
      'New Complaint Registered',
      `Complaint ${complaintNo} registered for Unit ID ${unit_id}.`,
      'info', complaintId)
  }

  return c.json({ id: complaintId, complaint_no: complaintNo, message: 'Complaint registered successfully' })
})

// Assign complaint (sub_admin / admin)
complaints.post('/:id/assign', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || !['admin', 'sub_admin'].includes(user.role as string)) {
    return c.json({ error: 'Only sub-admin or admin can assign complaints' }, 403)
  }

  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const employee_id = parseInt(body.employee_id)
  if (!employee_id) return c.json({ error: 'Employee ID required' }, 400)

  const emp = await c.env.DB.prepare(
    `SELECT * FROM employees WHERE id = ? AND is_active = 1`
  ).bind(employee_id).first<any>()
  if (!emp) return c.json({ error: 'Employee not found' }, 404)

  await c.env.DB.prepare(
    `UPDATE complaints SET assigned_to_employee_id=?, assigned_by_employee_id=?,
     assigned_at=CURRENT_TIMESTAMP, status='Assigned', updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(employee_id, user.id, id).run()

  const comp = await c.env.DB.prepare(
    `SELECT complaint_no, customer_id FROM complaints WHERE id=?`
  ).bind(id).first<any>()

  await auditLog(c.env.DB, 'assigned', 'complaint', id,
    `Complaint assigned to ${emp.name}`, 'employee', user.id as number, user.name as string)

  await createNotification(c.env.DB, 'employee', employee_id,
    'Complaint Assigned',
    `Complaint ${comp?.complaint_no} has been assigned to you.`, 'info', id)

  if (comp?.customer_id) {
    await createNotification(c.env.DB, 'customer', comp.customer_id,
      'Complaint Assigned',
      `Your complaint ${comp.complaint_no} has been assigned to ${emp.name}.`, 'info', id)
  }

  return c.json({ message: `Complaint assigned to ${emp.name}` })
})

// Schedule visit (employee)
complaints.post('/:id/schedule', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const id = parseInt(c.req.param('id'))
  const { visit_date, visit_time } = await c.req.json()
  if (!visit_date) return c.json({ error: 'Visit date required' }, 400)

  await c.env.DB.prepare(
    `UPDATE complaints SET visit_date=?, visit_time=?, status='Scheduled', updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(visit_date, visit_time || null, id).run()

  const comp = await c.env.DB.prepare(
    `SELECT complaint_no, customer_id FROM complaints WHERE id=?`
  ).bind(id).first<any>()

  await auditLog(c.env.DB, 'scheduled', 'complaint', id,
    `Visit scheduled: ${visit_date}${visit_time ? ' ' + visit_time : ''}`,
    'employee', user.id as number, user.name as string)

  if (comp?.customer_id) {
    await createNotification(c.env.DB, 'customer', comp.customer_id,
      'Visit Scheduled',
      `Visit for complaint ${comp.complaint_no} scheduled on ${visit_date}${visit_time ? ' at ' + visit_time : ''}.`,
      'info', id)
  }

  return c.json({ message: 'Visit scheduled successfully' })
})

// Resolve complaint (employee)
complaints.post('/:id/resolve', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const id = parseInt(c.req.param('id'))
  const { resolution_notes, resolution_photo_data } = await c.req.json()

  await c.env.DB.prepare(
    `UPDATE complaints SET status='Resolved', resolved_at=CURRENT_TIMESTAMP,
     resolved_by_employee_id=?, resolution_notes=?, resolution_photo_data=?,
     updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(user.id, resolution_notes || null, resolution_photo_data || null, id).run()

  const comp = await c.env.DB.prepare(
    `SELECT complaint_no, customer_id FROM complaints WHERE id=?`
  ).bind(id).first<any>()

  await auditLog(c.env.DB, 'resolved', 'complaint', id,
    `Complaint resolved. Notes: ${(resolution_notes || '').substring(0, 80)}`,
    'employee', user.id as number, user.name as string)

  if (comp?.customer_id) {
    await createNotification(c.env.DB, 'customer', comp.customer_id,
      'Complaint Resolved',
      `Your complaint ${comp.complaint_no} has been resolved. ${resolution_notes ? 'Notes: ' + resolution_notes.substring(0, 100) : ''}`,
      'success', id)
  }

  return c.json({ message: 'Complaint resolved successfully' })
})

// Close complaint (admin / sub_admin)
complaints.post('/:id/close', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || !['admin', 'sub_admin'].includes(user.role as string)) {
    return c.json({ error: 'Unauthorized' }, 403)
  }

  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare(
    `UPDATE complaints SET status='Closed', updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(id).run()

  await auditLog(c.env.DB, 'closed', 'complaint', id,
    'Complaint closed', 'employee', user.id as number, user.name as string)

  return c.json({ message: 'Complaint closed' })
})

export default complaints
