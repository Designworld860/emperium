import { Hono } from 'hono'
import { getAuthUser } from '../lib/auth'
import { auditLog, createNotification, generateComplaintNo } from '../lib/db'

type Bindings = { DB: D1Database }
const complaints = new Hono<{ Bindings: Bindings }>()

// List complaints
complaints.get('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = (page - 1) * limit
  const status = c.req.query('status') || ''
  const category = c.req.query('category') || ''

  let query = `SELECT comp.*, u.unit_no, cc.name as category_name, cc.icon as category_icon,
               c.name as customer_name, e.name as assigned_to_name, e2.name as resolved_by_name
               FROM complaints comp
               JOIN units u ON comp.unit_id = u.id
               JOIN complaint_categories cc ON comp.category_id = cc.id
               LEFT JOIN customers c ON comp.customer_id = c.id
               LEFT JOIN employees e ON comp.assigned_to_employee_id = e.id
               LEFT JOIN employees e2 ON comp.resolved_by_employee_id = e2.id
               WHERE 1=1`
  const params: any[] = []

  // Customers see only their own complaints
  if (user.type === 'customer') {
    query += ` AND comp.customer_id = ?`
    params.push(user.id)
  }

  // Employee sees only assigned complaints (unless admin/sub_admin)
  if (user.type === 'employee' && user.role === 'employee') {
    query += ` AND comp.assigned_to_employee_id = ?`
    params.push(user.id)
  }

  if (status) { query += ` AND comp.status = ?`; params.push(status) }
  if (category) { query += ` AND comp.category_id = ?`; params.push(category) }

  const countStmt = query.replace(/SELECT comp\.\*.*?WHERE/, 'SELECT COUNT(*) as total FROM complaints comp JOIN units u ON comp.unit_id = u.id JOIN complaint_categories cc ON comp.category_id = cc.id LEFT JOIN customers c ON comp.customer_id = c.id LEFT JOIN employees e ON comp.assigned_to_employee_id = e.id LEFT JOIN employees e2 ON comp.resolved_by_employee_id = e2.id WHERE')
  const total = await c.env.DB.prepare(countStmt).bind(...params).first<any>()

  query += ` ORDER BY comp.created_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const result = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ complaints: result.results, total: total?.total || 0, page, limit })
})

// Get single complaint
complaints.get('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
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
  ).bind(id).first<any>()

  if (!comp) return c.json({ error: 'Complaint not found' }, 404)

  // Audit trail for this complaint
  const audit = await c.env.DB.prepare(
    `SELECT * FROM audit_logs WHERE entity_type = 'complaint' AND entity_id = ? ORDER BY created_at DESC`
  ).bind(id).all()

  return c.json({ complaint: comp, audit_trail: audit.results })
})

// Register complaint (customer or employee)
complaints.post('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const { unit_id, category_id, description, photo_data, priority } = body

  if (!unit_id || !category_id || !description) {
    return c.json({ error: 'Unit, category and description required' }, 400)
  }

  const complaintNo = generateComplaintNo()

  let customerId = null
  let tenantId = null

  if (user.type === 'customer') {
    customerId = user.id
    // Check if unit belongs to this customer
    const cust = await c.env.DB.prepare(`SELECT unit_id FROM customers WHERE id = ?`).bind(user.id).first<any>()
    if (!cust || cust.unit_id !== unit_id) {
      return c.json({ error: 'You can only raise complaints for your unit' }, 403)
    }
  } else {
    // Employee raising on behalf
    const cust = await c.env.DB.prepare(`SELECT id FROM customers WHERE unit_id = ? AND is_active = 1 LIMIT 1`).bind(unit_id).first<any>()
    if (cust) customerId = cust.id
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO complaints (complaint_no, unit_id, customer_id, category_id, description, photo_data, priority, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Open')`
  ).bind(complaintNo, unit_id, customerId, category_id, description, photo_data || null, priority || 'Normal').run()

  const complaintId = result.meta.last_row_id as number

  await auditLog(c.env.DB, 'created', 'complaint', complaintId,
    `Complaint ${complaintNo} registered: ${description.substring(0, 80)}`,
    user.type as string, user.id as number, user.name as string)

  // Notify sub_admins
  const subAdmins = await c.env.DB.prepare(`SELECT id FROM employees WHERE role IN ('sub_admin', 'admin') AND is_active = 1`).all()
  for (const sa of subAdmins.results as any[]) {
    await createNotification(c.env.DB, 'employee', sa.id,
      'New Complaint Registered',
      `Complaint ${complaintNo} has been registered for Unit ${unit_id}.`,
      'info', complaintId)
  }

  return c.json({ id: complaintId, complaint_no: complaintNo, message: 'Complaint registered successfully' })
})

// Assign complaint (sub_admin / admin)
complaints.post('/:id/assign', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || !['admin', 'sub_admin'].includes(user.role as string)) {
    return c.json({ error: 'Only sub-admin or admin can assign complaints' }, 401)
  }

  const id = c.req.param('id')
  const { employee_id } = await c.req.json()
  if (!employee_id) return c.json({ error: 'Employee ID required' }, 400)

  const emp = await c.env.DB.prepare(`SELECT * FROM employees WHERE id = ? AND is_active = 1`).bind(employee_id).first<any>()
  if (!emp) return c.json({ error: 'Employee not found' }, 404)

  await c.env.DB.prepare(
    `UPDATE complaints SET assigned_to_employee_id=?, assigned_by_employee_id=?, assigned_at=CURRENT_TIMESTAMP, 
     status='Assigned', updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(employee_id, user.id, id).run()

  const comp = await c.env.DB.prepare(`SELECT complaint_no, customer_id FROM complaints WHERE id=?`).bind(id).first<any>()

  await auditLog(c.env.DB, 'assigned', 'complaint', parseInt(id),
    `Complaint assigned to ${emp.name}`, 'employee', user.id as number, user.name as string)

  // Notify employee
  await createNotification(c.env.DB, 'employee', employee_id,
    'Complaint Assigned', `Complaint ${comp?.complaint_no} has been assigned to you.`, 'info', parseInt(id))

  // Notify customer
  if (comp?.customer_id) {
    await createNotification(c.env.DB, 'customer', comp.customer_id,
      'Complaint Assigned', `Your complaint ${comp?.complaint_no} has been assigned to ${emp.name}.`, 'info', parseInt(id))
  }

  return c.json({ message: `Complaint assigned to ${emp.name}` })
})

// Schedule visit (employee)
complaints.post('/:id/schedule', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const { visit_date, visit_time } = await c.req.json()

  await c.env.DB.prepare(
    `UPDATE complaints SET visit_date=?, visit_time=?, status='Scheduled', updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(visit_date, visit_time || null, id).run()

  const comp = await c.env.DB.prepare(`SELECT complaint_no, customer_id FROM complaints WHERE id=?`).bind(id).first<any>()

  await auditLog(c.env.DB, 'scheduled', 'complaint', parseInt(id),
    `Visit scheduled: ${visit_date} ${visit_time}`, 'employee', user.id as number, user.name as string)

  if (comp?.customer_id) {
    await createNotification(c.env.DB, 'customer', comp.customer_id,
      'Visit Scheduled',
      `Visit for complaint ${comp.complaint_no} scheduled on ${visit_date}${visit_time ? ' at ' + visit_time : ''}.`,
      'info', parseInt(id))
  }

  return c.json({ message: 'Visit scheduled' })
})

// Resolve complaint (employee)
complaints.post('/:id/resolve', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const { resolution_notes, resolution_photo_data } = await c.req.json()

  await c.env.DB.prepare(
    `UPDATE complaints SET status='Resolved', resolved_at=CURRENT_TIMESTAMP, resolved_by_employee_id=?,
     resolution_notes=?, resolution_photo_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(user.id, resolution_notes || null, resolution_photo_data || null, id).run()

  const comp = await c.env.DB.prepare(`SELECT complaint_no, customer_id FROM complaints WHERE id=?`).bind(id).first<any>()

  await auditLog(c.env.DB, 'resolved', 'complaint', parseInt(id),
    `Complaint resolved. Notes: ${(resolution_notes || '').substring(0, 80)}`,
    'employee', user.id as number, user.name as string)

  if (comp?.customer_id) {
    await createNotification(c.env.DB, 'customer', comp.customer_id,
      'Complaint Resolved',
      `Your complaint ${comp.complaint_no} has been resolved.`,
      'success', parseInt(id))
  }

  return c.json({ message: 'Complaint resolved successfully' })
})

// Close complaint (admin)
complaints.post('/:id/close', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || !['admin', 'sub_admin'].includes(user.role as string)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const id = c.req.param('id')
  await c.env.DB.prepare(
    `UPDATE complaints SET status='Closed', updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(id).run()

  await auditLog(c.env.DB, 'closed', 'complaint', parseInt(id),
    'Complaint closed', 'employee', user.id as number, user.name as string)

  return c.json({ message: 'Complaint closed' })
})

// Complaint categories
complaints.get('/categories/list', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT * FROM complaint_categories WHERE is_active = 1 ORDER BY sort_order`
  ).all()
  return c.json({ categories: result.results })
})

export default complaints
