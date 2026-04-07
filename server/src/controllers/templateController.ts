/**
 * Document Templates Controller (§3.2)
 *
 * Endpoints:
 *   GET    /api/templates                  — list all accessible templates
 *   POST   /api/templates                  — upload a new template (attorney/admin)
 *   GET    /api/templates/:id/download     — download a template file
 *   PUT    /api/templates/:id             — update metadata (title/category/etc.)
 *   DELETE /api/templates/:id             — soft-delete (attorney owns OR admin)
 */
import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import fs from 'fs'
import path from 'path'
import pool from '../config/db'
import { verifyMagicBytes, scanWithClamav } from '../config/upload'
import { audit } from '../utils/audit'

// ─── GET /api/templates ──────────────────────────────────────────
export const listTemplates = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { category } = req.query

    const conditions: string[] = ['t.deleted_at IS NULL']
    const params: any[] = []

    // Non-admins see system templates + their own
    if (user.role !== 'admin') {
      conditions.push('(t.is_system = 1 OR t.created_by = ?)')
      params.push(user.id)
    }

    if (category) { conditions.push('t.category = ?'); params.push(category) }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.id, t.title, t.category, t.description, t.original_name, t.file_size, t.mime_type,
              t.placeholders, t.is_system, t.created_at,
              u.fullname AS created_by_name
       FROM document_templates t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.is_system DESC, t.category, t.title`,
      params
    )

    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/templates — upload ────────────────────────────────
export const uploadTemplate = async (req: Request, res: Response): Promise<void> => {
  const file = req.file as Express.Multer.File | undefined
  try {
    const user = (req as any).user

    if (!file) {
      res.status(400).json({ success: false, message: 'No file uploaded.' })
      return
    }

    // Magic-byte verification
    const validMime = await verifyMagicBytes(file.path, file.mimetype)
    if (!validMime) {
      fs.unlinkSync(file.path)
      res.status(400).json({ success: false, message: 'File type not allowed.' })
      return
    }

    // ClamAV antivirus scan (best-effort: passes through if ClamAV not available)
    try {
      await scanWithClamav(file.path)
    } catch {
      fs.unlinkSync(file.path)
      res.status(400).json({ success: false, message: 'File rejected: potential virus detected.' })
      return
    }

    const { title, category, description, placeholders } = req.body
    if (!title?.trim()) {
      fs.unlinkSync(file.path)
      res.status(400).json({ success: false, message: 'Title is required.' })
      return
    }

    const validCategories = ['contract','pleading','motion','letter','affidavit','retainer','other']
    const cat = validCategories.includes(category) ? category : 'other'

    // Admins can mark as system-wide
    const is_system = user.role === 'admin' ? (req.body.is_system === 'true' || req.body.is_system === true ? 1 : 0) : 0

    let parsedPlaceholders: any = null
    if (placeholders) {
      try { parsedPlaceholders = JSON.stringify(JSON.parse(placeholders)) } catch { parsedPlaceholders = null }
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO document_templates
         (title, category, description, file_path, original_name, file_size, mime_type, placeholders, is_system, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        cat,
        description ?? null,
        file.path,
        file.originalname,
        file.size,
        file.mimetype,
        parsedPlaceholders,
        is_system,
        user.id,
      ]
    )

    await audit(req, 'TEMPLATE_UPLOADED', 'document_template', result.insertId, `"${title}" uploaded`)

    res.status(201).json({ success: true, id: result.insertId })
  } catch (err: any) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path)
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/templates/:id/download ─────────────────────────────
export const downloadTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [[tpl]] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM document_templates WHERE id = ? AND deleted_at IS NULL`,
      [id]
    )
    if (!tpl) { res.status(404).json({ success: false, message: 'Template not found.' }); return }

    // Access control: must be system template OR owner OR admin
    if (!tpl.is_system && user.role !== 'admin' && tpl.created_by !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    if (!fs.existsSync(tpl.file_path)) {
      res.status(404).json({ success: false, message: 'File no longer available.' })
      return
    }

    res.setHeader('Content-Type', tpl.mime_type)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(tpl.original_name)}"`)
    res.setHeader('Content-Length', tpl.file_size)
    fs.createReadStream(tpl.file_path).pipe(res)
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PUT /api/templates/:id — update metadata ────────────────────
export const updateTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params
    const { title, category, description, placeholders, is_system } = req.body

    const [[tpl]] = await pool.query<RowDataPacket[]>(
      `SELECT id, created_by FROM document_templates WHERE id = ? AND deleted_at IS NULL`,
      [id]
    )
    if (!tpl) { res.status(404).json({ success: false, message: 'Template not found.' }); return }

    if (user.role !== 'admin' && tpl.created_by !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    const validCategories = ['contract','pleading','motion','letter','affidavit','retainer','other']
    const cat = category && validCategories.includes(category) ? category : undefined

    let parsedPlaceholders: string | undefined
    if (placeholders !== undefined) {
      try { parsedPlaceholders = JSON.stringify(JSON.parse(placeholders)) } catch { parsedPlaceholders = undefined }
    }

    await pool.query(
      `UPDATE document_templates SET
         title        = COALESCE(?, title),
         category     = COALESCE(?, category),
         description  = COALESCE(?, description),
         placeholders = COALESCE(?, placeholders),
         is_system    = CASE WHEN ? IS NOT NULL AND ? = 'admin' THEN ? ELSE is_system END
       WHERE id = ?`,
      [
        title?.trim() ?? null,
        cat ?? null,
        description ?? null,
        parsedPlaceholders ?? null,
        is_system, user.role, is_system === true || is_system === 'true' ? 1 : 0,
        id,
      ]
    )

    await audit(req, 'TEMPLATE_UPDATED', 'document_template', Number(id), '')

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── DELETE /api/templates/:id ───────────────────────────────────
export const deleteTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [[tpl]] = await pool.query<RowDataPacket[]>(
      `SELECT id, created_by FROM document_templates WHERE id = ? AND deleted_at IS NULL`,
      [id]
    )
    if (!tpl) { res.status(404).json({ success: false, message: 'Template not found.' }); return }

    if (user.role !== 'admin' && tpl.created_by !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    await pool.query(`UPDATE document_templates SET deleted_at = NOW() WHERE id = ?`, [id])
    await audit(req, 'TEMPLATE_DELETED', 'document_template', Number(id), '')

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
