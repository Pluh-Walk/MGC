/**
 * Document Versioning Controller
 *
 * POST /api/cases/:caseId/documents/:docId/versions  — upload a new version
 * GET  /api/cases/:caseId/documents/:docId/versions  — list all versions
 * GET  /api/cases/:caseId/documents/:docId/versions/:versionId — download specific version
 */
import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import path from 'path'
import fs from 'fs'
import pool from '../config/db'
import { audit } from '../utils/audit'
import { getEffectiveAttorneyId } from '../utils/scope'
import { verifyMagicBytes } from '../config/upload'

async function canAccessDoc(docId: number, caseId: number, user: any): Promise<boolean> {
  const eid = getEffectiveAttorneyId(user)
  const [[doc]] = await pool.query<RowDataPacket[]>(
    `SELECT d.id, c.attorney_id, c.client_id, d.is_client_visible
     FROM documents d JOIN cases c ON c.id = d.case_id
     WHERE d.id = ? AND d.case_id = ? AND d.deleted_at IS NULL`,
    [docId, caseId]
  )
  if (!doc) return false
  if (user.role === 'admin') return true
  if (user.role === 'client') return doc.client_id === user.id && !!doc.is_client_visible
  return (eid ?? user.id) === doc.attorney_id
}

// GET /api/cases/:caseId/documents/:docId/versions
export const listDocumentVersions = async (req: Request, res: Response): Promise<void> => {
  const user    = (req as any).user
  const caseId  = Number(req.params.caseId)
  const docId   = Number(req.params.docId)

  try {
    if (!(await canAccessDoc(docId, caseId, user))) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    const [versions] = await pool.query<RowDataPacket[]>(
      `SELECT dv.*, u.fullname AS uploader_name
       FROM document_versions dv JOIN users u ON u.id = dv.uploaded_by
       WHERE dv.document_id = ?
       ORDER BY dv.version_number ASC`,
      [docId]
    )

    res.json({ success: true, data: versions })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// POST /api/cases/:caseId/documents/:docId/versions
export const uploadDocumentVersion = async (req: Request, res: Response): Promise<void> => {
  const user    = (req as any).user
  const caseId  = Number(req.params.caseId)
  const docId   = Number(req.params.docId)

  if (user.role === 'client') { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded.' }); return }

  try {
    // Magic-byte MIME verification
    const mimeOk = await verifyMagicBytes(req.file.path, req.file.mimetype)
    if (!mimeOk) {
      fs.unlinkSync(req.file.path)
      res.status(400).json({ success: false, message: 'File content does not match the declared type.' })
      return
    }

    if (!(await canAccessDoc(docId, caseId, user))) {
      fs.unlinkSync(req.file.path)
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    // Determine next version number
    const [[maxVer]] = await pool.query<RowDataPacket[]>(
      'SELECT MAX(version_number) AS max_v FROM document_versions WHERE document_id = ?', [docId]
    )
    const nextVersion = (maxVer?.max_v ?? 0) + 1

    const relPath = path.relative(process.cwd(), req.file.path)

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO document_versions
         (document_id, version_number, file_path, original_name, file_size, uploaded_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [docId, nextVersion, relPath, req.file.originalname, req.file.size, user.id, req.body.notes || null]
    )

    // Update the main document's filename to point to the latest version
    await pool.query(
      'UPDATE documents SET filename = ?, original_name = ?, file_size = ? WHERE id = ?',
      [req.file.filename, req.file.originalname, req.file.size, docId]
    )

    await audit(req, 'UPLOAD_VERSION', 'document', docId,
      `Version ${nextVersion} uploaded for document ${docId}`)

    res.status(201).json({ success: true, id: result.insertId, version_number: nextVersion })
  } catch (err: any) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
    res.status(500).json({ success: false, message: err.message })
  }
}

// GET /api/cases/:caseId/documents/:docId/versions/:versionId
export const downloadDocumentVersion = async (req: Request, res: Response): Promise<void> => {
  const user      = (req as any).user
  const caseId    = Number(req.params.caseId)
  const docId     = Number(req.params.docId)
  const versionId = Number(req.params.versionId)

  if (!(await canAccessDoc(docId, caseId, user))) {
    res.status(403).json({ success: false, message: 'Access denied.' })
    return
  }

  const [[ver]] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM document_versions WHERE id = ? AND document_id = ?', [versionId, docId]
  )
  if (!ver) { res.status(404).json({ success: false, message: 'Version not found.' }); return }

  const absPath = path.join(process.cwd(), ver.file_path)
  if (!fs.existsSync(absPath)) { res.status(404).json({ success: false, message: 'File not found on disk.' }); return }

  await audit(req, 'DOWNLOAD_VERSION', 'document', docId,
    `Downloaded version ${ver.version_number}`)

  res.download(absPath, ver.original_name)
}
