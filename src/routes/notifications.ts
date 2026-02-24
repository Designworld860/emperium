import { Hono } from 'hono'
import { getAuthUser } from '../lib/auth'

type Bindings = { DB: D1Database }
const notifications = new Hono<{ Bindings: Bindings }>()

// Get notifications for current user
notifications.get('/', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const result = await c.env.DB.prepare(
    `SELECT * FROM notifications WHERE recipient_type=? AND recipient_id=? ORDER BY created_at DESC LIMIT 50`
  ).bind(user.type, user.id).all()

  const unread = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM notifications WHERE recipient_type=? AND recipient_id=? AND is_read=0`
  ).bind(user.type, user.id).first<any>()

  return c.json({ notifications: result.results, unread_count: unread?.cnt || 0 })
})

// Mark as read
notifications.post('/read-all', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  await c.env.DB.prepare(
    `UPDATE notifications SET is_read=1 WHERE recipient_type=? AND recipient_id=?`
  ).bind(user.type, user.id).run()

  return c.json({ message: 'All notifications marked as read' })
})

notifications.post('/:id/read', async (c) => {
  const user = getAuthUser(c.req.header('Authorization') || null)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  await c.env.DB.prepare(`UPDATE notifications SET is_read=1 WHERE id=? AND recipient_type=? AND recipient_id=?`)
    .bind(c.req.param('id'), user.type, user.id).run()

  return c.json({ message: 'Marked as read' })
})

export default notifications
