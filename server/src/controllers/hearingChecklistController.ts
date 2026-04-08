import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { getEffectiveAttorneyId } from '../utils/scope'

// ─── Helper: verify user can access the hearing ──────────────────
async function canAccessHearing(hearingId: number, user: any): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT h.id FROM hearings h
     JOIN cases c ON c.id = h.case_id
     WHERE h.id = ? AND c.deleted_at IS NULL`,
    [hearingId]
  )
  if (!rows.length) return false
  if (user.role === 'admin') return true

  const eid = getEffectiveAttorneyId(user)
  if (user.role === 'attorney' || user.role === 'secretary') {
    const [r] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM cases WHERE id = (SELECT case_id FROM hearings WHERE id = ?) AND attorney_id = ?',
      [hearingId, eid]
    )
    return r.length > 0
  }
  // client
  const [r] = await pool.query<RowDataPacket[]>(
    `SELECT c.id FROM cases c
     JOIN hearings h ON h.case_id = c.id
     WHERE h.id = ? AND c.client_id = ?`,
    [hearingId, user.id]
  )
  return r.length > 0
}

// ─── GET /api/hearings/:hearingId/checklist ───────────────────────
export const getChecklist = async (req: Request, res: Response): Promise<void> => {
  try {
    const user       = (req as any).user
    const hearingId  = Number(req.params.hearingId)
    if (!(await canAccessHearing(hearingId, user))) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ci.*, u.fullname AS done_by_name
       FROM hearing_checklist_items ci
       LEFT JOIN users u ON u.id = ci.done_by
       WHERE ci.hearing_id = ?
       ORDER BY ci.id ASC`,
      [hearingId]
    )
    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/hearings/:hearingId/checklist ─────────────────────
export const addChecklistItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const user      = (req as any).user
    const hearingId = Number(req.params.hearingId)
    const { label } = req.body

    if (!label?.trim()) {
      res.status(400).json({ success: false, message: 'Label is required.' }); return
    }
    if (!(await canAccessHearing(hearingId, user))) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO hearing_checklist_items (hearing_id, label, created_by) VALUES (?, ?, ?)',
      [hearingId, label.trim(), user.id]
    )
    const [[row]] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM hearing_checklist_items WHERE id = ?',
      [result.insertId]
    )
    res.status(201).json({ success: true, data: row })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PATCH /api/hearings/:hearingId/checklist/:itemId/toggle ──────
export const toggleChecklistItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const user      = (req as any).user
    const hearingId = Number(req.params.hearingId)
    const itemId    = Number(req.params.itemId)

    if (!(await canAccessHearing(hearingId, user))) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }

    const [[item]] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM hearing_checklist_items WHERE id = ? AND hearing_id = ?',
      [itemId, hearingId]
    )
    if (!item) { res.status(404).json({ success: false, message: 'Item not found.' }); return }

    const newDone = item.is_done ? 0 : 1
    await pool.query(
      `UPDATE hearing_checklist_items
       SET is_done = ?, done_by = ?, done_at = ?
       WHERE id = ?`,
      [newDone, newDone ? user.id : null, newDone ? new Date() : null, itemId]
    )
    res.json({ success: true, data: { is_done: newDone } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── DELETE /api/hearings/:hearingId/checklist/:itemId ────────────
export const deleteChecklistItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const user      = (req as any).user
    const hearingId = Number(req.params.hearingId)
    const itemId    = Number(req.params.itemId)

    if (!(await canAccessHearing(hearingId, user))) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }

    await pool.query(
      'DELETE FROM hearing_checklist_items WHERE id = ? AND hearing_id = ?',
      [itemId, hearingId]
    )
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
