import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { getEffectiveAttorneyId } from '../utils/scope'
import { audit } from '../utils/audit'

// ─── GET /api/cases/tags  — list all available tags ─────────────────
export const listTags = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ct.*, u.fullname
       FROM case_tags ct JOIN users u ON u.id = ct.created_by
       ORDER BY ct.name`
    )
    res.json({ success: true, data: rows })
  } catch (err) {
    console.error('listTags:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── POST /api/cases/tags  — create a tag ───────────────────────────
export const createTag = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    if (user.role === 'client') { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    const { name, color } = req.body
    if (!name) { res.status(400).json({ success: false, message: 'name is required.' }); return }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO case_tags (name, color, created_by) VALUES (?, ?, ?)`,
      [name.trim(), color ?? '#6366f1', user.id]
    )
    res.status(201).json({ success: true, id: result.insertId })
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ success: false, message: 'Tag name already exists.' }); return
    }
    console.error('createTag:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── DELETE /api/cases/tags/:tagId ──────────────────────────────────
export const deleteTag = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    if (user.role !== 'attorney' && user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }
    await pool.query(`DELETE FROM case_tags WHERE id = ?`, [req.params.tagId])
    res.json({ success: true })
  } catch (err) {
    console.error('deleteTag:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── GET /api/cases/:caseId/tags ────────────────────────────────────
export const getCaseTags = async (req: Request, res: Response): Promise<void> => {
  try {
    const { caseId } = req.params
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ct.id, ct.name, ct.color
       FROM case_tag_map ctm
       JOIN case_tags ct ON ct.id = ctm.tag_id
       WHERE ctm.case_id = ?
       ORDER BY ct.name`,
      [caseId]
    )
    res.json({ success: true, data: rows })
  } catch (err) {
    console.error('getCaseTags:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── POST /api/cases/:caseId/tags  — assign tag to case ────────────
export const assignTag = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    if (user.role === 'client') { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    const { caseId } = req.params
    const { tag_id } = req.body
    if (!tag_id) { res.status(400).json({ success: false, message: 'tag_id is required.' }); return }

    // Verify case access
    const eid = getEffectiveAttorneyId(user)
    const [caseRows] = await pool.query<RowDataPacket[]>(
      `SELECT attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`, [caseId]
    )
    if (!caseRows.length) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    if (user.role !== 'admin' && eid !== caseRows[0].attorney_id) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }

    await pool.query(
      `INSERT IGNORE INTO case_tag_map (case_id, tag_id, assigned_by) VALUES (?, ?, ?)`,
      [caseId, tag_id, user.id]
    )
    res.status(201).json({ success: true })
  } catch (err) {
    console.error('assignTag:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── DELETE /api/cases/:caseId/tags/:tagId  — remove tag ───────────
export const removeTag = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    if (user.role === 'client') { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    const { caseId, tagId } = req.params
    await pool.query(`DELETE FROM case_tag_map WHERE case_id = ? AND tag_id = ?`, [caseId, tagId])
    res.json({ success: true })
  } catch (err) {
    console.error('removeTag:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
