/**
 * Signed Download Token Controller (§1.3 — File Upload Security)
 *
 * Replaces direct /uploads static file serving with authenticated,
 * time-limited single-use download links.
 *
 * Endpoints:
 *   POST /api/documents/:id/token          — issue a 15-min download token
 *   POST /api/cases/:caseId/documents/:docId/versions/:versionId/token — version token
 *   GET  /api/documents/by-token/:token    — stream file (no auth needed — token IS the auth)
 */
import { Request, Response } from 'express'
import { RowDataPacket } from 'mysql2'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import pool from '../config/db'
import { getEffectiveAttorneyId } from '../utils/scope'
import { audit } from '../utils/audit'

const TOKEN_TTL_MINUTES = 15

// ─── Access check helper ──────────────────────────────────────────────────────
async function canDownload(docId: number, user: any): Promise<boolean> {
  const [[doc]] = await pool.query<RowDataPacket[]>(
    `SELECT d.id, d.privilege_type, d.is_client_visible,
            c.attorney_id, c.client_id
     FROM documents d
     JOIN cases c ON c.id = d.case_id
     WHERE d.id = ? AND d.deleted_at IS NULL`,
    [docId]
  )
  if (!doc) return false
  if (user.role === 'admin') return true

  const eid = getEffectiveAttorneyId(user) ?? user.id
  if (user.role === 'attorney' || user.role === 'secretary') {
    return doc.attorney_id === eid
  }
  if (user.role === 'client') {
    return doc.client_id === user.id && !!doc.is_client_visible
  }
  return false
}

// ─── POST /api/documents/:id/token ────────────────────────────────────────────
export const issueDocumentToken = async (req: Request, res: Response): Promise<void> => {
  const user    = (req as any).user
  const docId   = Number(req.params.id)

  if (!Number.isFinite(docId)) {
    res.status(400).json({ success: false, message: 'Invalid document ID.' })
    return
  }

  try {
    if (!(await canDownload(docId, user))) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    // Purge expired tokens first (housekeeping)
    await pool.query('DELETE FROM download_tokens WHERE expires_at < NOW()')

    const raw = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)

    await pool.query(
      `INSERT INTO download_tokens (token, user_id, document_id, version_id, expires_at)
       VALUES (?, ?, ?, NULL, ?)`,
      [raw, user.id, docId, expiresAt]
    )

    res.json({ success: true, token: raw, expires_at: expiresAt.toISOString() })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/cases/:caseId/documents/:docId/versions/:versionId/token ───────
export const issueVersionToken = async (req: Request, res: Response): Promise<void> => {
  const user      = (req as any).user
  const docId     = Number(req.params.docId)
  const versionId = Number(req.params.versionId)

  if (!Number.isFinite(docId) || !Number.isFinite(versionId)) {
    res.status(400).json({ success: false, message: 'Invalid ID.' })
    return
  }

  try {
    if (!(await canDownload(docId, user))) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    await pool.query('DELETE FROM download_tokens WHERE expires_at < NOW()')

    const raw = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)

    await pool.query(
      `INSERT INTO download_tokens (token, user_id, document_id, version_id, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [raw, user.id, docId, versionId, expiresAt]
    )

    res.json({ success: true, token: raw, expires_at: expiresAt.toISOString() })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/documents/by-token/:token ──────────────────────────────────────
// Token is the credential — no Authorization header needed.
export const downloadByToken = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    res.status(400).json({ success: false, message: 'Invalid token.' })
    return
  }

  try {
    const [[row]] = await pool.query<RowDataPacket[]>(
      `SELECT dt.*, d.filename, d.original_name, d.mime_type, d.case_id,
              dv.file_path AS version_path, dv.original_name AS version_name
       FROM download_tokens dt
       JOIN documents d ON d.id = dt.document_id AND d.deleted_at IS NULL
       LEFT JOIN document_versions dv ON dv.id = dt.version_id
       WHERE dt.token = ? AND dt.expires_at > NOW() AND dt.used_at IS NULL`,
      [token]
    )

    if (!row) {
      res.status(410).json({ success: false, message: 'Download link has expired or already been used.' })
      return
    }

    // Mark token as used (single-use)
    await pool.query('UPDATE download_tokens SET used_at = NOW() WHERE token = ?', [token])

    // Resolve file path
    let filePath: string
    let originalName: string
    let mimeType: string

    if (row.version_id && row.version_path) {
      filePath     = path.join(process.cwd(), row.version_path)
      originalName = row.version_name || row.original_name
      mimeType     = row.mime_type
    } else {
      filePath     = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', `case_${row.case_id}`, row.filename)
      originalName = row.original_name
      mimeType     = row.mime_type
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: 'File not found on disk.' })
      return
    }

    // Audit using the token owner's user id
    await pool.query(
      `INSERT INTO audit_log (user_id, action, target_type, target_id, details, ip_address)
       VALUES (?, 'DOCUMENT_DOWNLOADED', 'document', ?, ?, ?)`,
      [row.user_id, row.document_id, `token download: ${originalName}`, req.ip]
    )

    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`)
    res.setHeader('Content-Type', mimeType)
    fs.createReadStream(filePath).pipe(res)
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
