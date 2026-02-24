import { Hono } from 'hono'
import { getAuthUser } from '../lib/auth'

type Bindings = { DB: D1Database }
const dashboard = new Hono<{ Bindings: Bindings }>()

// Admin/Sub-Admin Dashboard
dashboard.get('/admin', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const db = c.env.DB

  // Total units stats
  const unitStats = await db.prepare(`
    SELECT 
      COUNT(*) as total_units,
      SUM(CASE WHEN UPPER(particulars) LIKE '%OCCUPIED%' THEN 1 ELSE 0 END) as occupied,
      SUM(CASE WHEN UPPER(particulars) LIKE '%VACANT%' THEN 1 ELSE 0 END) as vacant,
      SUM(CASE WHEN UPPER(particulars) LIKE '%CONSTRUCTION%' THEN 1 ELSE 0 END) as under_construction
    FROM units
  `).first<any>()

  // Complaint stats
  const compStats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status='Open' THEN 1 ELSE 0 END) as open_count,
      SUM(CASE WHEN status='Assigned' THEN 1 ELSE 0 END) as assigned_count,
      SUM(CASE WHEN status='Scheduled' THEN 1 ELSE 0 END) as scheduled_count,
      SUM(CASE WHEN status='Resolved' THEN 1 ELSE 0 END) as resolved_count,
      SUM(CASE WHEN status='Closed' THEN 1 ELSE 0 END) as closed_count
    FROM complaints
  `).first<any>()

  // Complaint by category
  const byCategory = await db.prepare(`
    SELECT cc.name, COUNT(*) as count 
    FROM complaints comp JOIN complaint_categories cc ON comp.category_id=cc.id 
    WHERE comp.status NOT IN ('Resolved','Closed')
    GROUP BY cc.id ORDER BY count DESC
  `).all()

  // Recent complaints
  const recent = await db.prepare(`
    SELECT comp.id, comp.complaint_no, comp.status, comp.priority, comp.description, comp.created_at,
           u.unit_no, cc.name as category_name, c.name as customer_name
    FROM complaints comp
    JOIN units u ON comp.unit_id=u.id
    JOIN complaint_categories cc ON comp.category_id=cc.id
    LEFT JOIN customers c ON comp.customer_id=c.id
    ORDER BY comp.created_at DESC LIMIT 10
  `).all()

  // Customer count
  const custCount = await db.prepare(`SELECT COUNT(*) as cnt FROM customers WHERE is_active=1`).first<any>()
  const empCount = await db.prepare(`SELECT COUNT(*) as cnt FROM employees WHERE is_active=1`).first<any>()
  const tenantCount = await db.prepare(`SELECT COUNT(*) as cnt FROM tenants WHERE is_active=1`).first<any>()

  // KYC completion
  const kycDone = await db.prepare(`
    SELECT COUNT(DISTINCT entity_id) as cnt FROM kyc_documents 
    WHERE entity_type='customer' AND doc_type IN ('aadhar','pan','photo','sale_deed','maintenance_agreement')
    GROUP BY entity_id HAVING COUNT(DISTINCT doc_type) = 5
  `).all()

  // Pending complaints by employee
  const empWorkload = await db.prepare(`
    SELECT e.name, COUNT(*) as count FROM complaints comp
    JOIN employees e ON comp.assigned_to_employee_id=e.id
    WHERE comp.status IN ('Assigned','Scheduled','In Progress')
    GROUP BY e.id ORDER BY count DESC
  `).all()

  return c.json({
    unit_stats: unitStats,
    complaint_stats: compStats,
    by_category: byCategory.results,
    recent_complaints: recent.results,
    counts: {
      customers: custCount?.cnt || 0,
      employees: empCount?.cnt || 0,
      tenants: tenantCount?.cnt || 0,
      kyc_complete: kycDone.results.length
    },
    employee_workload: empWorkload.results
  })
})

// Employee Dashboard
dashboard.get('/employee', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const db = c.env.DB

  const assigned = await db.prepare(`
    SELECT comp.*, u.unit_no, cc.name as category_name, c.name as customer_name
    FROM complaints comp
    JOIN units u ON comp.unit_id=u.id
    JOIN complaint_categories cc ON comp.category_id=cc.id
    LEFT JOIN customers c ON comp.customer_id=c.id
    WHERE comp.assigned_to_employee_id=? AND comp.status NOT IN ('Resolved','Closed')
    ORDER BY comp.created_at DESC
  `).bind(user.id).all()

  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total_assigned,
      SUM(CASE WHEN status='Assigned' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status='Scheduled' THEN 1 ELSE 0 END) as scheduled,
      SUM(CASE WHEN status='Resolved' THEN 1 ELSE 0 END) as resolved
    FROM complaints WHERE assigned_to_employee_id=?
  `).bind(user.id).first<any>()

  const todayVisits = await db.prepare(`
    SELECT comp.*, u.unit_no, cc.name as category_name, c.name as customer_name
    FROM complaints comp
    JOIN units u ON comp.unit_id=u.id
    JOIN complaint_categories cc ON comp.category_id=cc.id
    LEFT JOIN customers c ON comp.customer_id=c.id
    WHERE comp.assigned_to_employee_id=? AND comp.visit_date=date('now') AND comp.status='Scheduled'
  `).bind(user.id).all()

  return c.json({
    assigned_complaints: assigned.results,
    stats,
    today_visits: todayVisits.results
  })
})

// Customer Dashboard
dashboard.get('/customer', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'customer') return c.json({ error: 'Unauthorized' }, 401)

  const db = c.env.DB

  // Customer details
  const customer = await db.prepare(
    `SELECT c.*, u.unit_no, u.particulars, u.billing_area FROM customers c JOIN units u ON c.unit_id=u.id WHERE c.id=?`
  ).bind(user.id).first<any>()

  // Complaints
  const complaints = await db.prepare(`
    SELECT comp.*, cc.name as category_name, cc.icon as category_icon, e.name as assigned_to_name
    FROM complaints comp
    JOIN complaint_categories cc ON comp.category_id=cc.id
    LEFT JOIN employees e ON comp.assigned_to_employee_id=e.id
    WHERE comp.customer_id=?
    ORDER BY comp.created_at DESC LIMIT 20
  `).bind(user.id).all()

  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status='Open' THEN 1 ELSE 0 END) as open_count,
      SUM(CASE WHEN status='Assigned' OR status='Scheduled' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status='Resolved' OR status='Closed' THEN 1 ELSE 0 END) as resolved
    FROM complaints WHERE customer_id=?
  `).bind(user.id).first<any>()

  // KYC status
  const kycDocs = await db.prepare(`SELECT doc_type FROM kyc_documents WHERE entity_type='customer' AND entity_id=?`).bind(user.id).all()
  const kycTypes = (kycDocs.results as any[]).map(d => d.doc_type)
  const requiredKyc = ['aadhar', 'pan', 'photo', 'sale_deed', 'maintenance_agreement']
  const kycStatus = requiredKyc.reduce((acc: any, t) => { acc[t] = kycTypes.includes(t); return acc }, {})

  // Categories list
  const categories = await db.prepare(`SELECT * FROM complaint_categories WHERE is_active=1 ORDER BY sort_order`).all()

  return c.json({
    customer,
    complaints: complaints.results,
    stats,
    kyc_status: kycStatus,
    categories: categories.results
  })
})

export default dashboard
