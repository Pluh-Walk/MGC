import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import pool from '../config/db'
import { audit } from '../utils/audit'
import { getEffectiveAttorneyId } from '../utils/scope'

// ─── Get My Profile ─────────────────────────────────────────
export const getMyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user

    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, fullname, username, email, role, ibp_verified, created_at FROM users WHERE id = ?`,
      [user.id]
    )

    if (!userRows.length) {
      res.status(404).json({ success: false, message: 'User not found.' })
      return
    }

    let profile = null
    if (user.role === 'client') {
      const [profileRows] = await pool.query<RowDataPacket[]>(
        `SELECT cp.*, u.fullname AS attorney_name, u.email AS attorney_email
         FROM client_profiles cp
         LEFT JOIN users u ON u.id = cp.assigned_attorney_id
         WHERE cp.user_id = ?`,
        [user.id]
      )
      profile = profileRows[0] ?? null
    } else if (user.role === 'attorney') {
      const [profileRows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM attorney_profiles WHERE user_id = ?`,
        [user.id]
      )
      profile = profileRows[0] ?? null
    } else if (user.role === 'secretary') {
      const [profileRows] = await pool.query<RowDataPacket[]>(
        `SELECT sp.*, u.fullname AS attorney_name
         FROM secretary_profiles sp
         LEFT JOIN attorney_secretaries als ON als.secretary_id = sp.user_id AND als.status = 'active'
         LEFT JOIN users u ON u.id = als.attorney_id
         WHERE sp.user_id = ?`,
        [user.id]
      )
      profile = profileRows[0] ?? null
    }

    res.json({ success: true, data: { ...userRows[0], profile } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Update My Profile ──────────────────────────────────────
export const updateMyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { fullname, phone, address, date_of_birth, occupation,
            office_address, ibp_number, law_firm, specializations,
            court_admissions, years_experience, bio, availability } = req.body

    if (fullname) {
      await pool.query(`UPDATE users SET fullname = ? WHERE id = ?`, [fullname.trim(), user.id])
    }

    if (user.role === 'client') {
      const { id_type, id_number, emergency_contact,
              notif_email, notif_case_updates, notif_hearings, notif_messages } = req.body
      await pool.query<ResultSetHeader>(
        `INSERT INTO client_profiles
           (user_id, phone, address, date_of_birth, occupation,
            id_type, id_number, emergency_contact,
            notif_email, notif_case_updates, notif_hearings, notif_messages)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           phone               = VALUES(phone),
           address             = VALUES(address),
           date_of_birth       = VALUES(date_of_birth),
           occupation          = VALUES(occupation),
           id_type             = VALUES(id_type),
           id_number           = VALUES(id_number),
           emergency_contact   = VALUES(emergency_contact),
           notif_email         = VALUES(notif_email),
           notif_case_updates  = VALUES(notif_case_updates),
           notif_hearings      = VALUES(notif_hearings),
           notif_messages      = VALUES(notif_messages)`,
        [
          user.id, phone ?? null, address ?? null, date_of_birth ?? null, occupation ?? null,
          id_type ?? null, id_number ?? null, emergency_contact ?? null,
          notif_email  !== undefined ? (notif_email  ? 1 : 0) : 1,
          notif_case_updates !== undefined ? (notif_case_updates ? 1 : 0) : 1,
          notif_hearings !== undefined ? (notif_hearings ? 1 : 0) : 1,
          notif_messages !== undefined ? (notif_messages ? 1 : 0) : 1,
        ]
      )
    } else if (user.role === 'attorney') {
      await pool.query<ResultSetHeader>(
        `INSERT INTO attorney_profiles
           (user_id, phone, office_address, ibp_number, law_firm,
            specializations, court_admissions, years_experience, bio, availability)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           phone            = VALUES(phone),
           office_address   = VALUES(office_address),
           ibp_number       = VALUES(ibp_number),
           law_firm         = VALUES(law_firm),
           specializations  = VALUES(specializations),
           court_admissions = VALUES(court_admissions),
           years_experience = VALUES(years_experience),
           bio              = VALUES(bio),
           availability     = VALUES(availability)`,
        [user.id, phone ?? null, office_address ?? null, ibp_number ?? null,
         law_firm ?? null, specializations ?? null, court_admissions ?? null,
         years_experience ?? null, bio ?? null, availability ?? 'available']
      )
    } else if (user.role === 'secretary') {
      await pool.query<ResultSetHeader>(
        `INSERT INTO secretary_profiles (user_id, phone)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE phone = VALUES(phone)`,
        [user.id, phone ?? null]
      )
    }

    await audit(req, 'PROFILE_UPDATED', 'user', user.id)
    res.json({ success: true, message: 'Profile updated.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Client: Stats ─────────────────────────────────────────
export const getClientStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const [[active]]    = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM cases WHERE client_id = ? AND status = 'active'  AND deleted_at IS NULL`, [user.id])
    const [[completed]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM cases WHERE client_id = ? AND status = 'closed'  AND deleted_at IS NULL`, [user.id])
    const [[pending]]   = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM cases WHERE client_id = ? AND status = 'pending' AND deleted_at IS NULL`, [user.id])

    const [attyRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COALESCE(u_prof.id,          u_case.id)          AS id,
         COALESCE(u_prof.fullname,    u_case.fullname)    AS fullname,
         COALESCE(ap_prof.availability, ap_case.availability) AS availability,
         COALESCE(ap_prof.law_firm,   ap_case.law_firm)   AS law_firm,
         COALESCE(ap_prof.photo_path, ap_case.photo_path) AS photo_path
       FROM (SELECT ? AS uid) base
       LEFT JOIN client_profiles cp ON cp.user_id = base.uid
       LEFT JOIN users u_prof ON u_prof.id = cp.assigned_attorney_id
       LEFT JOIN attorney_profiles ap_prof ON ap_prof.user_id = u_prof.id
       LEFT JOIN cases recent_c ON recent_c.id = (
         SELECT id FROM cases
         WHERE client_id = base.uid AND deleted_at IS NULL AND attorney_id IS NOT NULL
         ORDER BY created_at DESC LIMIT 1
       )
       LEFT JOIN users u_case ON u_case.id = recent_c.attorney_id
       LEFT JOIN attorney_profiles ap_case ON ap_case.user_id = u_case.id
       WHERE COALESCE(u_prof.id, u_case.id) IS NOT NULL`,
      [user.id]
    )
    res.json({ success: true, data: {
      active_cases:    active.cnt    || 0,
      completed_cases: completed.cnt || 0,
      pending_cases:   pending.cnt   || 0,
      assigned_attorney: attyRows[0] ?? null,
    }})
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Client: Recent Activity ────────────────────────────────
export const getClientActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const [auditRows] = await pool.query<RowDataPacket[]>(
      `SELECT action, target_type, details, created_at
       FROM audit_log WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 10`,
      [user.id]
    )
    const [timelineRows] = await pool.query<RowDataPacket[]>(
      `SELECT ct.event_type AS action, ct.description AS details,
              ct.created_at, c.case_number, c.title AS case_title
       FROM case_timeline ct
       JOIN cases c ON c.id = ct.case_id
       WHERE c.client_id = ?
       ORDER BY ct.created_at DESC LIMIT 10`,
      [user.id]
    )
    const combined = [
      ...auditRows.map(r => ({ ...r, source: 'audit' })),
      ...(timelineRows as any[]).map(r => ({ ...r, source: 'timeline' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
     .slice(0, 15)
    res.json({ success: true, data: combined })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Client: Documents (shared by attorney) ─────────────────
export const getClientDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.id, d.original_name, d.category, d.file_size, d.mime_type, d.uploaded_at AS created_at,
              c.case_number, c.title AS case_title,
              u.fullname AS uploaded_by_name
       FROM documents d
       JOIN cases c ON c.id = d.case_id
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE c.client_id = ? AND d.is_client_visible = 1 AND d.deleted_at IS NULL
       ORDER BY d.uploaded_at DESC`,
      [user.id]
    )
    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Client: Upload Document ────────────────────────────────
export const clientUploadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { case_id } = req.body
    const file = req.file
    if (!case_id || !file) {
      res.status(400).json({ success: false, message: 'case_id and file are required.' })
      return
    }
    const [caseRows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM cases WHERE id = ? AND client_id = ? AND deleted_at IS NULL`,
      [case_id, user.id]
    )
    if (!caseRows.length) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
      res.status(403).json({ success: false, message: 'Case not found or access denied.' })
      return
    }
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO documents (case_id, uploaded_by, filename, original_name, file_size, mime_type, category, is_client_visible)
       VALUES (?, ?, ?, ?, ?, ?, 'evidence', 1)`,
      [case_id, user.id, file.filename, file.originalname, file.size, file.mimetype]
    )
    await pool.query(
      `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
       VALUES (?, 'document', ?, CURDATE(), ?)`,
      [case_id, `Client uploaded document: ${file.originalname}`, user.id]
    )
    await audit(req, 'DOCUMENT_UPLOADED', 'document', result.insertId, file.originalname)
    res.status(201).json({ success: true, message: 'Document uploaded.', documentId: result.insertId })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Attorney: Stats ────────────────────────────────────────
export const getAttorneyStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const attorneyId = getEffectiveAttorneyId(user)
    const [[active]]   = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM cases WHERE attorney_id = ? AND status = 'active'   AND deleted_at IS NULL`, [attorneyId])
    const [[closed]]   = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM cases WHERE attorney_id = ? AND status IN ('closed','archived') AND deleted_at IS NULL`, [attorneyId])
    const [[clients]]  = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT client_id) AS cnt FROM cases WHERE attorney_id = ? AND deleted_at IS NULL`, [attorneyId])
    const [[upcoming]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM hearings h
       JOIN cases c ON c.id = h.case_id
       WHERE c.attorney_id = ? AND h.scheduled_at >= NOW() AND h.status = 'scheduled'`, [attorneyId])
    res.json({ success: true, data: {
      active_cases: active.cnt, closed_cases: closed.cnt,
      clients: clients.cnt, upcoming_hearings: upcoming.cnt,
    }})
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Attorney: Recent Activity ──────────────────────────────
export const getAttorneyActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT action, target_type, details, created_at
       FROM audit_log WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 10`,
      [user.id]
    )
    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Change Password ────────────────────────────────────────
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword)  {
      res.status(400).json({ success: false, message: 'Both current and new password are required.' })
      return
    }
    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' })
      return
    }
    const [rows] = await pool.query<RowDataPacket[]>('SELECT password FROM users WHERE id = ?', [user.id])
    const match = await bcrypt.compare(currentPassword, rows[0].password)
    if (!match) {
      res.status(401).json({ success: false, message: 'Current password is incorrect.' })
      return
    }
    const hashed = await bcrypt.hash(newPassword, 12)
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id])
    await audit(req, 'PASSWORD_CHANGED', 'user', user.id)
    res.json({ success: true, message: 'Password changed successfully.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Upload Profile Photo ───────────────────────────────────
export const uploadProfilePhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const file = req.file
    if (!file) { res.status(400).json({ success: false, message: 'No image uploaded.' }); return }

    const table = user.role === 'client' ? 'client_profiles'
                : user.role === 'secretary' ? 'secretary_profiles'
                : 'attorney_profiles'

    // Delete old photo if exists
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT photo_path FROM ${table} WHERE user_id = ?`, [user.id])
    if (rows[0]?.photo_path) {
      const oldPath = path.join(process.cwd(), rows[0].photo_path)
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }

    const relPath = `uploads/profiles/${file.filename}`
    await pool.query(
      `INSERT INTO ${table} (user_id, photo_path)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE photo_path = VALUES(photo_path)`,
      [user.id, relPath]
    )
    res.json({ success: true, message: 'Photo uploaded.', photo_path: relPath })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Serve Profile Photo ────────────────────────────────────
export const serveProfilePhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params
    // Check attorney_profiles first, then client_profiles, then secretary_profiles
    let photoPath: string | null = null
    const [attyRows] = await pool.query<RowDataPacket[]>(
      'SELECT photo_path FROM attorney_profiles WHERE user_id = ?', [userId])
    if (attyRows[0]?.photo_path) {
      photoPath = attyRows[0].photo_path
    } else {
      const [clientRows] = await pool.query<RowDataPacket[]>(
        'SELECT photo_path FROM client_profiles WHERE user_id = ?', [userId])
      if (clientRows[0]?.photo_path) {
        photoPath = clientRows[0].photo_path
      } else {
        const [secRows] = await pool.query<RowDataPacket[]>(
          'SELECT photo_path FROM secretary_profiles WHERE user_id = ?', [userId])
        if (secRows[0]?.photo_path) photoPath = secRows[0].photo_path
      }
    }
    if (!photoPath) { res.status(404).json({ success: false, message: 'No photo.' }); return }
    const filePath = path.join(process.cwd(), photoPath)
    if (!fs.existsSync(filePath)) { res.status(404).json({ success: false, message: 'File not found.' }); return }
    res.sendFile(filePath)
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Get Attorney Public Profile (client only) ────────────
// ─── List All Attorneys (client-accessible directory) ──────
export const listAttorneys = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.fullname,
              ap.law_firm, ap.specializations, ap.years_experience,
              ap.availability, ap.photo_path
       FROM users u
       INNER JOIN attorney_profiles ap ON ap.user_id = u.id
       WHERE u.role = 'attorney' AND u.ibp_verified = 1
       ORDER BY u.fullname ASC`
    )
    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Get Attorney Public Profile (client only) ────────────
export const getAttorneyPublicProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.fullname, u.email,
              ap.phone, ap.office_address, ap.law_firm, ap.specializations,
              ap.court_admissions, ap.years_experience, ap.bio,
              ap.availability, ap.photo_path
       FROM users u
       LEFT JOIN attorney_profiles ap ON ap.user_id = u.id
       WHERE u.id = ? AND u.role = 'attorney'`,
      [id]
    )

    if (!rows.length) {
      res.status(404).json({ success: false, message: 'Attorney not found.' })
      return
    }

    res.json({ success: true, data: rows[0] })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Get Client Cases by ID (attorney only) ─────────────────
export const getClientCases = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.id, c.case_number, c.title, c.case_type, c.status, c.filing_date,
              at.fullname AS attorney_name
       FROM cases c
       LEFT JOIN users at ON at.id = c.attorney_id
       WHERE c.client_id = ? AND c.deleted_at IS NULL
       ORDER BY c.created_at DESC`,
      [id]
    )

    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Get Client Profile by ID (attorney only) ───────────────
export const getClientProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.fullname, u.username, u.email, u.created_at, u.id_verified,
              cp.phone, cp.address, cp.date_of_birth, cp.occupation, cp.notes,
              cp.id_type, cp.id_number, cp.emergency_contact, cp.assigned_attorney_id,
              COALESCE(at_prof.id,         at_case.id)         AS attorney_id,
              COALESCE(at_prof.fullname,   at_case.fullname)   AS attorney_name,
              COALESCE(ap_prof.photo_path, ap_case.photo_path) AS attorney_photo
       FROM users u
       LEFT JOIN client_profiles cp ON cp.user_id = u.id
       LEFT JOIN users at_prof ON at_prof.id = cp.assigned_attorney_id
       LEFT JOIN attorney_profiles ap_prof ON ap_prof.user_id = at_prof.id
       LEFT JOIN cases recent_c ON recent_c.id = (
         SELECT id FROM cases
         WHERE client_id = u.id AND deleted_at IS NULL AND attorney_id IS NOT NULL
         ORDER BY created_at DESC LIMIT 1
       )
       LEFT JOIN users at_case ON at_case.id = recent_c.attorney_id
       LEFT JOIN attorney_profiles ap_case ON ap_case.user_id = at_case.id
       WHERE u.id = ? AND u.role = 'client'`,
      [id]
    )

    if (!rows.length) {
      res.status(404).json({ success: false, message: 'Client not found.' })
      return
    }

    res.json({ success: true, data: rows[0] })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Update Client Notes (attorney only) ────────────────────
export const updateClientNotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { notes, assigned_attorney_id } = req.body

    await pool.query<ResultSetHeader>(
      `INSERT INTO client_profiles (user_id, notes, assigned_attorney_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         notes                = VALUES(notes),
         assigned_attorney_id = VALUES(assigned_attorney_id)`,
      [id, notes ?? null, assigned_attorney_id ?? null]
    )

    await audit(req, 'CLIENT_PROFILE_UPDATED', 'user', Number(id))

    res.json({ success: true, message: 'Client profile updated.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Attorney Public Case Stats (client-accessible) ─────────
export const getAttorneyPublicStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const [[active]]    = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM cases WHERE attorney_id = ? AND status = 'active' AND deleted_at IS NULL`, [id])
    const [[completed]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM cases WHERE attorney_id = ? AND status IN ('closed','settled','dismissed') AND deleted_at IS NULL`, [id])
    const [[pending]]   = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM cases WHERE attorney_id = ? AND status = 'pending' AND deleted_at IS NULL`, [id])
    const [[total]]     = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM cases WHERE attorney_id = ? AND deleted_at IS NULL`, [id])
    const [[clients]]   = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT client_id) AS cnt FROM cases WHERE attorney_id = ? AND deleted_at IS NULL`, [id])

    res.json({ success: true, data: {
      active_cases:    active.cnt,
      completed_cases: completed.cnt,
      pending_cases:   pending.cnt,
      total_cases:     total.cnt,
      total_clients:   clients.cnt,
    }})
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Attorney Performance Report (§9.1) ──────────────────────
export const getAttorneyPerformanceReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const attorneyId = user.id            // always scoped to self

    // ── 1. Case closure rate — opened vs closed per month (last 12) ──
    const [casesByMonth] = await pool.query<RowDataPacket[]>(
      `SELECT
         DATE_FORMAT(created_at, '%Y-%m') AS month,
         COUNT(*) AS opened,
         SUM(CASE WHEN status IN ('closed','archived') THEN 1 ELSE 0 END) AS closed
       FROM cases
       WHERE attorney_id = ? AND deleted_at IS NULL
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month`,
      [attorneyId]
    )

    // ── 2. Average case duration by type (closed cases) ──────────
    const [avgDuration] = await pool.query<RowDataPacket[]>(
      `SELECT
         case_type,
         ROUND(AVG(DATEDIFF(closed_at, created_at))) AS avg_days,
         COUNT(*) AS count
       FROM cases
       WHERE attorney_id = ? AND status IN ('closed','archived') AND closed_at IS NOT NULL AND deleted_at IS NULL
       GROUP BY case_type ORDER BY avg_days DESC`,
      [attorneyId]
    )

    // ── 3. Billable hours per month (last 12) ────────────────────
    const [billableHours] = await pool.query<RowDataPacket[]>(
      `SELECT
         DATE_FORMAT(te.created_at, '%Y-%m') AS month,
         ROUND(SUM(te.duration_sec) / 3600, 2) AS hours
       FROM time_entries te
       JOIN cases c ON c.id = te.case_id AND c.deleted_at IS NULL
       WHERE c.attorney_id = ? AND te.is_billable = 1
         AND te.created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month`,
      [attorneyId]
    )

    // ── 4. Revenue collected vs outstanding ──────────────────────
    const [[revenue]] = await pool.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN i.status = 'paid'   THEN i.total_amount ELSE 0 END), 0) AS collected,
         COALESCE(SUM(CASE WHEN i.status IN ('sent','overdue') THEN i.total_amount ELSE 0 END), 0) AS outstanding,
         COALESCE(SUM(i.total_amount), 0) AS total_billed
       FROM invoices i
       JOIN cases c ON c.id = i.case_id AND c.deleted_at IS NULL
       WHERE c.attorney_id = ?`,
      [attorneyId]
    )

    // ── 5. Overdue tasks ─────────────────────────────────────────
    const [[overdueTasks]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt
       FROM case_tasks t
       JOIN cases c ON c.id = t.case_id AND c.deleted_at IS NULL
       WHERE c.attorney_id = ? AND t.due_date < CURDATE() AND t.status NOT IN ('done','cancelled')`,
      [attorneyId]
    )

    // ── 6. SOL approaching within 90 days ────────────────────────
    const [[solApproaching]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt
       FROM case_deadlines cd
       JOIN cases c ON c.id = cd.case_id AND c.deleted_at IS NULL
       WHERE c.attorney_id = ? AND cd.deadline_type = 'statute_of_limitations'
         AND cd.is_completed = 0
         AND cd.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)`,
      [attorneyId]
    )

    res.json({
      success: true,
      data: {
        cases_by_month:    casesByMonth,
        avg_duration:      avgDuration,
        billable_hours:    billableHours,
        revenue,
        overdue_tasks:     overdueTasks.cnt,
        sol_approaching:   solApproaching.cnt,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Notification Preferences (§2.2) ────────────────────────
const PREF_FIELDS = [
  'new_message', 'case_update', 'hearing_reminder', 'deadline_reminder',
  'document_uploaded', 'announcement', 'invoice_sent', 'task_assigned',
] as const
type PrefField = typeof PREF_FIELDS[number]
const PREF_VALUES = ['both', 'app', 'email', 'none'] as const

export const getNotificationPrefs = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    await pool.query(
      `INSERT IGNORE INTO notification_preferences (user_id) VALUES (?)`, [user.id]
    )
    const [[prefs]] = await pool.query<RowDataPacket[]>(
      `SELECT ${PREF_FIELDS.join(', ')} FROM notification_preferences WHERE user_id = ?`,
      [user.id]
    )
    res.json({ success: true, data: prefs })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const updateNotificationPrefs = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const updates: Partial<Record<PrefField, string>> = {}
    for (const field of PREF_FIELDS) {
      const val = req.body[field]
      if (val && (PREF_VALUES as readonly string[]).includes(val)) {
        updates[field] = val
      }
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, message: 'No valid preference fields provided.' })
      return
    }
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    await pool.query(
      `INSERT INTO notification_preferences (user_id, ${Object.keys(updates).join(', ')})
       VALUES (?, ${Object.keys(updates).map(() => '?').join(', ')})
       ON DUPLICATE KEY UPDATE ${setClauses}`,
      [user.id, ...Object.values(updates), ...Object.values(updates)]
    )
    res.json({ success: true, message: 'Notification preferences saved.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
