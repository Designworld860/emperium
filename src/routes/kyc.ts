import { Hono } from 'hono'
import { getAuthUser } from '../lib/auth'
import { auditLog } from '../lib/db'

type Bindings = { DB: D1Database }
const kyc = new Hono<{ Bindings: Bindings }>()

const OWNER_DOC_TYPES = ['aadhar', 'pan', 'photo', 'sale_deed', 'maintenance_agreement']
const TENANT_DOC_TYPES = ['tenancy_contract', 'aadhar', 'pan', 'photo', 'police_verification']

// Get KYC for entity
kyc.get('/:entityType/:entityId', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { entityType, entityId } = c.req.param()
  const docs = await c.env.DB.prepare(
    `SELECT id, doc_type, file_name, uploaded_at FROM kyc_documents WHERE entity_type=? AND entity_id=?`
  ).bind(entityType, entityId).all()

  const required = entityType === 'customer' ? OWNER_DOC_TYPES : TENANT_DOC_TYPES
  const uploaded = (docs.results as any[]).map(d => d.doc_type)
  const missing = required.filter(t => !uploaded.includes(t))
  const completionPct = Math.round((uploaded.length / required.length) * 100)

  return c.json({
    documents: docs.results,
    required_types: required,
    uploaded_types: uploaded,
    missing_types: missing,
    completion_percentage: completionPct,
    is_complete: missing.length === 0
  })
})

// Upload KYC document
kyc.post('/:entityType/:entityId', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Only staff can upload KYC' }, 401)

  const { entityType, entityId } = c.req.param()
  const body = await c.req.json()
  const { doc_type, file_name, file_data } = body

  if (!doc_type || !file_data) return c.json({ error: 'doc_type and file_data required' }, 400)

  const validTypes = entityType === 'customer' ? OWNER_DOC_TYPES : TENANT_DOC_TYPES
  if (!validTypes.includes(doc_type)) return c.json({ error: 'Invalid document type' }, 400)

  // Check if doc already exists - update it
  const existing = await c.env.DB.prepare(
    `SELECT id FROM kyc_documents WHERE entity_type=? AND entity_id=? AND doc_type=?`
  ).bind(entityType, entityId, doc_type).first<any>()

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE kyc_documents SET file_name=?, file_data=?, uploaded_at=CURRENT_TIMESTAMP, uploaded_by_employee_id=? WHERE id=?`
    ).bind(file_name || doc_type, file_data, user.id, existing.id).run()
  } else {
    await c.env.DB.prepare(
      `INSERT INTO kyc_documents (entity_type, entity_id, doc_type, file_name, file_data, uploaded_by_employee_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(entityType, entityId, doc_type, file_name || doc_type, file_data, user.id).run()
  }

  await auditLog(c.env.DB, 'kyc_uploaded', entityType, parseInt(entityId),
    `KYC document uploaded: ${doc_type}`, 'employee', user.id as number, user.name as string)

  // Update property history
  if (entityType === 'customer') {
    const cust = await c.env.DB.prepare(`SELECT unit_id FROM customers WHERE id=?`).bind(entityId).first<any>()
    if (cust) {
      await c.env.DB.prepare(
        `INSERT INTO property_history (unit_id, event_type, description, changed_by_employee_id) VALUES (?, 'kyc_update', ?, ?)`
      ).bind(cust.unit_id, `Owner KYC uploaded: ${doc_type}`, user.id).run()
    }
  }

  return c.json({ message: `KYC document '${doc_type}' uploaded successfully` })
})

// Delete KYC document
kyc.delete('/:entityType/:entityId/:docType', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || !['admin', 'sub_admin'].includes(user.role as string)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const { entityType, entityId, docType } = c.req.param()
  await c.env.DB.prepare(
    `DELETE FROM kyc_documents WHERE entity_type=? AND entity_id=? AND doc_type=?`
  ).bind(entityType, entityId, docType).run()

  return c.json({ message: 'Document deleted' })
})

// KYC Tracker - overview
kyc.get('/tracker/summary', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  // Owner KYC completion
  const ownerStats = await c.env.DB.prepare(`
    SELECT c.id, c.name, u.unit_no,
      SUM(CASE WHEN kd.doc_type = 'aadhar' THEN 1 ELSE 0 END) as has_aadhar,
      SUM(CASE WHEN kd.doc_type = 'pan' THEN 1 ELSE 0 END) as has_pan,
      SUM(CASE WHEN kd.doc_type = 'photo' THEN 1 ELSE 0 END) as has_photo,
      SUM(CASE WHEN kd.doc_type = 'sale_deed' THEN 1 ELSE 0 END) as has_sale_deed,
      SUM(CASE WHEN kd.doc_type = 'maintenance_agreement' THEN 1 ELSE 0 END) as has_maint_agr
    FROM customers c
    JOIN units u ON c.unit_id = u.id
    LEFT JOIN kyc_documents kd ON kd.entity_type='customer' AND kd.entity_id=c.id
    WHERE c.is_active=1
    GROUP BY c.id ORDER BY CAST(u.unit_no AS INTEGER)
  `).all()

  // Tenant KYC completion
  const tenantStats = await c.env.DB.prepare(`
    SELECT t.id, t.name, u.unit_no,
      SUM(CASE WHEN kd.doc_type = 'tenancy_contract' THEN 1 ELSE 0 END) as has_contract,
      SUM(CASE WHEN kd.doc_type = 'aadhar' THEN 1 ELSE 0 END) as has_aadhar,
      SUM(CASE WHEN kd.doc_type = 'pan' THEN 1 ELSE 0 END) as has_pan,
      SUM(CASE WHEN kd.doc_type = 'photo' THEN 1 ELSE 0 END) as has_photo,
      SUM(CASE WHEN kd.doc_type = 'police_verification' THEN 1 ELSE 0 END) as has_police,
      t.tenancy_expiry
    FROM tenants t
    JOIN units u ON t.unit_id = u.id
    LEFT JOIN kyc_documents kd ON kd.entity_type='tenant' AND kd.entity_id=t.id
    WHERE t.is_active=1
    GROUP BY t.id ORDER BY CAST(u.unit_no AS INTEGER)
  `).all()

  return c.json({
    owners: ownerStats.results,
    tenants: tenantStats.results,
    owner_total: ownerStats.results.length,
    tenant_total: tenantStats.results.length
  })
})

export default kyc
