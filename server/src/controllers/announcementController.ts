import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'

// ─── List Announcements ──────────────────────────────────────
export const getAnnouncements = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user

    let rows: RowDataPacket[]

    if (user.role === 'attorney') {
      // Attorney sees all announcements they created + firm-wide ones
      ;[rows] = await pool.query<RowDataPacket[]>(
        `SELECT a.*, u.fullname AS author_name,
                c.case_number, c.title AS case_title
         FROM announcements a
         JOIN users u ON a.created_by = u.id
         LEFT JOIN cases c ON a.case_id = c.id
         WHERE a.created_by = ? OR a.case_id IS NULL
         ORDER BY a.created_at DESC`,
        [user.id]
      )
    } else {
      // Client sees firm-wide + announcements for their cases
      ;[rows] = await pool.query<RowDataPacket[]>(
        `SELECT a.*, u.fullname AS author_name,
                c.case_number, c.title AS case_title
         FROM announcements a
         JOIN users u ON a.created_by = u.id
         LEFT JOIN cases c ON a.case_id = c.id
         WHERE a.case_id IS NULL
            OR a.case_id IN (
              SELECT id FROM cases WHERE client_id = ? AND deleted_at IS NULL
            )
         ORDER BY a.created_at DESC`,
        [user.id]
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
    const { title, body, case_id } = req.body

    if (!title || !body) {
      res.status(400).json({ success: false, message: 'Title and body are required.' })
      return
    }

    // If case_id provided, verify attorney owns the case
    if (case_id) {
      const [[caseRow]] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM cases WHERE id = ? AND attorney_id = ? AND deleted_at IS NULL',
        [case_id, user.id]
      )
      if (!caseRow) {
        res.status(403).json({ success: false, message: 'Case not found or access denied.' })
        return
      }
    }

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO announcements (created_by, title, body, case_id) VALUES (?, ?, ?, ?)',
      [user.id, title, body, case_id ?? null]
    )

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
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
