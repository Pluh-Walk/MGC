import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import pool from '../config/db'
import { audit } from '../utils/audit'

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
      await pool.query<ResultSetHeader>(
        `INSERT INTO client_profiles (user_id, phone, address, date_of_birth, occupation)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           phone         = VALUES(phone),
           address       = VALUES(address),
           date_of_birth = VALUES(date_of_birth),
           occupation    = VALUES(occupation)`,
        [user.id, phone ?? null, address ?? null, date_of_birth ?? null, occupation ?? null]
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
    }

    await audit(req, 'PROFILE_UPDATED', 'user', user.id)
    res.json({ success: true, message: 'Profile updated.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Attorney: Stats ────────────────────────────────────────
export const getAttorneyStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const [[active]]   = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM cases WHERE attorney_id = ? AND status = 'active'   AND deleted_at IS NULL`, [user.id])
    const [[closed]]   = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM cases WHERE attorney_id = ? AND status IN ('closed','archived') AND deleted_at IS NULL`, [user.id])
    const [[clients]]  = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT client_id) AS cnt FROM cases WHERE attorney_id = ? AND deleted_at IS NULL`, [user.id])
    const [[upcoming]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM hearings h
       JOIN cases c ON c.id = h.case_id
       WHERE c.attorney_id = ? AND h.scheduled_at >= NOW() AND h.status = 'scheduled'`, [user.id])
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

    // Delete old photo if exists
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT photo_path FROM attorney_profiles WHERE user_id = ?', [user.id])
    if (rows[0]?.photo_path) {
      const oldPath = path.join(process.cwd(), rows[0].photo_path)
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }

    const relPath = `uploads/profiles/${file.filename}`
    await pool.query(
      `INSERT INTO attorney_profiles (user_id, photo_path)
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
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT photo_path FROM attorney_profiles WHERE user_id = ?', [userId])
    if (!rows[0]?.photo_path) { res.status(404).json({ success: false, message: 'No photo.' }); return }
    const filePath = path.join(process.cwd(), rows[0].photo_path)
    if (!fs.existsSync(filePath)) { res.status(404).json({ success: false, message: 'File not found.' }); return }
    res.sendFile(filePath)
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Get Client Profile by ID (attorney only) ───────────────
export const getClientProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.fullname, u.username, u.email, u.created_at,
              cp.phone, cp.address, cp.date_of_birth, cp.occupation, cp.notes,
              at.fullname AS attorney_name
       FROM users u
       LEFT JOIN client_profiles cp ON cp.user_id = u.id
       LEFT JOIN users at ON at.id = cp.assigned_attorney_id
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
