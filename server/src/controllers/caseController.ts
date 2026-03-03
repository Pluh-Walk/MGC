import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { generateCaseNumber } from '../utils/caseNumber'
import { notify } from '../utils/notify'
import { audit } from '../utils/audit'

// ─── Create Case ────────────────────────────────────────────
export const createCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, case_type, client_id, court_name, judge_name, filing_date } = req.body
    const attorney_id = (req as any).user.id

    if (!title || !case_type || !client_id) {
      res.status(400).json({ success: false, message: 'title, case_type, and client_id are required.' })
      return
    }

    const case_number = await generateCaseNumber()

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO cases (case_number, title, case_type, client_id, attorney_id, court_name, judge_name, filing_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [case_number, title, case_type, client_id, attorney_id, court_name || null, judge_name || null, filing_date || null]
    )

    const caseId = result.insertId

    // Auto timeline entry
    await pool.query(
      `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
       VALUES (?, 'status_change', 'Case created with status: active', CURDATE(), ?)`,
      [caseId, attorney_id]
    )

    // Notify the client
    await notify(client_id, 'case_update', `A new case has been opened for you: ${title} (${case_number})`, caseId)

    await audit(req, 'CASE_CREATED', 'case', caseId, `Case number: ${case_number}`)

    res.status(201).json({ success: true, message: 'Case created.', caseId, case_number })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Get All Cases (attorney sees theirs; client sees their own) ──
export const getCases = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { status, search, page = 1, limit = 20 } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    let baseWhere = 'c.deleted_at IS NULL'
    const params: any[] = []

    if (user.role === 'attorney') {
      baseWhere += ' AND c.attorney_id = ?'
      params.push(user.id)
    } else {
      baseWhere += ' AND c.client_id = ?'
      params.push(user.id)
    }

    if (status) {
      baseWhere += ' AND c.status = ?'
      params.push(status)
    }

    if (search) {
      baseWhere += ' AND (c.title LIKE ? OR c.case_number LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.id, c.case_number, c.title, c.case_type, c.status, c.filing_date, c.created_at,
              cl.fullname AS client_name, at.fullname AS attorney_name
       FROM cases c
       LEFT JOIN users cl ON cl.id = c.client_id
       LEFT JOIN users at ON at.id = c.attorney_id
       WHERE ${baseWhere}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    )

    const [[{ total }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM cases c WHERE ${baseWhere}`,
      params
    )

    res.json({ success: true, data: rows, total, page: Number(page), limit: Number(limit) })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Get Single Case ────────────────────────────────────────
export const getCaseById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.*, cl.fullname AS client_name, cl.email AS client_email,
              at.fullname AS attorney_name, at.email AS attorney_email
       FROM cases c
       LEFT JOIN users cl ON cl.id = c.client_id
       LEFT JOIN users at ON at.id = c.attorney_id
       WHERE c.id = ? AND c.deleted_at IS NULL`,
      [id]
    )

    if (!rows.length) {
      res.status(404).json({ success: false, message: 'Case not found.' })
      return
    }

    const c = rows[0]

    // Access control
    if (user.role === 'attorney' && c.attorney_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }
    if (user.role === 'client' && c.client_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    // Fetch timeline
    const [timeline] = await pool.query<RowDataPacket[]>(
      `SELECT t.*, u.fullname AS created_by_name
       FROM case_timeline t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.case_id = ?
       ORDER BY t.event_date DESC, t.created_at DESC`,
      [id]
    )

    // Fetch notes (attorney sees all; client sees public only)
    const noteFilter = user.role === 'attorney' ? '' : ' AND n.is_private = FALSE'
    const [notes] = await pool.query<RowDataPacket[]>(
      `SELECT n.*, u.fullname AS author_name
       FROM case_notes n
       LEFT JOIN users u ON u.id = n.author_id
       WHERE n.case_id = ?${noteFilter}
       ORDER BY n.created_at DESC`,
      [id]
    )

    res.json({ success: true, data: { ...c, timeline, notes } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Update Case ────────────────────────────────────────────
export const updateCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params
    const { title, case_type, status, court_name, judge_name, filing_date } = req.body

    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM cases WHERE id = ? AND deleted_at IS NULL`,
      [id]
    )

    if (!existing.length) {
      res.status(404).json({ success: false, message: 'Case not found.' })
      return
    }

    if (existing[0].attorney_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    const oldStatus = existing[0].status

    await pool.query(
      `UPDATE cases SET title=?, case_type=?, status=?, court_name=?, judge_name=?, filing_date=?
       WHERE id = ?`,
      [
        title || existing[0].title,
        case_type || existing[0].case_type,
        status || existing[0].status,
        court_name ?? existing[0].court_name,
        judge_name ?? existing[0].judge_name,
        filing_date ?? existing[0].filing_date,
        id,
      ]
    )

    // Auto timeline entry on status change
    if (status && status !== oldStatus) {
      await pool.query(
        `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
         VALUES (?, 'status_change', ?, CURDATE(), ?)`,
        [id, `Status changed from ${oldStatus} to ${status}`, user.id]
      )
      await notify(
        existing[0].client_id,
        'case_update',
        `Case "${existing[0].title}" status updated to: ${status}`,
        Number(id)
      )
    }

    await audit(req, 'CASE_UPDATED', 'case', Number(id))

    res.json({ success: true, message: 'Case updated.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Soft Delete Case ───────────────────────────────────────
export const deleteCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM cases WHERE id = ? AND deleted_at IS NULL`,
      [id]
    )

    if (!existing.length) {
      res.status(404).json({ success: false, message: 'Case not found.' })
      return
    }

    if (existing[0].attorney_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    await pool.query(`UPDATE cases SET deleted_at = NOW() WHERE id = ?`, [id])
    await audit(req, 'CASE_DELETED', 'case', Number(id))

    res.json({ success: true, message: 'Case archived.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Add Note ───────────────────────────────────────────────
export const addNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params
    const { content, is_private = true } = req.body

    if (!content) {
      res.status(400).json({ success: false, message: 'content is required.' })
      return
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO case_notes (case_id, author_id, content, is_private) VALUES (?, ?, ?, ?)`,
      [id, user.id, content, is_private]
    )

    await pool.query(
      `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
       VALUES (?, 'note', ?, CURDATE(), ?)`,
      [id, `Note added by ${user.fullname || 'attorney'}`, user.id]
    )

    await audit(req, 'NOTE_ADDED', 'case', Number(id))

    res.status(201).json({ success: true, message: 'Note added.', noteId: result.insertId })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Get Client List (for attorney when creating a case) ────
export const getClientList = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.fullname, u.email, u.username
       FROM users u
       WHERE u.role = 'client'
       ORDER BY u.fullname ASC`
    )
    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
