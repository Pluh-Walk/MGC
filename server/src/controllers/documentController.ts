import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import path from 'path'
import fs from 'fs'
import { notify } from '../utils/notify'
import { audit } from '../utils/audit'
import { getEffectiveAttorneyId } from '../utils/scope'

// ─── Upload Document ────────────────────────────────────────
export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params
    const { category = 'other', is_client_visible = false, privilege_type = 'none' } = req.body

    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded.' })
      return
    }

    // Verify attorney (or secretary's attorney) owns this case
    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    const [caseRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM cases WHERE id = ? AND attorney_id = ? AND deleted_at IS NULL`,
      [caseId, effectiveAttorneyId]
    )

    if (!caseRows.length) {
      fs.unlinkSync(req.file.path) // remove orphaned file
      res.status(403).json({ success: false, message: 'Case not found or access denied.' })
      return
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO documents (case_id, uploaded_by, filename, original_name, file_size, mime_type, category, privilege_type, is_client_visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        user.id,
        req.file.filename,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
        category,
        privilege_type,
        is_client_visible === 'true' || is_client_visible === true,
      ]
    )

    // Timeline entry
    await pool.query(
      `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
       VALUES (?, 'document', ?, CURDATE(), ?)`,
      [caseId, `Document uploaded: ${req.file.originalname}`, user.id]
    )

    // Notify client if visible
    if (is_client_visible === 'true' || is_client_visible === true) {
      await notify(
        caseRows[0].client_id,
        'document_uploaded',
        `A new document is available: ${req.file.originalname}`,
        Number(caseId)
      )
    }

    await audit(req, 'DOCUMENT_UPLOADED', 'document', result.insertId, req.file.originalname)

    res.status(201).json({ success: true, message: 'Document uploaded.', documentId: result.insertId })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Get Documents for a Case ───────────────────────────────
export const getCaseDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params

    let visibilityFilter = ''
    let privilegeFilter = ''
    if (user.role === 'client') {
      visibilityFilter = ' AND d.is_client_visible = TRUE'
      // Clients cannot see privileged/work-product documents
      privilegeFilter = " AND d.privilege_type NOT IN ('attorney_client','work_product')"
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.id, d.original_name, d.file_size, d.mime_type, d.category,
              d.privilege_type, d.is_client_visible, d.uploaded_at,
              u.fullname
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.case_id = ? AND d.deleted_at IS NULL${visibilityFilter}${privilegeFilter}
       ORDER BY d.uploaded_at DESC`,
      [caseId]
    )

    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Download / Stream Document ─────────────────────────────
export const downloadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.*, c.attorney_id, c.client_id
       FROM documents d
       LEFT JOIN cases c ON c.id = d.case_id
       WHERE d.id = ? AND d.deleted_at IS NULL`,
      [id]
    )

    if (!rows.length) {
      res.status(404).json({ success: false, message: 'Document not found.' })
      return
    }

    const doc = rows[0]

    // Access control
    if (user.role === 'attorney' && doc.attorney_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }
    if (user.role === 'secretary' && doc.attorney_id !== user.attorneyId) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }
    if (user.role === 'client') {
      if (doc.client_id !== user.id || !doc.is_client_visible) {
        res.status(403).json({ success: false, message: 'Access denied.' })
        return
      }
    }

    const filePath = path.join(
      process.cwd(),
      process.env.UPLOAD_DIR || 'uploads',
      `case_${doc.case_id}`,
      doc.filename
    )

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: 'File not found on disk.' })
      return
    }

    await audit(req, 'DOCUMENT_DOWNLOADED', 'document', Number(id), doc.original_name)

    res.setHeader('Content-Disposition', `attachment; filename="${doc.original_name}"`)
    res.setHeader('Content-Type', doc.mime_type)
    fs.createReadStream(filePath).pipe(res)
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Soft Delete Document ───────────────────────────────────
export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.*, c.attorney_id FROM documents d
       LEFT JOIN cases c ON c.id = d.case_id
       WHERE d.id = ? AND d.deleted_at IS NULL`,
      [id]
    )

    if (!rows.length) {
      res.status(404).json({ success: false, message: 'Document not found.' })
      return
    }

    if (rows[0].attorney_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    await pool.query(`UPDATE documents SET deleted_at = NOW() WHERE id = ?`, [id])
    await audit(req, 'DOCUMENT_DELETED', 'document', Number(id))

    res.json({ success: true, message: 'Document removed.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
