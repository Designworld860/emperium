import { Hono } from 'hono'
import { getAuthUser, hashPassword } from '../lib/auth'
import { auditLog } from '../lib/db'

type Bindings = { DB: D1Database }
const employees = new Hono<{ Bindings: Bindings }>()

// List employees
employees.get('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const result = await c.env.DB.prepare(
    `SELECT id, name, email, mobile, role, department, is_active, created_at FROM employees ORDER BY name`
  ).all()

  return c.json({ employees: result.results })
})

// Get employee by ID
employees.get('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const emp = await c.env.DB.prepare(
    `SELECT id, name, email, mobile, role, department, is_active, created_at FROM employees WHERE id = ?`
  ).bind(id).first<any>()

  if (!emp) return c.json({ error: 'Employee not found' }, 404)

  // Assigned complaints
  const complaints = await c.env.DB.prepare(
    `SELECT comp.*, u.unit_no, cc.name as category_name FROM complaints comp
     JOIN units u ON comp.unit_id = u.id
     JOIN complaint_categories cc ON comp.category_id = cc.id
     WHERE comp.assigned_to_employee_id = ? AND comp.status NOT IN ('Resolved', 'Closed')
     ORDER BY comp.created_at DESC`
  ).bind(id).all()

  return c.json({ employee: emp, assigned_complaints: complaints.results })
})

// Add employee (admin only)
employees.post('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || user.role !== 'admin') {
    return c.json({ error: 'Only admin can add employees' }, 401)
  }

  const body = await c.req.json()
  const { name, email, mobile, role, department, password } = body
  if (!name || !email || !role) return c.json({ error: 'Name, email and role required' }, 400)

  const pwdHash = await hashPassword(password || 'Emp@123')

  const result = await c.env.DB.prepare(
    `INSERT INTO employees (name, email, mobile, role, department, password_hash) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(name, email.toLowerCase(), mobile || null, role, department || null, pwdHash).run()

  await auditLog(c.env.DB, 'created', 'employee', result.meta.last_row_id as number,
    `Employee added: ${name} (${role})`, 'employee', user.id as number, user.name as string)

  return c.json({ id: result.meta.last_row_id, message: 'Employee added successfully' })
})

// Update employee
employees.put('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || !['admin', 'sub_admin'].includes(user.role as string)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const id = c.req.param('id')
  const body = await c.req.json()
  const { name, email, mobile, role, department, is_active } = body

  await c.env.DB.prepare(
    `UPDATE employees SET name=?, email=?, mobile=?, role=?, department=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(name, email, mobile || null, role, department || null, is_active ?? 1, id).run()

  await auditLog(c.env.DB, 'updated', 'employee', parseInt(id),
    `Employee updated: ${name}`, 'employee', user.id as number, user.name as string)

  return c.json({ message: 'Employee updated' })
})

// Delete employee
employees.delete('/:id', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  await c.env.DB.prepare(`UPDATE employees SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run()

  return c.json({ message: 'Employee deactivated' })
})

// Reset employee password
employees.post('/:id/reset-password', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || user.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  const { new_password } = await c.req.json()
  const hash = await hashPassword(new_password || 'Emp@123')

  await c.env.DB.prepare(`UPDATE employees SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(hash, id).run()

  return c.json({ message: 'Password reset successfully' })
})

export default employees
