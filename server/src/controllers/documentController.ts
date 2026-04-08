import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import path from 'path'
import fs from 'fs'
import archiver from 'archiver'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
import { notify } from '../utils/notify'
import { notifyWithEmail } from '../utils/emailNotify'
import { audit } from '../utils/audit'
import { getEffectiveAttorneyId } from '../utils/scope'
import { documentUploadedEmail } from '../templates/emailTemplates'
import { verifyMagicBytes, scanWithClamav } from '../config/upload'

/** Extract text from a PDF file (best-effort — does not throw). */
async function extractPdfText(filePath: string): Promise<string | null> {
  try {
    const buffer = fs.readFileSync(filePath)
    const data = await pdfParse(buffer)
    return data.text?.trim() || null
  } catch {
    return null
  }
}

// ─── Upload Document ────────────────────────────────────────
export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params
    const { category = 'other', is_client_visible = false, privilege_type = 'none' } = req.body

    if (!req.file) {
      // req.file is undefined either because no file was sent, or because the
      // fileFilter rejected the MIME type (cb(null, false)).
      const allowed = 'PDF, JPEG, PNG, WEBP, Word (.doc/.docx), Excel (.xls/.xlsx)'
      res.status(400).json({
        success: false,
        message: `File type not accepted. Please upload one of: ${allowed}.`,
      })
      return
    }

    // ── Magic-byte verification: reject files whose bytes don't match their extension
    const mimeOk = await verifyMagicBytes(req.file.path, req.file.mimetype)
    if (!mimeOk) {
      fs.unlinkSync(req.file.path)
      res.status(400).json({ success: false, message: 'File content does not match the declared file type. Upload rejected.' })
      return
    }

    // ── ClamAV antivirus scan (best-effort: passes through if ClamAV not available)
    try {
      await scanWithClamav(req.file.path)
    } catch (err: any) {
      fs.unlinkSync(req.file.path)
      res.status(400).json({ success: false, message: 'File rejected: potential virus detected.' })
      return
    }

    // Verify access: attorney/secretary must own the case; client must be the case's client
    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    let caseRows: RowDataPacket[]

    if (user.role === 'client') {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM cases WHERE id = ? AND client_id = ? AND deleted_at IS NULL`,
        [caseId, user.id]
      )
      caseRows = rows
    } else {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM cases WHERE id = ? AND attorney_id = ? AND deleted_at IS NULL`,
        [caseId, effectiveAttorneyId]
      )
      caseRows = rows
    }

    if (!caseRows.length) {
      fs.unlinkSync(req.file.path) // remove orphaned file
      res.status(403).json({ success: false, message: 'Case not found or access denied.' })
      return
    }

    // Clients always upload as client-visible
    const clientVisible = user.role === 'client'
      ? true
      : is_client_visible === 'true' || is_client_visible === true

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
        clientVisible,
      ]
    )

    const docId = result.insertId

    // ── Background PDF text extraction for FTS ────────────────
    if (req.file.mimetype === 'application/pdf') {
      const filePath = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', `case_${caseId}`, req.file.filename)
      extractPdfText(filePath).then(text => {
        if (text) {
          pool.query(`UPDATE documents SET extracted_text = ? WHERE id = ?`, [text.slice(0, 65535), docId]).catch(() => {})
        }
      })
    }

    // Timeline entry
    await pool.query(
      `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
       VALUES (?, 'document', ?, CURDATE(), ?)`,
      [caseId, `Document uploaded: ${req.file.originalname}`, user.id]
    )

    // Notify client if visible (attorney/secretary uploads that are marked client-visible; or any client upload — notify attorney)
    if (clientVisible && user.role !== 'client') {
      const _origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
      await notifyWithEmail(
        caseRows[0].client_id, 'document_uploaded',
        `A new document is available: ${req.file.originalname}`,
        Number(caseId),
        `New Document: ${req.file.originalname}`,
        (name) => documentUploadedEmail(name, caseRows[0].title, caseRows[0].case_number, req.file!.originalname, `${_origin}/cases/${caseId}`)
      )
    }

    await audit(req, 'DOCUMENT_UPLOADED', 'document', docId, req.file.originalname)

    res.status(201).json({ success: true, message: 'Document uploaded.', documentId: docId })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Get Documents for a Case ───────────────────────────────
export const getCaseDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params
    const { search } = req.query

    let visibilityFilter = ''
    let privilegeFilter = ''
    if (user.role === 'client') {
      visibilityFilter = ' AND d.is_client_visible = TRUE'
      // Clients cannot see privileged/work-product documents
      privilegeFilter = " AND d.privilege_type NOT IN ('attorney_client','work_product')"
    }

    let rows: RowDataPacket[]

    if (search && typeof search === 'string' && search.trim()) {
      // Full-text search using MySQL FULLTEXT index on original_name + extracted_text
      const [r] = await pool.query<RowDataPacket[]>(
        `SELECT d.id, d.original_name, d.file_size, d.mime_type, d.category,
                d.privilege_type, d.is_client_visible, d.uploaded_at,
                u.fullname,
                MATCH(d.original_name, d.extracted_text) AGAINST(? IN BOOLEAN MODE) AS relevance
         FROM documents d
         LEFT JOIN users u ON u.id = d.uploaded_by
         WHERE d.case_id = ? AND d.deleted_at IS NULL${visibilityFilter}${privilegeFilter}
           AND MATCH(d.original_name, d.extracted_text) AGAINST(? IN BOOLEAN MODE)
         ORDER BY relevance DESC, d.uploaded_at DESC`,
        [search.trim(), caseId, search.trim()]
      )
      rows = r
    } else {
      const [r] = await pool.query<RowDataPacket[]>(
        `SELECT d.id, d.original_name, d.file_size, d.mime_type, d.category,
                d.privilege_type, d.is_client_visible, d.uploaded_at,
                u.fullname
         FROM documents d
         LEFT JOIN users u ON u.id = d.uploaded_by
         WHERE d.case_id = ? AND d.deleted_at IS NULL${visibilityFilter}${privilegeFilter}
         ORDER BY d.uploaded_at DESC`,
        [caseId]
      )
      rows = r
    }

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

// ─── GET /api/cases/:caseId/documents/privilege-log ────────────────
export const exportPrivilegeLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params

    // Verify case access (attorney/secretary/admin only)
    const eid = getEffectiveAttorneyId(user)
    const [cases] = await pool.query<RowDataPacket[]>(
      `SELECT id, title, case_number, attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`,
      [caseId]
    )
    if (!cases.length) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    const c = cases[0]
    if (user.role !== 'admin' && eid !== c.attorney_id) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }

    const [docs] = await pool.query<RowDataPacket[]>(
      `SELECT d.id, d.original_name, d.category, d.privilege_type, d.uploaded_at, d.is_client_visible,
              u.fullname AS uploaded_by
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploaded_by_id
       WHERE d.case_id = ? AND d.privilege_type != 'none' AND d.deleted_at IS NULL
       ORDER BY d.uploaded_at ASC`,
      [caseId]
    )

    const rows = docs as RowDataPacket[]
    const escCsv = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = 'Document ID,File Name,Category,Privilege Type,Uploaded By,Uploaded At,Client Visible'
    const lines = [
      `Privilege Log`,
      `Case: ${escCsv((c.case_number ?? '') + ' – ' + (c.title ?? ''))}`,
      `Generated: ${new Date().toISOString()}`,
      ``,
      header,
      ...rows.map(d => [
        escCsv(d.id),
        escCsv(d.original_name),
        escCsv(d.category),
        escCsv(d.privilege_type.replace(/_/g, ' ')),
        escCsv(d.uploaded_by ?? ''),
        escCsv(d.uploaded_at ? new Date(d.uploaded_at).toLocaleString('en-PH') : ''),
        escCsv(d.is_client_visible ? 'Yes' : 'No'),
      ].join(','))
    ]

    await audit(req, 'PRIVILEGE_LOG_EXPORTED', 'case', parseInt(caseId), `${rows.length} documents`)

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="privilege-log-case-${caseId}.csv"`)
    res.send(lines.join('\r\n'))
  } catch (err: any) {
    console.error('exportPrivilegeLog:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── DELETE /api/cases/:caseId/documents/bulk ──────────────────────
export const bulkDeleteDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params
    const { ids } = req.body as { ids: number[] }

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, message: 'ids[] is required.' }); return
    }

    const eid = getEffectiveAttorneyId(user)
    const [cases] = await pool.query<RowDataPacket[]>(
      `SELECT attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`, [caseId]
    )
    if (!cases.length) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    if (user.role !== 'admin' && eid !== cases[0].attorney_id) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }

    const placeholders = ids.map(() => '?').join(',')
    await pool.query(
      `UPDATE documents SET deleted_at = NOW() WHERE id IN (${placeholders}) AND case_id = ?`,
      [...ids, caseId]
    )

    await audit(req, 'DOCUMENTS_BULK_DELETED', 'case', parseInt(caseId), `ids: ${ids.join(',')}`)
    res.json({ success: true, deleted: ids.length })
  } catch (err: any) {
    console.error('bulkDeleteDocuments:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── GET /api/cases/:caseId/documents/bulk-download ───────────────
export const bulkDownloadDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params
    const idsParam = req.query.ids as string

    if (!idsParam) { res.status(400).json({ success: false, message: 'ids param required.' }); return }
    const ids = idsParam.split(',').map(Number).filter(n => !isNaN(n) && n > 0)
    if (ids.length === 0) { res.status(400).json({ success: false, message: 'No valid ids.' }); return }

    const eid = getEffectiveAttorneyId(user)
    const [cases] = await pool.query<RowDataPacket[]>(
      `SELECT attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`, [caseId]
    )
    if (!cases.length) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    if (user.role !== 'admin' && eid !== cases[0].attorney_id) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }

    const placeholders = ids.map(() => '?').join(',')
    const [docs] = await pool.query<RowDataPacket[]>(
      `SELECT id, original_name, file_path FROM documents
       WHERE id IN (${placeholders}) AND case_id = ? AND deleted_at IS NULL`,
      [...ids, caseId]
    )
    if (!(docs as RowDataPacket[]).length) {
      res.status(404).json({ success: false, message: 'No documents found.' }); return
    }

    const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads')

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="documents-case-${caseId}.zip"`)

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.on('error', (err) => { throw err })
    archive.pipe(res)

    for (const doc of docs as RowDataPacket[]) {
      const absPath = path.join(uploadDir, doc.file_path.replace(/^uploads[/\\]/, ''))
      if (fs.existsSync(absPath)) {
        archive.file(absPath, { name: doc.original_name })
      }
    }

    await archive.finalize()
    await audit(req, 'DOCUMENTS_BULK_DOWNLOADED', 'case', parseInt(caseId), `ids: ${ids.join(',')}`)
  } catch (err: any) {
    console.error('bulkDownloadDocuments:', err)
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Server error.' })
    }
  }
}
