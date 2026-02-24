// Database helper utilities

export async function auditLog(
  db: D1Database,
  action: string,
  entityType: string,
  entityId: number | null,
  description: string,
  actorType: string,
  actorId: number,
  actorName: string
) {
  await db.prepare(`
    INSERT INTO audit_logs (action, entity_type, entity_id, description, actor_type, actor_id, actor_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(action, entityType, entityId, description, actorType, actorId, actorName).run()
}

export async function createNotification(
  db: D1Database,
  recipientType: string,
  recipientId: number,
  title: string,
  message: string,
  type: string = 'info',
  complaintId?: number
) {
  await db.prepare(`
    INSERT INTO notifications (recipient_type, recipient_id, title, message, type, complaint_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(recipientType, recipientId, title, message, type, complaintId || null).run()
}

export function generateComplaintNo(): string {
  const now = new Date()
  const yr = now.getFullYear().toString().slice(-2)
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `EC-${yr}${mo}${day}-${rand}`
}
