import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import path from 'path'
import fs   from 'fs'
import { getEffectiveAttorneyId } from '../utils/scope'

// â”€â”€â”€ Get Conversations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         partner.id               AS partner_id,
         partner.fullname         AS partner_name,
         partner.username         AS partner_username,
         partner.role             AS partner_role,
         last_msg.content         AS last_message,
         last_msg.attachment_name AS last_attachment,
         last_msg.created_at      AS last_at,
         SUM(
           CASE WHEN m2.receiver_id = ? AND m2.is_read = FALSE AND m2.deleted_for_all = 0 THEN 1 ELSE 0 END
         ) AS unread_count
       FROM (
         SELECT DISTINCT IF(sender_id = ?, receiver_id, sender_id) AS other_id
         FROM messages
         WHERE sender_id = ? OR receiver_id = ?
       ) AS convs
       JOIN users AS partner ON partner.id = convs.other_id
       JOIN messages AS m2
         ON (m2.sender_id = convs.other_id AND m2.receiver_id = ?)
         OR (m2.sender_id = ? AND m2.receiver_id = convs.other_id)
       JOIN messages AS last_msg
         ON last_msg.id = (
           SELECT id FROM messages
           WHERE ((sender_id = ? AND receiver_id = convs.other_id)
              OR (sender_id = convs.other_id AND receiver_id = ?))
             AND deleted_for_all = 0
           ORDER BY created_at DESC LIMIT 1
         )
       GROUP BY partner.id, partner.fullname, partner.username, partner.role,
                last_msg.content, last_msg.attachment_name, last_msg.created_at
       ORDER BY last_msg.created_at DESC`,
      Array(8).fill(user.id)
    )

    // Apply per-user conversation soft-delete in application layer
    const [deletions] = await pool.query<RowDataPacket[]>(
      'SELECT partner_id, deleted_at FROM conversation_deletions WHERE user_id = ?',
      [user.id]
    )
    const delMap = new Map<number, Date>(
      (deletions as any[]).map((d: any) => [d.partner_id, new Date(d.deleted_at)])
    )

    const filtered = (rows as any[]).filter((conv: any) => {
      const delAt = delMap.get(conv.partner_id)
      if (!delAt) return true
      // Re-show if there is a newer message after deletion
      return new Date(conv.last_at) > delAt
    })

    res.json({ success: true, data: filtered })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// â”€â”€â”€ Get Message Thread â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getThread = async (req: Request, res: Response): Promise<void> => {
  try {
    const user      = (req as any).user
    const partnerId = parseInt(req.params.partnerId)

    // Check if user deleted this conversation to know time cutoff
    const [[deletion]] = await pool.query<RowDataPacket[]>(
      'SELECT deleted_at FROM conversation_deletions WHERE user_id = ? AND partner_id = ?',
      [user.id, partnerId]
    )
    const cutoff = (deletion as any)?.deleted_at ?? null

    const params: any[] = [user.id, partnerId, partnerId, user.id, user.id, user.id]
    if (cutoff) params.push(cutoff)

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at,
              m.attachment_path, m.attachment_name, m.attachment_mime, m.edited_at,
              m.sent_on_behalf_of,
              u.fullname AS sender_name,
              a.fullname AS attorney_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       LEFT JOIN users a ON m.sent_on_behalf_of = a.id
       WHERE ((m.sender_id = ? AND m.receiver_id = ?)
          OR  (m.sender_id = ? AND m.receiver_id = ?))
         AND m.deleted_for_all = 0
         AND NOT (m.deleted_for_sender   = 1 AND m.sender_id   = ?)
         AND NOT (m.deleted_for_receiver = 1 AND m.receiver_id = ?)
         ${cutoff ? 'AND m.created_at > ?' : ''}
       ORDER BY m.created_at ASC`,
      params
    )

    // Mark received messages as read
    await pool.query(
      'UPDATE messages SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE',
      [partnerId, user.id]
    )

    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// â”€â”€â”€ Send Message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { receiver_id, content, case_id } = req.body
    const file = (req as any).file

    if (!receiver_id || (!content?.trim() && !file)) {
      res.status(400).json({ success: false, message: 'receiver_id and content or attachment are required.' })
      return
    }

    const [[receiver]] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE id = ?', [receiver_id]
    )
    if (!receiver) {
      res.status(404).json({ success: false, message: 'Recipient not found.' })
      return
    }

    const attachmentPath = file ? path.relative(process.cwd(), file.path).replace(/\\/g, '/') : null
    const attachmentName = file ? file.originalname : null
    const attachmentMime = file ? file.mimetype     : null
    const textContent    = content?.trim() || null

    // Secretary sends on behalf of their attorney
    const sentOnBehalfOf = user.role === 'secretary' ? getEffectiveAttorneyId(user) : null

    // Build query dynamically so we never insert NULL into the NOT NULL content column
    // when the message is attachment-only.
    let sql: string
    let params: any[]

    if (textContent) {
      sql    = `INSERT INTO messages (sender_id, receiver_id, content, case_id, attachment_path, attachment_name, attachment_mime, sent_on_behalf_of)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      params = [user.id, receiver_id, textContent, case_id ?? null, attachmentPath, attachmentName, attachmentMime, sentOnBehalfOf]
    } else {
      // Attachment-only: omit content column so the DB uses its default/NULL without violating NOT NULL
      // We also need to ALTER the column to allow NULL — see migration 003b.
      sql    = `INSERT INTO messages (sender_id, receiver_id, case_id, attachment_path, attachment_name, attachment_mime, sent_on_behalf_of)
                VALUES (?, ?, ?, ?, ?, ?, ?)`
      params = [user.id, receiver_id, case_id ?? null, attachmentPath, attachmentName, attachmentMime, sentOnBehalfOf]
    }

    const [result] = await pool.query<ResultSetHeader>(sql, params)

    res.status(201).json({ success: true, data: { id: result.insertId } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// â”€â”€â”€ Edit Message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const editMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const user      = (req as any).user
    const messageId = parseInt(req.params.id)
    const { content } = req.body

    if (!content?.trim()) {
      res.status(400).json({ success: false, message: 'Content is required.' })
      return
    }

    const [[msg]] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM messages WHERE id = ? AND sender_id = ? AND deleted_for_all = 0',
      [messageId, user.id]
    )
    if (!msg) {
      res.status(404).json({ success: false, message: 'Message not found or not yours.' })
      return
    }

    await pool.query(
      'UPDATE messages SET content = ?, edited_at = NOW() WHERE id = ?',
      [content.trim(), messageId]
    )
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// â”€â”€â”€ Delete Message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const user      = (req as any).user
    const messageId = parseInt(req.params.id)
    const { type }  = req.body  // 'for_me' | 'for_everyone'

    const [[msg]] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM messages WHERE id = ?', [messageId]
    )
    if (!msg) {
      res.status(404).json({ success: false, message: 'Message not found.' })
      return
    }

    const m = msg as any

    if (type === 'for_everyone') {
      if (m.sender_id !== user.id) {
        res.status(403).json({ success: false, message: 'Only the sender can delete for everyone.' })
        return
      }
      // Remove attachment file from disk
      if (m.attachment_path) {
        const fp = path.join(process.cwd(), m.attachment_path)
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      }
      await pool.query(
        `UPDATE messages
         SET deleted_for_all = 1, content = NULL,
             attachment_path = NULL, attachment_name = NULL, attachment_mime = NULL
         WHERE id = ?`,
        [messageId]
      )
    } else {
      // Delete for me only
      if (m.sender_id === user.id) {
        await pool.query('UPDATE messages SET deleted_for_sender = 1 WHERE id = ?', [messageId])
      } else if (m.receiver_id === user.id) {
        await pool.query('UPDATE messages SET deleted_for_receiver = 1 WHERE id = ?', [messageId])
      } else {
        res.status(403).json({ success: false, message: 'Not your message.' })
        return
      }
    }

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// â”€â”€â”€ Delete Conversation (soft, per user) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const deleteConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const user      = (req as any).user
    const partnerId = parseInt(req.params.partnerId)

    await pool.query(
      `INSERT INTO conversation_deletions (user_id, partner_id, deleted_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE deleted_at = NOW()`,
      [user.id, partnerId]
    )

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// â”€â”€â”€ Download / View Attachment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Uses sseVerifyToken so ?token= query-param works in browser <a> hrefs
export const downloadAttachment = async (req: Request, res: Response): Promise<void> => {
  try {
    const user      = (req as any).user
    const messageId = parseInt(req.params.id)

    const [[msg]] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM messages WHERE id = ? AND deleted_for_all = 0', [messageId]
    )
    const m = msg as any
    if (!m || (m.sender_id !== user.id && m.receiver_id !== user.id)) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }
    if (!m.attachment_path) {
      res.status(404).json({ success: false, message: 'No attachment.' })
      return
    }

    const filePath = path.join(process.cwd(), m.attachment_path)
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: 'File not found on disk.' })
      return
    }

    res.setHeader('Content-Type', m.attachment_mime || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename="${m.attachment_name}"`)
    fs.createReadStream(filePath).pipe(res)
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// â”€â”€â”€ Get Contactable Users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user

    if (user.role === 'secretary') {
      // Secretary can only message the attorney's clients (those with active cases)
      const attorneyId = getEffectiveAttorneyId(user)
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT u.id, u.fullname, u.username, u.role
         FROM users u
         JOIN cases c ON c.client_id = u.id
         WHERE c.attorney_id = ? AND c.deleted_at IS NULL AND u.status = 'active'
         ORDER BY u.fullname ASC`,
        [attorneyId]
      )
      res.json({ success: true, data: rows })
      return
    }

    const targetRole = user.role === 'attorney' ? 'client' : 'attorney'

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, fullname, username, role FROM users WHERE role = ? ORDER BY fullname ASC',
      [targetRole]
    )
    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

