import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { getEffectiveAttorneyId } from '../utils/scope'
import { audit } from '../utils/audit'

// ─── GET/POST /api/cases/:caseId/cocounsel ─────────────────────────
export const getCoCounsel = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params

    const [caseRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, client_id, attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`,
      [caseId]
    )
    if (!caseRows.length) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    const c = caseRows[0]

    const eid = getEffectiveAttorneyId(user)
    if (user.role === 'client' && c.client_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }
    if ((user.role === 'attorney' || user.role === 'secretary') && eid !== c.attorney_id) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ca.id, ca.attorney_id, ca.role, ca.added_at,
              u.fullname, u.email
       FROM case_attorneys ca
       JOIN users u ON u.id = ca.attorney_id
       WHERE ca.case_id = ?
       ORDER BY FIELD(ca.role,'lead','co_counsel','supervisor','associate','paralegal'), u.fullname`,
      [caseId]
    )
    res.json({ success: true, data: rows })
  } catch (err) {
    console.error('getCoCounsel:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

export const addCoCounsel = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    if (user.role === 'client' || user.role === 'secretary') {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }
    const { caseId } = req.params
    const { attorney_id, role } = req.body

    if (!attorney_id) { res.status(400).json({ success: false, message: 'attorney_id is required.' }); return }

    const [caseRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`, [caseId]
    )
    if (!caseRows.length) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    const c = caseRows[0]

    const eid = getEffectiveAttorneyId(user)
    if (user.role !== 'admin' && eid !== c.attorney_id) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }

    // Verify the target is actually an attorney
    const [attyRows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM users WHERE id = ? AND role = 'attorney'`, [attorney_id]
    )
    if (!attyRows.length) {
      res.status(404).json({ success: false, message: 'Attorney not found.' }); return
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO case_attorneys (case_id, attorney_id, role, added_by) VALUES (?, ?, ?, ?)`,
      [caseId, attorney_id, role ?? 'co_counsel', user.id]
    )
    await audit(req, 'CREATE', 'case_attorney', result.insertId, `case ${caseId}: attorney ${attorney_id} role ${role}`)
    res.status(201).json({ success: true, id: result.insertId })
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ success: false, message: 'This attorney is already on the case.' }); return
    }
    console.error('addCoCounsel:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

export const removeCoCounsel = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    if (user.role === 'client' || user.role === 'secretary') {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }
    const { caseId, entryId } = req.params

    const [caseRows] = await pool.query<RowDataPacket[]>(
      `SELECT attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`, [caseId]
    )
    if (!caseRows.length) { res.status(404).json({ success: false, message: 'Case not found.' }); return }

    const eid = getEffectiveAttorneyId(user)
    if (user.role !== 'admin' && eid !== caseRows[0].attorney_id) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }

    await pool.query(`DELETE FROM case_attorneys WHERE id = ? AND case_id = ?`, [entryId, caseId])
    await audit(req, 'DELETE', 'case_attorney', parseInt(entryId), `case ${caseId}`)
    res.json({ success: true })
  } catch (err) {
    console.error('removeCoCounsel:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
