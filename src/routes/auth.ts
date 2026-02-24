import { Hono } from 'hono'
import { hashPassword, verifyPassword, createToken, getAuthUser } from '../lib/auth'
import { auditLog } from '../lib/db'

type Bindings = { DB: D1Database }
const auth = new Hono<{ Bindings: Bindings }>()

// Customer Login
auth.post('/customer/login', async (c) => {
  const { email, password } = await c.req.json()
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400)

  const customer = await c.env.DB.prepare(
    `SELECT c.*, u.unit_no, u.particulars FROM customers c 
     JOIN units u ON c.unit_id = u.id 
     WHERE c.email = ? AND c.is_active = 1`
  ).bind(email.toLowerCase().trim()).first<any>()

  if (!customer) return c.json({ error: 'Invalid credentials' }, 401)

  const valid = await verifyPassword(password, customer.password_hash)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

  const token = createToken({
    id: customer.id,
    type: 'customer',
    email: customer.email,
    name: customer.name,
    unit_id: customer.unit_id,
    unit_no: customer.unit_no,
  })

  await auditLog(c.env.DB, 'login', 'customer', customer.id, `Customer login: ${customer.email}`, 'customer', customer.id, customer.name)

  return c.json({
    token,
    user: {
      id: customer.id, type: 'customer',
      name: customer.name, email: customer.email,
      unit_no: customer.unit_no, unit_id: customer.unit_id,
      particulars: customer.particulars
    }
  })
})

// Employee Login
auth.post('/employee/login', async (c) => {
  const { email, password } = await c.req.json()
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400)

  const employee = await c.env.DB.prepare(
    `SELECT * FROM employees WHERE email = ? AND is_active = 1`
  ).bind(email.toLowerCase().trim()).first<any>()

  if (!employee) return c.json({ error: 'Invalid credentials' }, 401)

  const valid = await verifyPassword(password, employee.password_hash)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

  const token = createToken({
    id: employee.id,
    type: 'employee',
    role: employee.role,
    email: employee.email,
    name: employee.name,
  })

  await auditLog(c.env.DB, 'login', 'employee', employee.id, `Employee login: ${employee.email}`, 'employee', employee.id, employee.name)

  return c.json({
    token,
    user: {
      id: employee.id, type: 'employee',
      name: employee.name, email: employee.email,
      role: employee.role, department: employee.department
    }
  })
})

// Setup default passwords (run once)
auth.post('/setup', async (c) => {
  const db = c.env.DB
  const defaultPwd = await hashPassword('Admin@123')
  const subPwd = await hashPassword('SubAdmin@123')
  const empPwd = await hashPassword('Emp@123')
  const custPwd = await hashPassword('Customer@123')

  await db.prepare(`UPDATE employees SET password_hash = ? WHERE role = 'admin'`).bind(defaultPwd).run()
  await db.prepare(`UPDATE employees SET password_hash = ? WHERE role = 'sub_admin'`).bind(subPwd).run()
  await db.prepare(`UPDATE employees SET password_hash = ? WHERE role = 'employee'`).bind(empPwd).run()
  await db.prepare(`UPDATE customers SET password_hash = ?`).bind(custPwd).run()

  return c.json({ message: 'Default passwords set successfully' })
})

// Verify token
auth.get('/me', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  return c.json({ user })
})

// Change password
auth.post('/change-password', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { current_password, new_password } = await c.req.json()
  const newHash = await hashPassword(new_password)

  if (user.type === 'customer') {
    const cust = await c.env.DB.prepare(`SELECT password_hash FROM customers WHERE id = ?`).bind(user.id).first<any>()
    if (!cust || !(await verifyPassword(current_password, cust.password_hash))) {
      return c.json({ error: 'Current password incorrect' }, 400)
    }
    await c.env.DB.prepare(`UPDATE customers SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(newHash, user.id).run()
  } else {
    const emp = await c.env.DB.prepare(`SELECT password_hash FROM employees WHERE id = ?`).bind(user.id).first<any>()
    if (!emp || !(await verifyPassword(current_password, emp.password_hash))) {
      return c.json({ error: 'Current password incorrect' }, 400)
    }
    await c.env.DB.prepare(`UPDATE employees SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(newHash, user.id).run()
  }

  return c.json({ message: 'Password changed successfully' })
})

export default auth
