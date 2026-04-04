import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { getEffectiveAttorneyId } from '../utils/scope'
import { audit } from '../utils/audit'

async function getCase(caseId: string | number, user: any) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, client_id, attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`,
    [caseId]
  )
  return rows[0] ?? null
}

function canWrite(c: RowDataPacket, user: any): boolean {
  const eid = getEffectiveAttorneyId(user)
  if (user.role === 'admin') return true
  if (user.role === 'client') return false
  return eid === c.attorney_id
}

// ─── GET /api/cases/:caseId/relations ──────────────────────────────
export const getRelations = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params

    const c = await getCase(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found.' }); return }

    const eid = getEffectiveAttorneyId(user)
    if (user.role === 'client' && c.client_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }
    if ((user.role === 'attorney' || user.role === 'secretary') && eid !== c.attorney_id) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT cr.id, cr.related_case_id, cr.relation_type, cr.notes,
              rc.case_number, rc.title, rc.status, rc.case_type,
              cr.created_at
       FROM case_relations cr
       JOIN cases rc ON rc.id = cr.related_case_id AND rc.deleted_at IS NULL
       WHERE cr.case_id = ?
       ORDER BY cr.created_at DESC`,
      [caseId]
    )
    res.json({ success: true, data: rows })
  } catch (err) {
    console.error('getRelations:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── POST /api/cases/:caseId/relations ─────────────────────────────
export const addRelation = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params
    const { related_case_id, relation_type, notes } = req.body

    if (!related_case_id) {
      res.status(400).json({ success: false, message: 'related_case_id is required.' }); return
    }
    if (Number(caseId) === Number(related_case_id)) {
      res.status(400).json({ success: false, message: 'A case cannot be related to itself.' }); return
    }

    const c = await getCase(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    if (!canWrite(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    // Verify related case exists
    const [relRows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM cases WHERE id = ? AND deleted_at IS NULL`, [related_case_id]
    )
    if (!relRows.length) {
      res.status(404).json({ success: false, message: 'Related case not found.' }); return
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO case_relations (case_id, related_case_id, relation_type, notes, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [caseId, related_case_id, relation_type ?? 'related_matter', notes ?? null, user.id]
    )

    await audit(req, 'CREATE', 'case_relation', result.insertId, `case ${caseId} -> ${related_case_id} (${relation_type})`)
    res.status(201).json({ success: true, id: result.insertId })
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ success: false, message: 'Relation already exists.' }); return
    }
    console.error('addRelation:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── DELETE /api/cases/:caseId/relations/:relationId ───────────────
export const deleteRelation = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId, relationId } = req.params

    const c = await getCase(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    if (!canWrite(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    await pool.query(`DELETE FROM case_relations WHERE id = ? AND case_id = ?`, [relationId, caseId])
    await audit(req, 'DELETE', 'case_relation', parseInt(relationId), `case ${caseId}`)
    res.json({ success: true })
  } catch (err) {
    console.error('deleteRelation:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
