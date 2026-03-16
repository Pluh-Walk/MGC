import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { notify } from '../utils/notify'
import { getEffectiveAttorneyId, getCaseScope } from '../utils/scope'
import { audit } from '../utils/audit'

// ─── List Hearings ───────────────────────────────────────────
export const getHearings = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const scope = getCaseScope(user)

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT h.*, c.case_number, c.title AS case_title, c.client_id
       FROM hearings h
       JOIN cases c ON h.case_id = c.id
       WHERE ${scope.clause} AND c.deleted_at IS NULL
       ORDER BY h.scheduled_at ASC`,
      scope.params
    )
    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Create Hearing ──────────────────────────────────────────
export const createHearing = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    const { case_id, title, hearing_type, scheduled_at, location, notes } = req.body

    if (!case_id || !title || !scheduled_at) {
      res.status(400).json({ success: false, message: 'case_id, title and scheduled_at are required.' })
      return
    }

    // Verify attorney (or secretary's attorney) owns this case
    const [[caseRow]] = await pool.query<RowDataPacket[]>(
      'SELECT id, client_id, case_number FROM cases WHERE id = ? AND attorney_id = ? AND deleted_at IS NULL',
      [case_id, effectiveAttorneyId]
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

    await audit(req, 'HEARING_CREATED', 'hearing', result.insertId, `Case: ${caseRow.case_number}`)

    res.status(201).json({ success: true, data: { id: result.insertId } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Update Hearing ──────────────────────────────────────────
export const updateHearing = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    const { id } = req.params
    const { title, hearing_type, scheduled_at, location, notes, status } = req.body

    // Verify attorney (or secretary's attorney) owns the hearing's case
    const [[hearing]] = await pool.query<RowDataPacket[]>(
      `SELECT h.id, c.client_id, c.case_number FROM hearings h
       JOIN cases c ON h.case_id = c.id
       WHERE h.id = ? AND c.attorney_id = ?`,
      [id, effectiveAttorneyId]
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

    await audit(req, 'HEARING_UPDATED', 'hearing', Number(id), `Case: ${hearing.case_number}`)

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
    await audit(req, 'HEARING_CANCELLED', 'hearing', Number(id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
