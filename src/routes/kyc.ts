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

// ── GET /kyc/tracker/summary  (staff only) ────────────────────
kyc.get('/tracker/summary', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') return c.json({ error: 'Unauthorized' }, 401)

  const ownerStats = await c.env.DB.prepare(`
    SELECT c.id, c.name, u.unit_no,
      SUM(CASE WHEN latest.doc_type='aadhar'                AND latest.status='approved' THEN 1 ELSE 0 END) AS has_aadhar,
      SUM(CASE WHEN latest.doc_type='pan'                   AND latest.status='approved' THEN 1 ELSE 0 END) AS has_pan,
      SUM(CASE WHEN latest.doc_type='photo'                 AND latest.status='approved' THEN 1 ELSE 0 END) AS has_photo,
      SUM(CASE WHEN latest.doc_type='sale_deed'             AND latest.status='approved' THEN 1 ELSE 0 END) AS has_sale_deed,
      SUM(CASE WHEN latest.doc_type='maintenance_agreement' AND latest.status='approved' THEN 1 ELSE 0 END) AS has_maint_agr,
      SUM(CASE WHEN latest.status='pending_review' THEN 1 ELSE 0 END) AS pending_count
    FROM customers c
    JOIN units u ON c.unit_id = u.id
    LEFT JOIN (
      SELECT kdh.entity_id, kdh.doc_type, kdh.status,
             kdh.version
      FROM kyc_document_history kdh
      WHERE kdh.entity_type = 'customer'
        AND kdh.version = (
          SELECT MAX(h2.version) FROM kyc_document_history h2
          WHERE h2.entity_type = kdh.entity_type
            AND h2.entity_id = kdh.entity_id
            AND h2.doc_type = kdh.doc_type
        )
    ) latest ON latest.entity_id = c.id
    WHERE c.is_active = 1
    GROUP BY c.id ORDER BY CAST(u.unit_no AS INTEGER)
  `).all()

  const tenantStats = await c.env.DB.prepare(`
    SELECT t.id, t.name, u.unit_no,
      SUM(CASE WHEN latest.doc_type='tenancy_contract'    AND latest.status='approved' THEN 1 ELSE 0 END) AS has_contract,
      SUM(CASE WHEN latest.doc_type='aadhar'              AND latest.status='approved' THEN 1 ELSE 0 END) AS has_aadhar,
      SUM(CASE WHEN latest.doc_type='pan'                 AND latest.status='approved' THEN 1 ELSE 0 END) AS has_pan,
      SUM(CASE WHEN latest.doc_type='photo'               AND latest.status='approved' THEN 1 ELSE 0 END) AS has_photo,
      SUM(CASE WHEN latest.doc_type='police_verification' AND latest.status='approved' THEN 1 ELSE 0 END) AS has_police,
      SUM(CASE WHEN latest.status='pending_review' THEN 1 ELSE 0 END) AS pending_count,
      t.tenancy_expiry
    FROM tenants t
    JOIN units u ON t.unit_id = u.id
    LEFT JOIN (
      SELECT kdh.entity_id, kdh.doc_type, kdh.status,
             kdh.version
      FROM kyc_document_history kdh
      WHERE kdh.entity_type = 'tenant'
        AND kdh.version = (
          SELECT MAX(h2.version) FROM kyc_document_history h2
          WHERE h2.entity_type = kdh.entity_type
            AND h2.entity_id = kdh.entity_id
            AND h2.doc_type = kdh.doc_type
        )
    ) latest ON latest.entity_id = t.id
    WHERE t.is_active = 1
    GROUP BY t.id ORDER BY CAST(u.unit_no AS INTEGER)
  `).all()

  // Count total pending review items across all entities
  const pendingCount = await c.env.DB.prepare(`
    SELECT COUNT(*) as cnt FROM kyc_document_history
    WHERE status = 'pending_review'
      AND version = (
        SELECT MAX(h2.version) FROM kyc_document_history h2
        WHERE h2.entity_type = kyc_document_history.entity_type
          AND h2.entity_id = kyc_document_history.entity_id
          AND h2.doc_type = kyc_document_history.doc_type
      )
  `).first<any>()

  return c.json({
    owners: ownerStats.results,
    tenants: tenantStats.results,
    owner_total: ownerStats.results.length,
    tenant_total: tenantStats.results.length,
    pending_review_total: pendingCount?.cnt ?? 0,
  })
})

// ── GET /kyc/pending-review  (sub-admin/admin only) ───────────
// Returns all latest-version docs with status='pending_review'
kyc.get('/pending-review', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || !['admin', 'sub_admin'].includes(user.role as string)) {
    return c.json({ error: 'Only admin or sub-admin can review KYC' }, 403)
  }

  const pending = await c.env.DB.prepare(`
    SELECT
      h.id, h.entity_type, h.entity_id, h.doc_type, h.file_name, h.file_data,
      h.remarks, h.version, h.uploaded_at, h.status,
      COALESCE(e.name, cust.name) as uploaded_by_name,
      CASE WHEN h.entity_type='customer' THEN c.name ELSE ten.name END as entity_name,
      CASE WHEN h.entity_type='customer' THEN uc.unit_no ELSE ut.unit_no END as unit_no
    FROM kyc_document_history h
    LEFT JOIN employees e ON h.uploaded_by_employee_id = e.id
    LEFT JOIN customers cust ON h.uploaded_by_customer_id = cust.id
    LEFT JOIN customers c ON h.entity_type='customer' AND h.entity_id = c.id
    LEFT JOIN tenants ten ON h.entity_type='tenant' AND h.entity_id = ten.id
    LEFT JOIN units uc ON c.unit_id = uc.id
    LEFT JOIN units ut ON ten.unit_id = ut.id
    WHERE h.status = 'pending_review'
      AND h.version = (
        SELECT MAX(h2.version) FROM kyc_document_history h2
        WHERE h2.entity_type = h.entity_type
          AND h2.entity_id = h.entity_id
          AND h2.doc_type = h.doc_type
      )
    ORDER BY h.uploaded_at ASC
  `).all()

  const ownerDocLabels = OWNER_DOC_TYPES
  const tenantDocLabels = TENANT_DOC_TYPES

  return c.json({
    pending: pending.results,
    owner_doc_labels: ownerDocLabels,
    tenant_doc_labels: tenantDocLabels,
    count: pending.results.length,
  })
})

// ── GET /kyc/history/:entityType/:entityId  (staff only) ──────
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
           h.version, h.uploaded_at, h.status, h.reviewed_at, h.review_remarks,
           e.name as uploaded_by_name, e.id as uploaded_by_id,
           re.name as reviewed_by_name
    FROM kyc_document_history h
    LEFT JOIN employees e ON h.uploaded_by_employee_id = e.id
    LEFT JOIN employees re ON h.reviewed_by_employee_id = re.id
    WHERE h.entity_type = ? AND h.entity_id = ?
    ORDER BY h.uploaded_at DESC
  `).bind(entityType, id).all()

  const auditItems = await c.env.DB.prepare(`
    SELECT * FROM audit_logs
    WHERE entity_type = ? AND entity_id = ?
      AND action IN ('kyc_uploaded','kyc_deleted','kyc_approved','kyc_rejected','kyc_self_upload')
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
// Accessible by staff (employees) OR the resident themselves (customer type)
kyc.get('/:entityType/:entityId', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const { entityType, entityId } = c.req.param()
  const id = parseInt(entityId)
  if (!['customer', 'tenant'].includes(entityType) || !id) {
    return c.json({ error: 'Invalid entity' }, 400)
  }

  // Residents can only see their own KYC
  if (user.type === 'customer') {
    if (entityType !== 'customer' || user.id !== id) {
      return c.json({ error: 'Access denied' }, 403)
    }
  }

  const allowedTypes = entityType === 'customer' ? OWNER_DOC_TYPES : TENANT_DOC_TYPES

  // Current active documents: one per doc_type (latest version, any status)
  const currentDocs = await c.env.DB.prepare(`
    SELECT h.id, h.doc_type, h.file_name, h.file_data, h.remarks,
           h.version, h.uploaded_at, h.status, h.review_remarks, h.reviewed_at,
           e.name as uploaded_by_name, re.name as reviewed_by_name
    FROM kyc_document_history h
    LEFT JOIN employees e ON h.uploaded_by_employee_id = e.id
    LEFT JOIN employees re ON h.reviewed_by_employee_id = re.id
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
           h.version, h.uploaded_at, h.status, h.review_remarks, h.reviewed_at,
           e.name as uploaded_by_name, re.name as reviewed_by_name
    FROM kyc_document_history h
    LEFT JOIN employees e ON h.uploaded_by_employee_id = e.id
    LEFT JOIN employees re ON h.reviewed_by_employee_id = re.id
    WHERE h.entity_type = ? AND h.entity_id = ?
    ORDER BY h.doc_type ASC, h.version DESC
  `).bind(entityType, id).all()

  // Completion counts only approved docs
  const approvedTypes = new Set(
    (currentDocs.results as any[])
      .filter(d => d.status === 'approved')
      .map(d => d.doc_type)
  )
  const requiredTypes = Object.keys(allowedTypes)
  const missing = requiredTypes.filter(t => !approvedTypes.has(t))
  const completionPct = requiredTypes.length
    ? Math.round((approvedTypes.size / requiredTypes.length) * 100)
    : 0

  // Count pending items (latest version awaiting review)
  const pendingItems = (currentDocs.results as any[]).filter(d => d.status === 'pending_review')

  return c.json({
    current_documents: currentDocs.results,
    history: history.results,
    doc_type_labels: allowedTypes,
    required_types: requiredTypes,
    uploaded_types: Array.from(approvedTypes),
    missing_types: missing,
    pending_review: pendingItems,
    completion_percentage: completionPct,
    is_complete: missing.length === 0,
  })
})

// ── POST /kyc/self/:entityType/:entityId ──────────────────────
// Resident self-upload: creates 'pending_review' document
kyc.post('/self/:entityType/:entityId', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'customer') {
    return c.json({ error: 'Only residents can use this endpoint' }, 403)
  }

  const { entityType, entityId } = c.req.param()
  const id = parseInt(entityId)

  // Residents can only upload for themselves
  if (entityType !== 'customer' || user.id !== id) {
    return c.json({ error: 'You can only upload your own KYC documents' }, 403)
  }

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

  // Insert with status 'pending_review' and uploaded_by_customer_id
  const insertResult = await c.env.DB.prepare(`
    INSERT INTO kyc_document_history
      (entity_type, entity_id, doc_type, file_name, file_data, remarks, version,
       status, uploaded_by_customer_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_review', ?)
  `).bind(
    entityType, id, doc_type,
    file_name || doc_type,
    file_data,
    remarks || null,
    nextVersion,
    user.id
  ).run()

  const docLabel = (entityType === 'customer' ? OWNER_DOC_TYPES : TENANT_DOC_TYPES)[doc_type] || doc_type

  // Audit log
  await auditLog(
    c.env.DB, 'kyc_self_upload', entityType, id,
    `Resident self-uploaded: ${docLabel} (v${nextVersion}) — pending review`,
    'customer', user.id as number, user.name as string
  )

  return c.json({
    message: `${docLabel} submitted for review. You will be notified once it's approved.`,
    version: nextVersion,
    status: 'pending_review',
    history_id: insertResult.meta.last_row_id,
  })
})

// ── POST /kyc/review/:historyId ───────────────────────────────
// Sub-admin / admin: approve or reject a pending document
kyc.post('/review/:historyId', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee' || !['admin', 'sub_admin'].includes(user.role as string)) {
    return c.json({ error: 'Only admin or sub-admin can review KYC documents' }, 403)
  }

  const historyId = parseInt(c.req.param('historyId'))
  if (!historyId) return c.json({ error: 'Invalid history ID' }, 400)

  const body = await c.req.json()
  const { action, remarks } = body // action: 'approve' | 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return c.json({ error: "action must be 'approve' or 'reject'" }, 400)
  }

  // Get the history record
  const doc = await c.env.DB.prepare(
    `SELECT * FROM kyc_document_history WHERE id = ?`
  ).bind(historyId).first<any>()

  if (!doc) return c.json({ error: 'Document not found' }, 404)
  if (doc.status !== 'pending_review') {
    return c.json({ error: `Document is already ${doc.status}` }, 400)
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected'

  // Update status in history
  await c.env.DB.prepare(`
    UPDATE kyc_document_history
    SET status = ?, reviewed_by_employee_id = ?, reviewed_at = CURRENT_TIMESTAMP, review_remarks = ?
    WHERE id = ?
  `).bind(newStatus, user.id, remarks || null, historyId).run()

  const docLabel = (doc.entity_type === 'customer' ? OWNER_DOC_TYPES : TENANT_DOC_TYPES)[doc.doc_type] || doc.doc_type

  if (action === 'approve') {
    // Sync to kyc_documents (latest slot) only for approved docs
    const existing = await c.env.DB.prepare(
      `SELECT id FROM kyc_documents WHERE entity_type=? AND entity_id=? AND doc_type=?`
    ).bind(doc.entity_type, doc.entity_id, doc.doc_type).first<any>()

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE kyc_documents
         SET file_name=?, file_data=?, uploaded_at=CURRENT_TIMESTAMP, uploaded_by_employee_id=?, status='approved'
         WHERE id=?`
      ).bind(doc.file_name || doc.doc_type, doc.file_data, user.id, existing.id).run()
    } else {
      await c.env.DB.prepare(
        `INSERT INTO kyc_documents (entity_type, entity_id, doc_type, file_name, file_data, uploaded_by_employee_id, status)
         VALUES (?, ?, ?, ?, ?, ?, 'approved')`
      ).bind(doc.entity_type, doc.entity_id, doc.doc_type, doc.file_name || doc.doc_type, doc.file_data, user.id).run()
    }

    // Send notification to customer if uploaded by resident
    if (doc.uploaded_by_customer_id) {
      try {
        await c.env.DB.prepare(`
          INSERT INTO notifications (user_type, user_id, type, title, message)
          VALUES ('customer', ?, 'kyc_approved', 'KYC Document Approved', ?)
        `).bind(
          doc.uploaded_by_customer_id,
          `Your ${docLabel} has been approved and added to your KYC profile.`
        ).run()
      } catch (_) { /* notification table may differ */ }
    }
  } else {
    // Rejected — notify customer
    if (doc.uploaded_by_customer_id) {
      try {
        await c.env.DB.prepare(`
          INSERT INTO notifications (user_type, user_id, type, title, message)
          VALUES ('customer', ?, 'kyc_rejected', 'KYC Document Rejected', ?)
        `).bind(
          doc.uploaded_by_customer_id,
          `Your ${docLabel} was not accepted. ${remarks ? 'Reason: ' + remarks : 'Please re-upload a clearer copy.'}`
        ).run()
      } catch (_) { /* ignore */ }
    }
  }

  // Audit log
  await auditLog(
    c.env.DB, action === 'approve' ? 'kyc_approved' : 'kyc_rejected',
    doc.entity_type, doc.entity_id,
    `KYC ${action === 'approve' ? 'approved' : 'rejected'}: ${docLabel} (v${doc.version})${remarks ? ' — ' + remarks : ''}`,
    'employee', user.id as number, user.name as string
  )

  // Property history trail
  const unitId = await getUnitId(c.env.DB, doc.entity_type, doc.entity_id)
  if (unitId) {
    await c.env.DB.prepare(`
      INSERT INTO property_history (unit_id, event_type, description, changed_by_employee_id)
      VALUES (?, 'kyc_update', ?, ?)
    `).bind(
      unitId,
      `${doc.entity_type === 'customer' ? 'Owner' : 'Tenant'} KYC ${action === 'approve' ? 'approved' : 'rejected'}: ${docLabel} (v${doc.version}) by ${user.name}`,
      user.id
    ).run()
  }

  return c.json({
    message: `${docLabel} ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    status: newStatus,
  })
})

// ── POST /kyc/:entityType/:entityId ───────────────────────────
// Staff upload: always 'approved' immediately (no review needed)
kyc.post('/:entityType/:entityId', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user || user.type !== 'employee') {
    return c.json({ error: 'Only staff can upload KYC documents directly' }, 403)
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

  // Staff uploads are auto-approved
  const insertResult = await c.env.DB.prepare(`
    INSERT INTO kyc_document_history
      (entity_type, entity_id, doc_type, file_name, file_data, remarks, version,
       status, uploaded_by_employee_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?)
  `).bind(
    entityType, id, doc_type,
    file_name || doc_type,
    file_data,
    remarks || null,
    nextVersion,
    user.id
  ).run()

  // Keep kyc_documents table in sync
  const existing = await c.env.DB.prepare(
    `SELECT id FROM kyc_documents WHERE entity_type=? AND entity_id=? AND doc_type=?`
  ).bind(entityType, id, doc_type).first<any>()

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE kyc_documents
       SET file_name=?, file_data=?, uploaded_at=CURRENT_TIMESTAMP, uploaded_by_employee_id=?, status='approved'
       WHERE id=?`
    ).bind(file_name || doc_type, file_data, user.id, existing.id).run()
  } else {
    await c.env.DB.prepare(
      `INSERT INTO kyc_documents (entity_type, entity_id, doc_type, file_name, file_data, uploaded_by_employee_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'approved')`
    ).bind(entityType, id, doc_type, file_name || doc_type, file_data, user.id).run()
  }

  const docLabel = (entityType === 'customer' ? OWNER_DOC_TYPES : TENANT_DOC_TYPES)[doc_type] || doc_type
  await auditLog(
    c.env.DB, 'kyc_uploaded', entityType, id,
    `KYC uploaded: ${docLabel} (v${nextVersion}) for ${entityType} #${id}`,
    'employee', user.id as number, user.name as string
  )

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
