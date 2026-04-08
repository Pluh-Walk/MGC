import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { generateCaseNumber } from '../utils/caseNumber'
import { notifyWithEmail } from '../utils/emailNotify'
import { audit } from '../utils/audit'
import {
  caseAssignedEmail,
  caseStatusChangedEmail,
  caseClosedEmail,
} from '../templates/emailTemplates'
import { getCaseScope, getEffectiveAttorneyId } from '../utils/scope'
import { triggerSurveyForCase } from './surveyController'

// ─── Create Case ────────────────────────────────────────────
export const createCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const {
      title, case_type, client_id, court_name, judge_name, filing_date,
      description, docket_number, priority, opposing_party, opposing_counsel, retainer_amount,
    } = req.body

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
      `INSERT INTO cases
         (case_number, title, description, case_type, client_id, attorney_id,
          court_name, docket_number, judge_name, filing_date, status, drafted_by,
          priority, opposing_party, opposing_counsel, retainer_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        case_number, title, description || null, case_type, client_id, attorney_id,
        court_name || null, docket_number || null, judge_name || null, filing_date || null,
        status, drafted_by,
        priority || 'normal', opposing_party || null, opposing_counsel || null,
        retainer_amount || null,
      ]
    )

    const caseId = result.insertId

    // ─── Conflict of interest check (warning only, non-blocking) ──
    let conflictWarning: string | null = null
    if (opposing_party) {
      // Check if the opposing party name matches any existing client in the system
      const [conflictRows] = await pool.query<RowDataPacket[]>(
        `SELECT u.fullname, u.email
         FROM users u
         WHERE u.role = 'client'
           AND (u.fullname LIKE ? OR u.email LIKE ?)
         LIMIT 3`,
        [`%${opposing_party}%`, `%${opposing_party}%`]
      )
      if (conflictRows.length > 0) {
        const names = (conflictRows as RowDataPacket[]).map(r => r.fullname).join(', ')
        conflictWarning = `Potential conflict of interest: opposing party "${opposing_party}" matches existing client(s): ${names}. Please review.`
      }
    }

    // Auto timeline entry
    await pool.query(
      `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
       VALUES (?, 'status_change', ?, CURDATE(), ?)`,
      [caseId, isSecretary ? 'Case draft submitted by secretary — pending attorney approval' : 'Case created with status: active', user.id]
    )

    if (!isSecretary) {
      // Notify the client only when attorney directly creates
      const _origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
      await notifyWithEmail(
        client_id, 'case_update',
        `A new case has been opened for you: ${title} (${case_number})`,
        caseId,
        `New Case: ${case_number} — ${title}`,
        (name) => caseAssignedEmail(name, title, case_number, `${_origin}/cases/${caseId}`)
      )
    }

    await audit(req, 'CASE_CREATED', 'case', caseId, `Case number: ${case_number}${isSecretary ? ' (draft)' : ''}`)

    res.status(201).json({
      success: true,
      message: isSecretary ? 'Case draft submitted for attorney review.' : 'Case created.',
      caseId,
      case_number,
      status,
      ...(conflictWarning ? { conflict_warning: conflictWarning } : {})
    })
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

    const _origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
    await notifyWithEmail(
      existing[0].client_id, 'case_update',
      `A new case has been opened for you: ${existing[0].title} (${existing[0].case_number})`,
      Number(id),
      `New Case: ${existing[0].case_number} — ${existing[0].title}`,
      (name) => caseAssignedEmail(name, existing[0].title, existing[0].case_number, `${_origin}/cases/${id}`)
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
    const { status, search, page = 1, limit = 20, priority, case_type, overdue_only } = req.query
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
    if (priority) {
      baseWhere += ' AND c.priority = ?'
      params.push(priority)
    }
    if (case_type) {
      baseWhere += ' AND c.case_type = ?'
      params.push(case_type)
    }
    if (overdue_only === 'true') {
      baseWhere += ` AND EXISTS (SELECT 1 FROM case_deadlines od WHERE od.case_id = c.id AND od.is_completed = 0 AND od.due_date < CURDATE())`
    }

    if (search) {
      baseWhere += ' AND (c.title LIKE ? OR c.case_number LIKE ? OR c.docket_number LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.id, c.case_number, c.title, c.case_type, c.status, c.priority,
              c.filing_date, c.created_at, c.outcome,
              cl.fullname AS client_name, at.fullname AS attorney_name,
              (
                SELECT COUNT(*) FROM case_deadlines d
                WHERE d.case_id = c.id AND d.is_completed = FALSE AND d.due_date < CURDATE()
              ) AS overdue_deadlines,
              (
                SELECT MIN(d2.due_date) FROM case_deadlines d2
                WHERE d2.case_id = c.id AND d2.is_completed = FALSE AND d2.due_date >= CURDATE()
              ) AS next_deadline
       FROM cases c
       LEFT JOIN users cl ON cl.id = c.client_id
       LEFT JOIN users at ON at.id = c.attorney_id
       WHERE ${baseWhere}
       ORDER BY
         FIELD(c.priority,'urgent','high','normal','low'),
         c.created_at DESC
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

    // Block clients from seeing draft cases
    if (!rows.length || (rows[0].status === 'draft' && user.role === 'client')) {
      res.status(404).json({ success: false, message: 'Case not found.' })
      return
    }

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

    // Fetch parties
    const [parties] = await pool.query<RowDataPacket[]>(
      `SELECT p.*, u.fullname AS created_by_name
       FROM case_parties p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.case_id = ?
       ORDER BY p.created_at ASC`,
      [id]
    )

    // Fetch deadlines (clients only see deadlines where notify_client = true)
    const deadlineFilter = user.role === 'client' ? ' AND d.notify_client = TRUE' : ''
    const [deadlines] = await pool.query<RowDataPacket[]>(
      `SELECT d.*, u.fullname AS created_by_name, cb.fullname AS completed_by_name
       FROM case_deadlines d
       LEFT JOIN users u  ON u.id  = d.created_by
       LEFT JOIN users cb ON cb.id = d.completed_by
       WHERE d.case_id = ?${deadlineFilter}
       ORDER BY d.due_date ASC`,
      [id]
    )

    // Log case access for audit/privilege compliance
    try {
      await pool.query(
        `INSERT INTO case_access_log (case_id, user_id, role, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?)`,
        [id, user.id, user.role,
         req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress || null,
         (req.headers['user-agent'] || '').substring(0, 300)]
      )
    } catch { /* access log is best-effort */ }

    res.json({ success: true, data: { ...c, timeline, notes, parties, deadlines } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Update Case ────────────────────────────────────────────
export const updateCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params
    const {
      title, case_type, status, court_name, docket_number, judge_name, filing_date,
      description, priority, opposing_party, opposing_counsel, outcome, outcome_notes, retainer_amount,
    } = req.body

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
        await pool.query(
          `UPDATE cases SET title=?, description=?, case_type=?, court_name=?, docket_number=?,
                           judge_name=?, filing_date=?, opposing_party=?, opposing_counsel=?
           WHERE id = ?`,
          [
            title || existing[0].title,
            description ?? existing[0].description,
            case_type || existing[0].case_type,
            court_name ?? existing[0].court_name,
            docket_number ?? existing[0].docket_number,
            judge_name ?? existing[0].judge_name,
            filing_date ?? existing[0].filing_date,
            opposing_party ?? existing[0].opposing_party,
            opposing_counsel ?? existing[0].opposing_counsel,
            id,
          ]
        )
      } else {
        await pool.query(
          `UPDATE cases SET title=?, description=?, case_type=?, court_name=?, docket_number=?,
                           judge_name=?, opposing_party=?, opposing_counsel=?
           WHERE id = ?`,
          [
            title || existing[0].title,
            description ?? existing[0].description,
            case_type || existing[0].case_type,
            court_name ?? existing[0].court_name,
            docket_number ?? existing[0].docket_number,
            judge_name ?? existing[0].judge_name,
            opposing_party ?? existing[0].opposing_party,
            opposing_counsel ?? existing[0].opposing_counsel,
            id,
          ]
        )
      }
      await audit(req, 'CASE_UPDATED', 'case', Number(id), 'Updated by secretary')
      res.json({ success: true, message: 'Case updated.' })
      return
    }

    const oldStatus = existing[0].status
    const newStatus = status || existing[0].status

    // Require outcome when closing a case
    if (newStatus === 'closed' && oldStatus !== 'closed') {
      if (!outcome) {
        res.status(400).json({ success: false, message: 'An outcome is required when closing a case.' })
        return
      }
    }

    await pool.query(
      `UPDATE cases SET title=?, description=?, case_type=?, status=?, priority=?,
                        court_name=?, docket_number=?, judge_name=?, filing_date=?,
                        opposing_party=?, opposing_counsel=?, retainer_amount=?,
                        outcome=?, outcome_notes=?,
                        closed_at = CASE WHEN ? = 'closed' AND ? != 'closed' THEN CURDATE() ELSE closed_at END
       WHERE id = ?`,
      [
        title || existing[0].title,
        description ?? existing[0].description,
        case_type || existing[0].case_type,
        newStatus,
        priority || existing[0].priority,
        court_name ?? existing[0].court_name,
        docket_number ?? existing[0].docket_number,
        judge_name ?? existing[0].judge_name,
        filing_date ?? existing[0].filing_date,
        opposing_party ?? existing[0].opposing_party,
        opposing_counsel ?? existing[0].opposing_counsel,
        retainer_amount ?? existing[0].retainer_amount,
        outcome ?? existing[0].outcome,
        outcome_notes ?? existing[0].outcome_notes,
        newStatus, oldStatus,
        id,
      ]
    )

    // Auto timeline entry on status change
    if (newStatus !== oldStatus) {
      const timelineDesc = newStatus === 'closed' && outcome
        ? `Case closed — Outcome: ${outcome}${outcome_notes ? '. ' + outcome_notes : ''}`
        : `Status changed from ${oldStatus} to ${newStatus}`
      await pool.query(
        `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
         VALUES (?, 'status_change', ?, CURDATE(), ?)`,
        [id, timelineDesc, user.id]
      )
      const _origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
      const _link   = `${_origin}/cases/${id}`
      await notifyWithEmail(
        existing[0].client_id, 'case_update',
        newStatus === 'closed'
          ? `Your case "${existing[0].title}" has been closed. Outcome: ${outcome}`
          : `Case "${existing[0].title}" status updated to: ${newStatus}`,
        Number(id),
        newStatus === 'closed'
          ? `Case Closed: ${existing[0].case_number}`
          : `Case Update: ${existing[0].case_number}`,
        (name) => newStatus === 'closed'
          ? caseClosedEmail(name, existing[0].title, existing[0].case_number, outcome ?? '', _link)
          : caseStatusChangedEmail(name, existing[0].title, existing[0].case_number, newStatus, _link)
      )
    }

    await audit(req, 'CASE_UPDATED', 'case', Number(id))

    // Trigger satisfaction survey when case is first closed
    if (newStatus === 'closed' && oldStatus !== 'closed' && existing[0].client_id) {
      await triggerSurveyForCase(Number(id), existing[0].client_id, outcome ?? null, req)
    }

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
    let rows: RowDataPacket[]
    // Return all registered clients regardless of case assignment
    ;[rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.fullname, u.email, u.username, u.id_verified,
              cp.phone, cp.address, cp.occupation
       FROM users u
       LEFT JOIN client_profiles cp ON cp.user_id = u.id
       WHERE u.role = 'client'
       ORDER BY u.fullname ASC`
    )
    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/cases/:id/legal-hold ────────────────────────
export const placeLegalHold = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params
    const { note } = req.body

    const [cases] = await pool.query<RowDataPacket[]>(
      `SELECT id, attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`, [id]
    )
    if (!cases.length) { res.status(404).json({ success: false, message: 'Case not found.' }); return }

    const eid = getEffectiveAttorneyId(user)
    if (user.role !== 'admin' && eid !== cases[0].attorney_id) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }

    await pool.query(
      `UPDATE cases SET legal_hold = 1, legal_hold_by = ?, legal_hold_at = NOW(), legal_hold_note = ? WHERE id = ?`,
      [user.id, note ?? null, id]
    )

    await audit(req, 'LEGAL_HOLD_PLACED', 'case', parseInt(id), note ?? '')
    res.json({ success: true, message: 'Legal hold placed.' })
  } catch (err: any) {
    console.error('placeLegalHold:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── DELETE /api/cases/:id/legal-hold ──────────────────────
export const liftLegalHold = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [cases] = await pool.query<RowDataPacket[]>(
      `SELECT id, attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`, [id]
    )
    if (!cases.length) { res.status(404).json({ success: false, message: 'Case not found.' }); return }

    const eid = getEffectiveAttorneyId(user)
    if (user.role !== 'admin' && eid !== cases[0].attorney_id) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }

    await pool.query(
      `UPDATE cases SET legal_hold = 0, legal_hold_by = NULL, legal_hold_at = NULL, legal_hold_note = NULL WHERE id = ?`,
      [id]
    )

    await audit(req, 'LEGAL_HOLD_LIFTED', 'case', parseInt(id))
    res.json({ success: true, message: 'Legal hold lifted.' })
  } catch (err: any) {
    console.error('liftLegalHold:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
