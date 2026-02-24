import { Hono } from 'hono'
import { getAuthUser } from '../lib/auth'
import { auditLog } from '../lib/db'

type Bindings = { DB: D1Database }
const kyc = new Hono<{ Bindings: Bindings }>()

// ── Document type definitions ─────────────────────────────────
const OWNER_DOC_TYPES: Record<string, string> = {
  aadhar: 'Aadhar Card',
  pan: 'PAN Card',
  photo: 'Photograph',
  sale_deed: 'Sale Deed',
  maintenance_agreement: 'Maintenance Agreement',
}

const TENANT_DOC_TYPES: Record<string, string> = {
  tenancy_contract: 'Tenancy Contract',
  aadhar: 'Aadhar Card',
  pan: 'PAN Card',
  photo: 'Photograph',
  police_verification: 'Police Verification',
}

// ── GET /kyc/tracker/summary  (MUST be before /:entityType/:entityId) ──────
kyc.get('/tracker/summary', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  // Use kyc_document_history latest version for each doc_type per entity
  const ownerStats = await c.env.DB.prepare(`
    SELECT c.id, c.name, u.unit_no,
      SUM(CASE WHEN latest.doc_type='aadhar'                THEN 1 ELSE 0 END) AS has_aadhar,
      SUM(CASE WHEN latest.doc_type='pan'                   THEN 1 ELSE 0 END) AS has_pan,
      SUM(CASE WHEN latest.doc_type='photo'                 THEN 1 ELSE 0 END) AS has_photo,
      SUM(CASE WHEN latest.doc_type='sale_deed'             THEN 1 ELSE 0 END) AS has_sale_deed,
      SUM(CASE WHEN latest.doc_type='maintenance_agreement' THEN 1 ELSE 0 END) AS has_maint_agr
    FROM customers c
    JOIN units u ON c.unit_id = u.id
    LEFT JOIN (
      SELECT entity_id, doc_type, MAX(version) AS max_ver
      FROM kyc_document_history
      WHERE entity_type = 'customer'
      GROUP BY entity_id, doc_type
    ) latest ON latest.entity_id = c.id
    WHERE c.is_active = 1
    GROUP BY c.id ORDER BY CAST(u.unit_no AS INTEGER)
  `).all()

  const tenantStats = await c.env.DB.prepare(`
    SELECT t.id, t.name, u.unit_no,
      SUM(CASE WHEN latest.doc_type='tenancy_contract'    THEN 1 ELSE 0 END) AS has_contract,
      SUM(CASE WHEN latest.doc_type='aadhar'              THEN 1 ELSE 0 END) AS has_aadhar,
      SUM(CASE WHEN latest.doc_type='pan'                 THEN 1 ELSE 0 END) AS has_pan,
      SUM(CASE WHEN latest.doc_type='photo'               THEN 1 ELSE 0 END) AS has_photo,
      SUM(CASE WHEN latest.doc_type='police_verification' THEN 1 ELSE 0 END) AS has_police,
      t.tenancy_expiry
    FROM tenants t
    JOIN units u ON t.unit_id = u.id
    LEFT JOIN (
      SELECT entity_id, doc_type, MAX(version) AS max_ver
      FROM kyc_document_history
      WHERE entity_type = 'tenant'
      GROUP BY entity_id, doc_type
    ) latest ON latest.entity_id = t.id
    WHERE t.is_active = 1
    GROUP BY t.id ORDER BY CAST(u.unit_no AS INTEGER)
  `).all()

  return c.json({
    owners: ownerStats.results,
    tenants: tenantStats.results,
    owner_total: ownerStats.results.length,
    tenant_total: tenantStats.results.length,
  })
})

// ── GET /kyc/history/:entityType/:entityId  (MUST be before /:entityType/:entityId) ──
kyc.get('/history/:entityType/:entityId', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const { entityType, entityId } = c.req.param()
  const id = parseInt(entityId)
  if (!['customer', 'tenant'].includes(entityType) || !id) {
    return c.json({ error: 'Invalid entity' }, 400)
  }

  const history = await c.env.DB.prepare(`
    SELECT h.id, h.doc_type, h.file_name, h.file_data, h.remarks,
           h.version, h.uploaded_at, e.name as uploaded_by_name, e.id as uploaded_by_id
    FROM kyc_document_history h
    LEFT JOIN employees e ON h.uploaded_by_employee_id = e.id
    WHERE h.entity_type = ? AND h.entity_id = ?
    ORDER BY h.uploaded_at DESC
  `).bind(entityType, id).all()

  const auditItems = await c.env.DB.prepare(`
    SELECT * FROM audit_logs
    WHERE entity_type = ? AND entity_id = ?
      AND action IN ('kyc_uploaded','kyc_deleted')
    ORDER BY created_at DESC
  `).bind(entityType, id).all()

  const allowedTypes = entityType === 'customer' ? OWNER_DOC_TYPES : TENANT_DOC_TYPES

  return c.json({
    history: history.results,
    audit_trail: auditItems.results,
    doc_type_labels: allowedTypes,
  })
})

// ── GET /kyc/:entityType/:entityId ─────────────────────────────
// Returns current (latest) doc per type + full history + completion stats
kyc.get('/:entityType/:entityId', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { entityType, entityId } = c.req.param()
  const id = parseInt(entityId)
  if (!['customer', 'tenant'].includes(entityType) || !id) {
    return c.json({ error: 'Invalid entity' }, 400)
  }

  const allowedTypes = entityType === 'customer' ? OWNER_DOC_TYPES : TENANT_DOC_TYPES

  // Current active documents: one per doc_type (latest version)
  const currentDocs = await c.env.DB.prepare(`
    SELECT h.id, h.doc_type, h.file_name, h.file_data, h.remarks,
           h.version, h.uploaded_at, e.name as uploaded_by_name
    FROM kyc_document_history h
    LEFT JOIN employees e ON h.uploaded_by_employee_id = e.id
    WHERE h.entity_type = ? AND h.entity_id = ?
      AND h.version = (
        SELECT MAX(h2.version) FROM kyc_document_history h2
        WHERE h2.entity_type = h.entity_type
          AND h2.entity_id = h.entity_id
          AND h2.doc_type = h.doc_type
      )
    ORDER BY h.doc_type
  `).bind(entityType, id).all()

  // Full history — all versions of all documents, newest first
  const history = await c.env.DB.prepare(`
    SELECT h.id, h.doc_type, h.file_name, h.file_data, h.remarks,
           h.version, h.uploaded_at, e.name as uploaded_by_name
    FROM kyc_document_history h
    LEFT JOIN employees e ON h.uploaded_by_employee_id = e.id
    WHERE h.entity_type = ? AND h.entity_id = ?
    ORDER BY h.doc_type ASC, h.version DESC
  `).bind(entityType, id).all()

  // Completion
  const uploadedTypes = new Set((currentDocs.results as any[]).map(d => d.doc_type))
  const requiredTypes = Object.keys(allowedTypes)
  const missing = requiredTypes.filter(t => !uploadedTypes.has(t))
  const completionPct = requiredTypes.length
    ? Math.round((uploadedTypes.size / requiredTypes.length) * 100)
    : 0

  return c.json({
    current_documents: currentDocs.results,
    history: history.results,
    doc_type_labels: allowedTypes,
    required_types: requiredTypes,
    uploaded_types: Array.from(uploadedTypes),
    missing_types: missing,
    completion_percentage: completionPct,
    is_complete: missing.length === 0,
  })
})

// ── POST /kyc/:entityType/:entityId ───────────────────────────
// Upload a new document (or new version). Every call creates a NEW history row.
kyc.post('/:entityType/:entityId', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') {
    return c.json({ error: 'Only staff can upload KYC documents' }, 403)
  }

  const { entityType, entityId } = c.req.param()
  const id = parseInt(entityId)
  if (!['customer', 'tenant'].includes(entityType) || !id) {
    return c.json({ error: 'Invalid entity' }, 400)
  }

  const body = await c.req.json()
  const { doc_type, file_name, file_data, remarks } = body

  if (!doc_type || !file_data) {
    return c.json({ error: 'doc_type and file_data are required' }, 400)
  }

  const allowedTypes = entityType === 'customer'
    ? Object.keys(OWNER_DOC_TYPES)
    : Object.keys(TENANT_DOC_TYPES)

  if (!allowedTypes.includes(doc_type)) {
    return c.json({ error: `Invalid doc_type. Allowed: ${allowedTypes.join(', ')}` }, 400)
  }

  // Determine next version number
  const latest = await c.env.DB.prepare(`
    SELECT COALESCE(MAX(version), 0) as max_ver
    FROM kyc_document_history
    WHERE entity_type = ? AND entity_id = ? AND doc_type = ?
  `).bind(entityType, id, doc_type).first<any>()

  const nextVersion = (latest?.max_ver ?? 0) + 1

  // Insert new history row (immutable — never deleted)
  const insertResult = await c.env.DB.prepare(`
    INSERT INTO kyc_document_history
      (entity_type, entity_id, doc_type, file_name, file_data, remarks, version, uploaded_by_employee_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    entityType, id, doc_type,
    file_name || doc_type,
    file_data,
    remarks || null,
    nextVersion,
    user.id
  ).run()

  // Keep kyc_documents table in sync (latest version only — for legacy tracker queries)
  const existing = await c.env.DB.prepare(
    `SELECT id FROM kyc_documents WHERE entity_type=? AND entity_id=? AND doc_type=?`
  ).bind(entityType, id, doc_type).first<any>()

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE kyc_documents
       SET file_name=?, file_data=?, uploaded_at=CURRENT_TIMESTAMP, uploaded_by_employee_id=?
       WHERE id=?`
    ).bind(file_name || doc_type, file_data, user.id, existing.id).run()
  } else {
    await c.env.DB.prepare(
      `INSERT INTO kyc_documents (entity_type, entity_id, doc_type, file_name, file_data, uploaded_by_employee_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(entityType, id, doc_type, file_name || doc_type, file_data, user.id).run()
  }

  // Audit log
  const docLabel = (entityType === 'customer' ? OWNER_DOC_TYPES : TENANT_DOC_TYPES)[doc_type] || doc_type
  await auditLog(
    c.env.DB, 'kyc_uploaded', entityType, id,
    `KYC uploaded: ${docLabel} (v${nextVersion}) for ${entityType} #${id}`,
    'employee', user.id as number, user.name as string
  )

  // Property-history trail
  const unitId = await getUnitId(c.env.DB, entityType, id)
  if (unitId) {
    await c.env.DB.prepare(`
      INSERT INTO property_history (unit_id, event_type, description, changed_by_employee_id)
      VALUES (?, 'kyc_update', ?, ?)
    `).bind(
      unitId,
      `${entityType === 'customer' ? 'Owner' : 'Tenant'} KYC uploaded: ${docLabel} (v${nextVersion}) by ${user.name}`,
      user.id
    ).run()
  }

  return c.json({
    message: `${docLabel} uploaded successfully (version ${nextVersion})`,
    version: nextVersion,
    history_id: insertResult.meta.last_row_id,
  })
})

// ── DELETE /kyc/:entityType/:entityId/:docType ────────────────
// Soft-delete: removes from kyc_documents (active slot).
// History rows in kyc_document_history are NEVER deleted.
kyc.delete('/:entityType/:entityId/:docType', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || !['admin', 'sub_admin'].includes(user.role as string)) {
    return c.json({ error: 'Only admin or sub-admin can remove KYC documents' }, 403)
  }

  const { entityType, entityId, docType } = c.req.param()
  const id = parseInt(entityId)

  await c.env.DB.prepare(
    `DELETE FROM kyc_documents WHERE entity_type=? AND entity_id=? AND doc_type=?`
  ).bind(entityType, id, docType).run()

  const docLabel = (entityType === 'customer' ? OWNER_DOC_TYPES : TENANT_DOC_TYPES)[docType] || docType
  await auditLog(
    c.env.DB, 'kyc_deleted', entityType, id,
    `KYC active document removed: ${docLabel}. History preserved.`,
    'employee', user.id as number, user.name as string
  )

  const unitId = await getUnitId(c.env.DB, entityType, id)
  if (unitId) {
    await c.env.DB.prepare(`
      INSERT INTO property_history (unit_id, event_type, description, changed_by_employee_id)
      VALUES (?, 'kyc_update', ?, ?)
    `).bind(unitId, `${entityType === 'customer' ? 'Owner' : 'Tenant'} KYC removed: ${docLabel}`, user.id).run()
  }

  return c.json({ message: `${docLabel} removed from active KYC. Full history preserved.` })
})

// ── Helper ─────────────────────────────────────────────────────
async function getUnitId(db: D1Database, entityType: string, entityId: number): Promise<number | null> {
  if (entityType === 'customer') {
    const r = await db.prepare(`SELECT unit_id FROM customers WHERE id=?`).bind(entityId).first<any>()
    return r?.unit_id ?? null
  }
  if (entityType === 'tenant') {
    const r = await db.prepare(`SELECT unit_id FROM tenants WHERE id=?`).bind(entityId).first<any>()
    return r?.unit_id ?? null
  }
  return null
}

export default kyc
