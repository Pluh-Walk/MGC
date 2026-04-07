/**
 * Task Management Controller (§4.2)
 *
 * Endpoints:
 *   GET    /api/cases/:caseId/tasks               — list tasks for a case
 *   POST   /api/cases/:caseId/tasks               — create a task
 *   PUT    /api/cases/:caseId/tasks/:taskId        — update a task
 *   POST   /api/cases/:caseId/tasks/:taskId/complete — mark task done
 *   DELETE /api/cases/:caseId/tasks/:taskId        — delete a task
 *   GET    /api/cases/tasks/mine                   — tasks assigned to me (dashboard widget)
 */
import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { getEffectiveAttorneyId } from '../utils/scope'
import { notify } from '../utils/notify'
import { audit } from '../utils/audit'

// ─── Helper: verify case access for attorney/secretary scope ──────
async function verifyAccess(caseId: string, user: any): Promise<RowDataPacket | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`,
    [caseId]
  )
  if (!rows.length) return null

  const c = rows[0]
  if (user.role === 'admin') return c
  const eid = getEffectiveAttorneyId(user)
  if ((user.role === 'attorney' || user.role === 'secretary') && eid === c.attorney_id) return c
  return null
}

// ─── GET /api/cases/:caseId/tasks ────────────────────────────────
export const getTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params

    const c = await verifyAccess(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found or access denied.' }); return }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.*,
              u_assign.fullname AS assignee_name,
              u_create.fullname AS created_by_name,
              u_complete.fullname AS completed_by_name
       FROM case_tasks t
       LEFT JOIN users u_assign   ON u_assign.id   = t.assigned_to
       LEFT JOIN users u_create   ON u_create.id   = t.created_by
       LEFT JOIN users u_complete ON u_complete.id  = t.completed_by
       WHERE t.case_id = ?
       ORDER BY FIELD(t.priority,'critical','high','normal','low'), t.due_date ASC, t.id DESC`,
      [caseId]
    )

    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/cases/:caseId/tasks ───────────────────────────────
export const createTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params
    const { title, description, assigned_to, due_date, priority } = req.body

    if (!title?.trim()) {
      res.status(400).json({ success: false, message: 'Title is required.' })
      return
    }

    const c = await verifyAccess(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found or access denied.' }); return }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO case_tasks (case_id, title, description, assigned_to, created_by, due_date, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        title.trim(),
        description ?? null,
        assigned_to ?? null,
        user.id,
        due_date ?? null,
        priority ?? 'normal',
      ]
    )

    await audit(req, 'TASK_CREATED', 'case_task', result.insertId,
      `Task "${title}" created in case ${caseId}`)

    // Notify assignee if different from creator
    if (assigned_to && assigned_to !== user.id) {
      await notify(
        assigned_to,
        'case_update',
        `New task assigned to you: "${title}" on case #${caseId}. ${due_date ? 'Due: ' + new Date(due_date).toLocaleDateString('en-PH') : ''}`,
        Number(caseId)
      )
    }

    res.status(201).json({ success: true, id: result.insertId })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PUT /api/cases/:caseId/tasks/:taskId ────────────────────────
export const updateTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId, taskId } = req.params
    const { title, description, assigned_to, due_date, priority, status } = req.body

    const c = await verifyAccess(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found or access denied.' }); return }

    const [[existing]] = await pool.query<RowDataPacket[]>(
      `SELECT id, assigned_to, status FROM case_tasks WHERE id = ? AND case_id = ?`,
      [taskId, caseId]
    )
    if (!existing) { res.status(404).json({ success: false, message: 'Task not found.' }); return }

    await pool.query(
      `UPDATE case_tasks SET
         title       = COALESCE(?, title),
         description = COALESCE(?, description),
         assigned_to = CASE WHEN ? IS NOT NULL THEN ? ELSE assigned_to END,
         due_date    = COALESCE(?, due_date),
         priority    = COALESCE(?, priority),
         status      = COALESCE(?, status)
       WHERE id = ? AND case_id = ?`,
      [
        title ?? null,
        description ?? null,
        assigned_to, assigned_to ?? null,
        due_date ?? null,
        priority ?? null,
        status ?? null,
        taskId, caseId,
      ]
    )

    await audit(req, 'TASK_UPDATED', 'case_task', Number(taskId), `case ${caseId}`)

    // Notify new assignee if changed
    if (assigned_to && assigned_to !== existing.assigned_to && assigned_to !== user.id) {
      await notify(
        assigned_to,
        'case_update',
        `Task re-assigned to you: "${title ?? 'a task'}" on case #${caseId}`,
        Number(caseId)
      )
    }

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/cases/:caseId/tasks/:taskId/complete ──────────────
export const completeTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId, taskId } = req.params

    const c = await verifyAccess(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found or access denied.' }); return }

    const [[task]] = await pool.query<RowDataPacket[]>(
      `SELECT id, title, status, created_by FROM case_tasks WHERE id = ? AND case_id = ?`,
      [taskId, caseId]
    )
    if (!task) { res.status(404).json({ success: false, message: 'Task not found.' }); return }
    if (task.status === 'done') { res.status(409).json({ success: false, message: 'Task already completed.' }); return }

    await pool.query(
      `UPDATE case_tasks SET status = 'done', completed_at = NOW(), completed_by = ? WHERE id = ?`,
      [user.id, taskId]
    )

    await audit(req, 'TASK_COMPLETED', 'case_task', Number(taskId), `case ${caseId}`)

    // Notify creator if different from completer
    if (task.created_by !== user.id) {
      await notify(
        task.created_by,
        'case_update',
        `Task "${task.title}" has been completed on case #${caseId}`,
        Number(caseId)
      )
    }

    res.json({ success: true, message: 'Task marked as complete.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── DELETE /api/cases/:caseId/tasks/:taskId ─────────────────────
export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId, taskId } = req.params

    const c = await verifyAccess(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found or access denied.' }); return }

    await pool.query(`DELETE FROM case_tasks WHERE id = ? AND case_id = ?`, [taskId, caseId])
    await audit(req, 'TASK_DELETED', 'case_task', Number(taskId), `case ${caseId}`)

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/cases/tasks/mine — dashboard widget ─────────────────
export const getMyTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.id, t.case_id, t.title, t.due_date, t.priority, t.status,
              c.case_number, c.title AS case_title
       FROM case_tasks t
       JOIN cases c ON c.id = t.case_id AND c.deleted_at IS NULL
       WHERE t.assigned_to = ?
         AND t.status NOT IN ('done','cancelled')
       ORDER BY FIELD(t.priority,'critical','high','normal','low'), t.due_date ASC
       LIMIT 20`,
      [user.id]
    )

    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
