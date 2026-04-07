import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { getEffectiveAttorneyId } from '../utils/scope'
import { notify } from '../utils/notify'
import { audit } from '../utils/audit'

// ─── List Deadlines for a Case ──────────────────────────────
export const getDeadlines = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params

    const [caseRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, client_id, attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`,
      [caseId]
    )
    if (!caseRows.length) {
      res.status(404).json({ success: false, message: 'Case not found.' })
      return
    }
    const c = caseRows[0]

    if (user.role === 'client' && c.client_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }
    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    if ((user.role === 'attorney' || user.role === 'secretary') && effectiveAttorneyId !== c.attorney_id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    const clientFilter = user.role === 'client' ? ' AND d.notify_client = TRUE' : ''
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.*, u.fullname AS created_by_name, cb.fullname AS completed_by_name
       FROM case_deadlines d
       LEFT JOIN users u  ON u.id  = d.created_by
       LEFT JOIN users cb ON cb.id = d.completed_by
       WHERE d.case_id = ?${clientFilter}
       ORDER BY d.due_date ASC`,
      [caseId]
    )

    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Create Deadline ─────────────────────────────────────────
export const createDeadline = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params
    const { title, description, deadline_type, due_date, reminder_days = 7, notify_client = false } = req.body

    if (!title || !due_date) {
      res.status(400).json({ success: false, message: 'title and due_date are required.' })
      return
    }

    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    const [caseRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, client_id, case_number FROM cases WHERE id = ? AND attorney_id = ? AND deleted_at IS NULL`,
      [caseId, effectiveAttorneyId]
    )
    if (!caseRows.length) {
      res.status(403).json({ success: false, message: 'Case not found or access denied.' })
      return
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO case_deadlines
         (case_id, title, description, deadline_type, due_date, reminder_days, notify_client, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId, title, description || null, deadline_type || 'other',
        due_date, reminder_days, notify_client ? 1 : 0, user.id,
      ]
    )

    // Notify client if requested
    if (notify_client) {
      await notify(
        caseRows[0].client_id,
        'case_update',
        `A new deadline has been set for your case ${caseRows[0].case_number}: "${title}" — due ${due_date}`,
        Number(caseId)
      )
    }

    await audit(req, 'DEADLINE_CREATED', 'case', Number(caseId), `Deadline: ${title} due ${due_date}`)

    res.status(201).json({ success: true, message: 'Deadline created.', deadlineId: result.insertId })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Update Deadline ─────────────────────────────────────────
export const updateDeadline = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId, deadlineId } = req.params
    const { title, description, deadline_type, due_date, reminder_days, notify_client } = req.body

    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.id FROM case_deadlines d
       JOIN cases c ON c.id = d.case_id
       WHERE d.id = ? AND d.case_id = ? AND c.attorney_id = ? AND c.deleted_at IS NULL`,
      [deadlineId, caseId, effectiveAttorneyId]
    )
    if (!rows.length) {
      res.status(403).json({ success: false, message: 'Deadline not found or access denied.' })
      return
    }

    await pool.query(
      `UPDATE case_deadlines
       SET title=COALESCE(?,title), description=COALESCE(?,description),
           deadline_type=COALESCE(?,deadline_type), due_date=COALESCE(?,due_date),
           reminder_days=COALESCE(?,reminder_days), notify_client=COALESCE(?,notify_client)
       WHERE id = ?`,
      [title, description, deadline_type, due_date, reminder_days, notify_client !== undefined ? (notify_client ? 1 : 0) : null, deadlineId]
    )

    await audit(req, 'DEADLINE_UPDATED', 'case', Number(caseId))
    res.json({ success: true, message: 'Deadline updated.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Mark Deadline Complete ───────────────────────────────────
export const completeDeadline = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId, deadlineId } = req.params

    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.id, d.title, c.client_id FROM case_deadlines d
       JOIN cases c ON c.id = d.case_id
       WHERE d.id = ? AND d.case_id = ? AND c.attorney_id = ? AND c.deleted_at IS NULL`,
      [deadlineId, caseId, effectiveAttorneyId]
    )
    if (!rows.length) {
      res.status(403).json({ success: false, message: 'Deadline not found or access denied.' })
      return
    }

    await pool.query(
      `UPDATE case_deadlines
       SET is_completed = TRUE, completed_at = NOW(), completed_by = ?
       WHERE id = ?`,
      [user.id, deadlineId]
    )

    // Log in timeline
    await pool.query(
      `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
       VALUES (?, 'other', ?, CURDATE(), ?)`,
      [caseId, `Deadline completed: "${rows[0].title}"`, user.id]
    )

    await audit(req, 'DEADLINE_COMPLETED', 'case', Number(caseId), rows[0].title)
    res.json({ success: true, message: 'Deadline marked as completed.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Delete Deadline ─────────────────────────────────────────
export const deleteDeadline = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId, deadlineId } = req.params

    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.id FROM case_deadlines d
       JOIN cases c ON c.id = d.case_id
       WHERE d.id = ? AND d.case_id = ? AND c.attorney_id = ? AND c.deleted_at IS NULL`,
      [deadlineId, caseId, effectiveAttorneyId]
    )
    if (!rows.length) {
      res.status(403).json({ success: false, message: 'Deadline not found or access denied.' })
      return
    }

    await pool.query(`DELETE FROM case_deadlines WHERE id = ?`, [deadlineId])
    await audit(req, 'DEADLINE_DELETED', 'case', Number(caseId))
    res.json({ success: true, message: 'Deadline deleted.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/cases/deadlines/summary  — dashboard widget ──────────
export const getDeadlineSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const effectiveAttorneyId = getEffectiveAttorneyId(user)

    const [overdueRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt
       FROM case_deadlines cd
       JOIN cases c ON c.id = cd.case_id AND c.deleted_at IS NULL
       WHERE cd.is_completed = 0
         AND cd.due_date < CURDATE()
         AND c.status NOT IN ('closed','archived')
         AND c.attorney_id = ?`,
      [effectiveAttorneyId]
    )

    const [thisWeekRows] = await pool.query<RowDataPacket[]>(
      `SELECT cd.id, cd.title, cd.due_date, cd.deadline_type,
              c.id AS case_id, c.case_number, c.title AS case_title
       FROM case_deadlines cd
       JOIN cases c ON c.id = cd.case_id AND c.deleted_at IS NULL
       WHERE cd.is_completed = 0
         AND cd.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
         AND c.status NOT IN ('closed','archived')
         AND c.attorney_id = ?
       ORDER BY cd.due_date ASC
       LIMIT 10`,
      [effectiveAttorneyId]
    )

    res.json({
      success: true,
      overdue: Number((overdueRows as RowDataPacket[])[0].cnt),
      thisWeek: thisWeekRows
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/cases/:caseId/deadlines/:deadlineId/sol-acknowledge ──────────
export const acknowledgeSolDeadline = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId, deadlineId } = req.params

    // Verify the case exists and the user has access
    const [caseRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`,
      [caseId]
    )
    if (!caseRows.length) {
      res.status(404).json({ success: false, message: 'Case not found.' })
      return
    }
    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    if (effectiveAttorneyId !== caseRows[0].attorney_id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    const [dlRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, deadline_type, sol_acknowledged_at
       FROM case_deadlines WHERE id = ? AND case_id = ?`,
      [deadlineId, caseId]
    )
    if (!dlRows.length) {
      res.status(404).json({ success: false, message: 'Deadline not found.' })
      return
    }
    if (dlRows[0].deadline_type !== 'statute_of_limitations') {
      res.status(400).json({ success: false, message: 'Not a statute of limitations deadline.' })
      return
    }
    if (dlRows[0].sol_acknowledged_at) {
      res.status(409).json({ success: false, message: 'Already acknowledged.' })
      return
    }

    await pool.query(
      `UPDATE case_deadlines
       SET sol_acknowledged_at = NOW(), sol_acknowledged_by = ?
       WHERE id = ?`,
      [user.id, deadlineId]
    )

    await audit(req, 'SOL_ACKNOWLEDGED', 'case_deadline', Number(deadlineId),
      `SOL deadline acknowledged by user ${user.id} on case ${caseId}`)

    res.json({ success: true, message: 'SOL deadline acknowledged.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
