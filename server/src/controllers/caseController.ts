import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { generateCaseNumber } from '../utils/caseNumber'
import { notify } from '../utils/notify'
import { audit } from '../utils/audit'
import { getCaseScope, getEffectiveAttorneyId } from '../utils/scope'

// ─── Create Case ────────────────────────────────────────────
export const createCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { title, case_type, client_id, court_name, judge_name, filing_date } = req.body

    if (!title || !case_type || !client_id) {
      res.status(400).json({ success: false, message: 'title, case_type, and client_id are required.' })
      return
    }

    const case_number = await generateCaseNumber()

    // Secretary creates as draft; attorney creates as active
    const isSecretary = user.role === 'secretary'
    const attorney_id = isSecretary ? user.attorneyId : user.id
    const status = isSecretary ? 'draft' : 'active'
    const drafted_by = isSecretary ? user.id : null

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO cases (case_number, title, case_type, client_id, attorney_id, court_name, judge_name, filing_date, status, drafted_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [case_number, title, case_type, client_id, attorney_id, court_name || null, judge_name || null, filing_date || null, status, drafted_by]
    )

    const caseId = result.insertId

    // Auto timeline entry
    await pool.query(
      `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
       VALUES (?, 'status_change', ?, CURDATE(), ?)`,
      [caseId, isSecretary ? 'Case draft submitted by secretary — pending attorney approval' : 'Case created with status: active', user.id]
    )

    if (!isSecretary) {
      // Notify the client only when attorney directly creates
      await notify(client_id, 'case_update', `A new case has been opened for you: ${title} (${case_number})`, caseId)
    }

    await audit(req, 'CASE_CREATED', 'case', caseId, `Case number: ${case_number}${isSecretary ? ' (draft)' : ''}`)

    res.status(201).json({ success: true, message: isSecretary ? 'Case draft submitted for attorney review.' : 'Case created.', caseId, case_number, status })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
// ─── Get Case Drafts (attorney sees their pending drafts) ──────
export const getCaseDrafts = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    if (effectiveAttorneyId === null) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.id, c.case_number, c.title, c.case_type, c.status, c.filing_date, c.created_at,
              cl.fullname AS client_name, drafter.fullname AS drafted_by_name
       FROM cases c
       LEFT JOIN users cl ON cl.id = c.client_id
       LEFT JOIN users drafter ON drafter.id = c.drafted_by
       WHERE c.attorney_id = ? AND c.status = 'draft' AND c.deleted_at IS NULL
       ORDER BY c.created_at DESC`,
      [effectiveAttorneyId]
    )

    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Approve Case Draft (attorney only) ────────────────
export const approveCaseDraft = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM cases WHERE id = ? AND deleted_at IS NULL AND status = 'draft'`,
      [id]
    )
    if (!existing.length) {
      res.status(404).json({ success: false, message: 'Draft case not found.' })
      return
    }
    if (existing[0].attorney_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    await pool.query(`UPDATE cases SET status = 'active', drafted_by = drafted_by WHERE id = ?`, [id])

    await pool.query(
      `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
       VALUES (?, 'status_change', 'Case draft approved by attorney — status set to active', CURDATE(), ?)`,
      [id, user.id]
    )

    await notify(
      existing[0].client_id,
      'case_update',
      `A new case has been opened for you: ${existing[0].title} (${existing[0].case_number})`,
      Number(id)
    )

    await audit(req, 'CASE_DRAFT_APPROVED', 'case', Number(id))

    res.json({ success: true, message: 'Case approved and is now active.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
// ─── Get All Cases (scoped by role) ──────────────────────────────
export const getCases = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { status, search, page = 1, limit = 20 } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    const scope = getCaseScope(user)
    let baseWhere = `c.deleted_at IS NULL AND ${scope.clause}`
    const params: any[] = [...scope.params]

    // Clients and admins never see drafts in the main list
    if (user.role === 'client' || user.role === 'admin') {
      baseWhere += " AND c.status != 'draft'"
    }

    if (status) {
      baseWhere += ' AND c.status = ?'
      params.push(status)
    }

    if (search) {
      baseWhere += ' AND (c.title LIKE ? OR c.case_number LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.id, c.case_number, c.title, c.case_type, c.status, c.filing_date, c.created_at,
              cl.fullname AS client_name, at.fullname AS attorney_name
       FROM cases c
       LEFT JOIN users cl ON cl.id = c.client_id
       LEFT JOIN users at ON at.id = c.attorney_id
       WHERE ${baseWhere}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    )

    const [[{ total }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM cases c WHERE ${baseWhere}`,
      params
    )

    res.json({ success: true, data: rows, total, page: Number(page), limit: Number(limit) })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Get Single Case ────────────────────────────────────────
export const getCaseById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.*, cl.fullname AS client_name, cl.email AS client_email,
              at.fullname AS attorney_name, at.email AS attorney_email
       FROM cases c
       LEFT JOIN users cl ON cl.id = c.client_id
       LEFT JOIN users at ON at.id = c.attorney_id
       WHERE c.id = ? AND c.deleted_at IS NULL`,
      [id]
    )

    if (!rows.length) {
      res.status(404).json({ success: false, message: 'Case not found.' })
      return
    }

    const c = rows[0]

    // Access control
    if (user.role === 'attorney' && c.attorney_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }
    if (user.role === 'secretary' && c.attorney_id !== user.attorneyId) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }
    if (user.role === 'client' && c.client_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    // Fetch timeline
    const [timeline] = await pool.query<RowDataPacket[]>(
      `SELECT t.*, u.fullname AS created_by_name
       FROM case_timeline t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.case_id = ?
       ORDER BY t.event_date DESC, t.created_at DESC`,
      [id]
    )

    // Fetch notes (attorney sees all; secretary sees non-private; client sees public only)
    const noteFilter = user.role === 'attorney' ? '' : ' AND n.is_private = FALSE'
    const [notes] = await pool.query<RowDataPacket[]>(
      `SELECT n.*, u.fullname AS author_name
       FROM case_notes n
       LEFT JOIN users u ON u.id = n.author_id
       WHERE n.case_id = ?${noteFilter}
       ORDER BY n.created_at DESC`,
      [id]
    )

    res.json({ success: true, data: { ...c, timeline, notes } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Update Case ────────────────────────────────────────────
export const updateCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params
    const { title, case_type, status, court_name, judge_name, filing_date } = req.body

    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM cases WHERE id = ? AND deleted_at IS NULL`,
      [id]
    )

    if (!existing.length) {
      res.status(404).json({ success: false, message: 'Case not found.' })
      return
    }

    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    if (effectiveAttorneyId === null || existing[0].attorney_id !== effectiveAttorneyId) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    // Secretary can only update limited fields (not status)
    if (user.role === 'secretary') {
      const allowedFromDraft = existing[0].status === 'draft'
      if (allowedFromDraft) {
        // Secretary may re-edit their own draft
        await pool.query(
          `UPDATE cases SET title=?, case_type=?, court_name=?, judge_name=?, filing_date=?
           WHERE id = ?`,
          [
            title || existing[0].title,
            case_type || existing[0].case_type,
            court_name ?? existing[0].court_name,
            judge_name ?? existing[0].judge_name,
            filing_date ?? existing[0].filing_date,
            id,
          ]
        )
      } else {
        // Active/closed cases: only metadata, no filing_date or status
        await pool.query(
          `UPDATE cases SET title=?, case_type=?, court_name=?, judge_name=?
           WHERE id = ?`,
          [
            title || existing[0].title,
            case_type || existing[0].case_type,
            court_name ?? existing[0].court_name,
            judge_name ?? existing[0].judge_name,
            id,
          ]
        )
      }
      await audit(req, 'CASE_UPDATED', 'case', Number(id), 'Updated by secretary')
      res.json({ success: true, message: 'Case updated.' })
      return
    }

    const oldStatus = existing[0].status

    await pool.query(
      `UPDATE cases SET title=?, case_type=?, status=?, court_name=?, judge_name=?, filing_date=?
       WHERE id = ?`,
      [
        title || existing[0].title,
        case_type || existing[0].case_type,
        status || existing[0].status,
        court_name ?? existing[0].court_name,
        judge_name ?? existing[0].judge_name,
        filing_date ?? existing[0].filing_date,
        id,
      ]
    )

    // Auto timeline entry on status change
    if (status && status !== oldStatus) {
      await pool.query(
        `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
         VALUES (?, 'status_change', ?, CURDATE(), ?)`,
        [id, `Status changed from ${oldStatus} to ${status}`, user.id]
      )
      await notify(
        existing[0].client_id,
        'case_update',
        `Case "${existing[0].title}" status updated to: ${status}`,
        Number(id)
      )
    }

    await audit(req, 'CASE_UPDATED', 'case', Number(id))

    res.json({ success: true, message: 'Case updated.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Soft Delete Case ───────────────────────────────────────
export const deleteCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM cases WHERE id = ? AND deleted_at IS NULL`,
      [id]
    )

    if (!existing.length) {
      res.status(404).json({ success: false, message: 'Case not found.' })
      return
    }

    if (existing[0].attorney_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    await pool.query(`UPDATE cases SET deleted_at = NOW() WHERE id = ?`, [id])
    await audit(req, 'CASE_DELETED', 'case', Number(id))

    res.json({ success: true, message: 'Case archived.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Add Note ───────────────────────────────────────────────
export const addNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params
    const { content, is_private = true } = req.body

    if (!content) {
      res.status(400).json({ success: false, message: 'content is required.' })
      return
    }

    // Secretary can only add non-private notes
    const notePrivacy = user.role === 'secretary' ? false : is_private

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO case_notes (case_id, author_id, content, is_private) VALUES (?, ?, ?, ?)`,
      [id, user.id, content, notePrivacy]
    )

    await pool.query(
      `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
       VALUES (?, 'note', ?, CURDATE(), ?)`,
      [id, `Note added by ${user.fullname || 'attorney'}`, user.id]
    )

    await audit(req, 'NOTE_ADDED', 'case', Number(id))

    res.status(201).json({ success: true, message: 'Note added.', noteId: result.insertId })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Get Client List (attorney or secretary — scoped to linked attorney's cases) ─
export const getClientList = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const effectiveAttorneyId = getEffectiveAttorneyId(user)

    let rows: RowDataPacket[]
    if (effectiveAttorneyId !== null) {
      // Return only clients with at least one case under this attorney
      ;[rows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT u.id, u.fullname, u.email, u.username, u.id_verified,
                cp.phone, cp.address, cp.occupation
         FROM users u
         LEFT JOIN client_profiles cp ON cp.user_id = u.id
         INNER JOIN cases c ON c.client_id = u.id AND c.attorney_id = ? AND c.deleted_at IS NULL
         WHERE u.role = 'client'
         ORDER BY u.fullname ASC`,
        [effectiveAttorneyId]
      )
    } else {
      ;[rows] = await pool.query<RowDataPacket[]>(
        `SELECT u.id, u.fullname, u.email, u.username, u.id_verified,
                cp.phone, cp.address, cp.occupation
         FROM users u
         LEFT JOIN client_profiles cp ON cp.user_id = u.id
         WHERE u.role = 'client'
         ORDER BY u.fullname ASC`
      )
    }
    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
