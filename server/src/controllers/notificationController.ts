import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'

// ─── Get Notifications ──────────────────────────────────────
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.id]
    )

    const [[{ unread }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = FALSE`,
      [user.id]
    )

    res.json({ success: true, data: rows, unread })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Mark All as Read ───────────────────────────────────────
export const markAllRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    await pool.query<ResultSetHeader>(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = ?`,
      [user.id]
    )
    res.json({ success: true, message: 'All notifications marked as read.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Mark Single as Read ─────────────────────────────────────
export const markOneRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?`,
      [id, user.id]
    )
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── SSE Stream ─────────────────────────────────────────────
// Clients connect to GET /api/notifications/stream and receive
// real-time push when new notifications arrive.
export const notificationStream = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  const poll = async () => {
    const [[{ unread }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = FALSE`,
      [user.id]
    )
    send({ unread })
  }

  await poll()
  const interval = setInterval(poll, 30_000)

  req.on('close', () => {
    clearInterval(interval)
    res.end()
  })
}
