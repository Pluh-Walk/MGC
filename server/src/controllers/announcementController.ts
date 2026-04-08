import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { getEffectiveAttorneyId } from '../utils/scope'
import { audit } from '../utils/audit'

// ─── List Announcements ──────────────────────────────────────
export const getAnnouncements = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user

    let rows: RowDataPacket[]

    // Common subquery snippet to check if current user has acknowledged
    const ackCol = `(SELECT COUNT(*) FROM announcement_acknowledgments
                     WHERE announcement_id = a.id AND user_id = ${user.id}) AS user_acknowledged`

    if (user.role === 'admin') {
      // Admin sees all announcements
      ;[rows] = await pool.query<RowDataPacket[]>(
        `SELECT a.*, u.fullname AS author_name,
                c.case_number, c.title AS case_title,
                (SELECT COUNT(*) FROM announcement_acknowledgments WHERE announcement_id = a.id AND user_id = ?) AS user_acknowledged,
                (SELECT COUNT(*) FROM announcement_acknowledgments WHERE announcement_id = a.id) AS ack_count
         FROM announcements a
         JOIN users u ON a.created_by = u.id
         LEFT JOIN cases c ON a.case_id = c.id
         ORDER BY a.created_at DESC`,
        [user.id]
      )
    } else if (user.role === 'attorney') {
      // Attorney sees all announcements they created + firm-wide ones
      ;[rows] = await pool.query<RowDataPacket[]>(
        `SELECT a.*, u.fullname AS author_name,
                c.case_number, c.title AS case_title,
                (SELECT COUNT(*) FROM announcement_acknowledgments WHERE announcement_id = a.id AND user_id = ?) AS user_acknowledged
         FROM announcements a
         JOIN users u ON a.created_by = u.id
         LEFT JOIN cases c ON a.case_id = c.id
         WHERE a.created_by = ? OR a.case_id IS NULL
         ORDER BY a.created_at DESC`,
        [user.id, user.id]
      )
    } else if (user.role === 'secretary') {
      // Secretary sees their attorney's announcements + firm-wide
      const attorneyId = getEffectiveAttorneyId(user)
      ;[rows] = await pool.query<RowDataPacket[]>(
        `SELECT a.*, u.fullname AS author_name,
                c.case_number, c.title AS case_title,
                (SELECT COUNT(*) FROM announcement_acknowledgments WHERE announcement_id = a.id AND user_id = ?) AS user_acknowledged
         FROM announcements a
         JOIN users u ON a.created_by = u.id
         LEFT JOIN cases c ON a.case_id = c.id
         WHERE a.created_by = ? OR a.case_id IS NULL
         ORDER BY a.created_at DESC`,
        [user.id, attorneyId]
      )
    } else {
      // Client sees firm-wide + announcements for their cases
      ;[rows] = await pool.query<RowDataPacket[]>(
        `SELECT a.*, u.fullname AS author_name,
                c.case_number, c.title AS case_title,
                (SELECT COUNT(*) FROM announcement_acknowledgments WHERE announcement_id = a.id AND user_id = ?) AS user_acknowledged
         FROM announcements a
         JOIN users u ON a.created_by = u.id
         LEFT JOIN cases c ON a.case_id = c.id
         WHERE a.case_id IS NULL
            OR a.case_id IN (
              SELECT id FROM cases WHERE client_id = ? AND deleted_at IS NULL
            )
         ORDER BY a.created_at DESC`,
        [user.id, user.id]
      )
    }

    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Create Announcement ─────────────────────────────────────
export const createAnnouncement = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { title, body, case_id, ack_required } = req.body

    if (!title || !body) {
      res.status(400).json({ success: false, message: 'Title and body are required.' })
      return
    }

    // If case_id provided, verify attorney (or secretary's attorney) owns the case
    if (case_id) {
      const effectiveAttorneyId = getEffectiveAttorneyId(user)
      const [[caseRow]] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cases WHERE id = ? AND attorney_id = ? AND deleted_at IS NULL',
        [case_id, effectiveAttorneyId]
      )
      if (!caseRow) {
        res.status(403).json({ success: false, message: 'Case not found or access denied.' })
        return
      }
    } else if (user.role === 'secretary') {
      // Secretary can only create case-specific announcements
      res.status(403).json({ success: false, message: 'Secretaries can only create case-specific announcements.' })
      return
    }

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO announcements (created_by, title, body, case_id, ack_required) VALUES (?, ?, ?, ?, ?)',
      [user.id, title, body, case_id ?? null, ack_required ? 1 : 0]
    )

    await audit(req, 'ANNOUNCEMENT_CREATED', 'announcement', result.insertId, title)

    res.status(201).json({ success: true, data: { id: result.insertId } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Delete Announcement ─────────────────────────────────────
export const deleteAnnouncement = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [[row]] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM announcements WHERE id = ? AND created_by = ?',
      [id, user.id]
    )
    if (!row) {
      res.status(403).json({ success: false, message: 'Not found or access denied.' })
      return
    }

    await pool.query('DELETE FROM announcements WHERE id = ?', [id])
    await audit(req, 'ANNOUNCEMENT_DELETED', 'announcement', Number(id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Acknowledge Announcement ─────────────────────────────────
export const acknowledgeAnnouncement = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [[ann]] = await pool.query<RowDataPacket[]>(
      'SELECT id, ack_required FROM announcements WHERE id = ?', [id]
    )
    if (!ann) { res.status(404).json({ success: false, message: 'Announcement not found.' }); return }

    // Upsert acknowledgment
    await pool.query(
      `INSERT IGNORE INTO announcement_acknowledgments (announcement_id, user_id, acknowledged_at)
       VALUES (?, ?, NOW())`,
      [id, user.id]
    )

    await audit(req, 'ANNOUNCEMENT_ACKNOWLEDGED', 'announcement', Number(id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Get Acknowledgment Status for a user ─────────────────────
export const getAcknowledgmentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user

    // Return list of announcement IDs this user has acknowledged
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT announcement_id FROM announcement_acknowledgments WHERE user_id = ?',
      [user.id]
    )
    res.json({ success: true, data: rows.map(r => r.announcement_id) })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Admin: list acknowledgments for one announcement ─────────
export const listAcknowledgments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT aa.*, u.fullname, u.email, u.role
       FROM announcement_acknowledgments aa
       JOIN users u ON u.id = aa.user_id
       WHERE aa.announcement_id = ?
       ORDER BY aa.acknowledged_at DESC`,
      [id]
    )
    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
