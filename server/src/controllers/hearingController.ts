import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { notify } from '../utils/notify'

// ─── List Hearings ───────────────────────────────────────────
export const getHearings = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user

    let query: string
    let params: any[]

    if (user.role === 'attorney') {
      query = `
        SELECT h.*, c.case_number, c.title AS case_title, c.client_id
        FROM hearings h
        JOIN cases c ON h.case_id = c.id
        WHERE c.attorney_id = ? AND c.deleted_at IS NULL
        ORDER BY h.scheduled_at ASC`
      params = [user.id]
    } else {
      query = `
        SELECT h.*, c.case_number, c.title AS case_title
        FROM hearings h
        JOIN cases c ON h.case_id = c.id
        WHERE c.client_id = ? AND c.deleted_at IS NULL
        ORDER BY h.scheduled_at ASC`
      params = [user.id]
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params)
    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Create Hearing ──────────────────────────────────────────
export const createHearing = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { case_id, title, hearing_type, scheduled_at, location, notes } = req.body

    if (!case_id || !title || !scheduled_at) {
      res.status(400).json({ success: false, message: 'case_id, title and scheduled_at are required.' })
      return
    }

    // Verify attorney owns this case
    const [[caseRow]] = await pool.query<RowDataPacket[]>(
      'SELECT id, client_id, case_number FROM cases WHERE id = ? AND attorney_id = ? AND deleted_at IS NULL',
      [case_id, user.id]
    )
    if (!caseRow) {
      res.status(403).json({ success: false, message: 'Case not found or access denied.' })
      return
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO hearings (case_id, title, hearing_type, scheduled_at, location, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [case_id, title, hearing_type ?? 'other', scheduled_at, location ?? null, notes ?? null]
    )

    // Notify client
    await notify(
      caseRow.client_id,
      'hearing_reminder',
      `A new hearing "${title}" has been scheduled for case ${caseRow.case_number}.`,
      result.insertId
    )

    res.status(201).json({ success: true, data: { id: result.insertId } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Update Hearing ──────────────────────────────────────────
export const updateHearing = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params
    const { title, hearing_type, scheduled_at, location, notes, status } = req.body

    // Verify attorney owns the hearing's case
    const [[hearing]] = await pool.query<RowDataPacket[]>(
      `SELECT h.id, c.client_id, c.case_number FROM hearings h
       JOIN cases c ON h.case_id = c.id
       WHERE h.id = ? AND c.attorney_id = ?`,
      [id, user.id]
    )
    if (!hearing) {
      res.status(403).json({ success: false, message: 'Hearing not found or access denied.' })
      return
    }

    await pool.query(
      `UPDATE hearings
       SET title=COALESCE(?,title), hearing_type=COALESCE(?,hearing_type),
           scheduled_at=COALESCE(?,scheduled_at), location=COALESCE(?,location),
           notes=COALESCE(?,notes), status=COALESCE(?,status)
       WHERE id=?`,
      [title, hearing_type, scheduled_at, location, notes, status, id]
    )

    if (status) {
      await notify(
        hearing.client_id,
        'hearing_reminder',
        `Hearing "${title ?? 'your hearing'}" status updated to "${status}" (${hearing.case_number}).`,
        Number(id)
      )
    }

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Delete Hearing (soft cancel) ───────────────────────────
export const deleteHearing = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [[hearing]] = await pool.query<RowDataPacket[]>(
      `SELECT h.id FROM hearings h
       JOIN cases c ON h.case_id = c.id
       WHERE h.id = ? AND c.attorney_id = ?`,
      [id, user.id]
    )
    if (!hearing) {
      res.status(403).json({ success: false, message: 'Hearing not found or access denied.' })
      return
    }

    await pool.query("UPDATE hearings SET status='cancelled' WHERE id=?", [id])
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
