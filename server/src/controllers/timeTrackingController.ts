/**
 * Time Tracking Controller
 *
 * GET    /api/cases/:caseId/time              — list time entries
 * POST   /api/cases/:caseId/time              — start or add manual entry
 * PATCH  /api/cases/:caseId/time/:entryId     — update (stop timer / edit)
 * DELETE /api/cases/:caseId/time/:entryId     — delete entry
 * POST   /api/cases/:caseId/time/:entryId/bill — convert to billing entry
 * GET    /api/cases/:caseId/time/summary       — weekly/monthly summary
 */
import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { audit } from '../utils/audit'
import { getEffectiveAttorneyId } from '../utils/scope'

async function getCase(caseId: number, user: any) {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, client_id, attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL', [caseId]
  )
  return rows[0] ?? null
}
function canAccess(c: RowDataPacket, user: any): boolean {
  const eid = getEffectiveAttorneyId(user)
  if (user.role === 'admin') return true
  return eid === c.attorney_id
}

// GET /api/cases/:caseId/time
export const listTimeEntries = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  const caseId = Number(req.params.caseId)
  if (user.role === 'client') { res.status(403).json({ success: false, message: 'Access denied.' }); return }
  const c = await getCase(caseId, user)
  if (!c || !canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT te.*, u.fullname AS user_name
     FROM time_entries te JOIN users u ON u.id = te.user_id
     WHERE te.case_id = ?
     ORDER BY te.started_at DESC`,
    [caseId]
  )
  res.json({ success: true, data: rows })
}

// POST /api/cases/:caseId/time
export const createTimeEntry = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  const caseId = Number(req.params.caseId)
  if (user.role === 'client') { res.status(403).json({ success: false, message: 'Access denied.' }); return }
  const c = await getCase(caseId, user)
  if (!c || !canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  const { description, started_at, ended_at, duration_sec, is_billable } = req.body
  if (!description) { res.status(400).json({ success: false, message: 'description is required.' }); return }

  const startedAt = started_at ? new Date(started_at) : new Date()
  const endedAt   = ended_at   ? new Date(ended_at)   : null
  const durSec    = endedAt
    ? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
    : (duration_sec ?? null)

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO time_entries (case_id, user_id, description, started_at, ended_at, duration_sec, is_billable)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [caseId, user.id, description, startedAt, endedAt, durSec, is_billable !== false ? 1 : 0]
  )

  await audit(req, 'CREATE', 'time_entry', result.insertId, `case ${caseId}: ${description}`)
  res.status(201).json({ success: true, id: result.insertId })
}

// PATCH /api/cases/:caseId/time/:entryId  (stop timer or edit)
export const updateTimeEntry = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  const caseId  = Number(req.params.caseId)
  const entryId = Number(req.params.entryId)
  if (user.role === 'client') { res.status(403).json({ success: false, message: 'Access denied.' }); return }
  const c = await getCase(caseId, user)
  if (!c || !canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  const [[entry]] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM time_entries WHERE id = ? AND case_id = ?', [entryId, caseId]
  )
  if (!entry) { res.status(404).json({ success: false, message: 'Entry not found.' }); return }

  const { description, ended_at, is_billable } = req.body
  const endedAt = ended_at ? new Date(ended_at) : (entry.ended_at ? new Date(entry.ended_at) : null)
  const durSec  = endedAt
    ? Math.round((endedAt.getTime() - new Date(entry.started_at).getTime()) / 1000)
    : entry.duration_sec

  await pool.query(
    `UPDATE time_entries SET
       description  = COALESCE(?, description),
       ended_at     = COALESCE(?, ended_at),
       duration_sec = ?,
       is_billable  = COALESCE(?, is_billable)
     WHERE id = ? AND case_id = ?`,
    [description ?? null, endedAt ?? null, durSec, is_billable != null ? (is_billable ? 1 : 0) : null,
     entryId, caseId]
  )

  await audit(req, 'UPDATE', 'time_entry', entryId, `case ${caseId}`)
  res.json({ success: true })
}

// DELETE /api/cases/:caseId/time/:entryId
export const deleteTimeEntry = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  const caseId  = Number(req.params.caseId)
  const entryId = Number(req.params.entryId)
  if (!['attorney', 'admin'].includes(user.role)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }
  const c = await getCase(caseId, user)
  if (!c || !canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  await pool.query('DELETE FROM time_entries WHERE id = ? AND case_id = ?', [entryId, caseId])
  await audit(req, 'DELETE', 'time_entry', entryId, `case ${caseId}`)
  res.json({ success: true })
}

// POST /api/cases/:caseId/time/:entryId/bill — convert to billing entry
export const convertToBilling = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  const caseId  = Number(req.params.caseId)
  const entryId = Number(req.params.entryId)
  if (!['attorney', 'secretary'].includes(user.role)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }
  const c = await getCase(caseId, user)
  if (!c || !canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  const [[entry]] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM time_entries WHERE id = ? AND case_id = ?', [entryId, caseId]
  )
  if (!entry) { res.status(404).json({ success: false, message: 'Entry not found.' }); return }
  if (entry.billing_id) { res.status(400).json({ success: false, message: 'Entry already billed.' }); return }

  const { rate } = req.body
  const hours  = entry.duration_sec ? +(entry.duration_sec / 3600).toFixed(2) : 0
  const amount = rate ? +(hours * Number(rate)).toFixed(2) : 0
  const attorneyId = getEffectiveAttorneyId(user) ?? user.id

  const [billing] = await pool.query<ResultSetHeader>(
    `INSERT INTO case_billing
       (case_id, attorney_id, entry_type, description, hours, rate, amount, billing_date)
     VALUES (?, ?, 'hourly', ?, ?, ?, ?, CURDATE())`,
    [caseId, attorneyId, entry.description, hours, rate || null, amount]
  )

  await pool.query('UPDATE time_entries SET billing_id = ? WHERE id = ?', [billing.insertId, entryId])
  await audit(req, 'CONVERT_TIME_BILLING', 'time_entry', entryId, `case ${caseId}, billing id ${billing.insertId}`)
  res.json({ success: true, billing_id: billing.insertId })
}

// GET /api/cases/:caseId/time/summary
export const getTimeSummary = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  const caseId = Number(req.params.caseId)
  if (user.role === 'client') { res.status(403).json({ success: false, message: 'Access denied.' }); return }
  const c = await getCase(caseId, user)
  if (!c || !canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       SUM(duration_sec)                        AS total_seconds,
       SUM(CASE WHEN is_billable = 1 THEN duration_sec ELSE 0 END) AS billable_seconds,
       COUNT(*)                                  AS entry_count,
       COUNT(CASE WHEN ended_at IS NULL THEN 1 END) AS running_count
     FROM time_entries WHERE case_id = ?`,
    [caseId]
  )

  const s = rows[0]
  res.json({
    success: true,
    data: {
      total_hours:    +((s.total_seconds || 0) / 3600).toFixed(2),
      billable_hours: +((s.billable_seconds || 0) / 3600).toFixed(2),
      entry_count:    s.entry_count,
      running_count:  s.running_count,
    },
  })
}
