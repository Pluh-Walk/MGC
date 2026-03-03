import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { audit } from '../utils/audit'

// ─── Get My Profile ─────────────────────────────────────────
export const getMyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user

    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, fullname, username, email, role, created_at FROM users WHERE id = ?`,
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
    const { fullname, phone, address, date_of_birth, occupation } = req.body

    if (fullname) {
      await pool.query(`UPDATE users SET fullname = ? WHERE id = ?`, [fullname.trim(), user.id])
    }

    if (user.role === 'client') {
      // Upsert client_profiles
      await pool.query<ResultSetHeader>(
        `INSERT INTO client_profiles (user_id, phone, address, date_of_birth, occupation)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           phone        = VALUES(phone),
           address      = VALUES(address),
           date_of_birth = VALUES(date_of_birth),
           occupation   = VALUES(occupation)`,
        [user.id, phone ?? null, address ?? null, date_of_birth ?? null, occupation ?? null]
      )
    }

    await audit(req, 'PROFILE_UPDATED', 'user', user.id)

    res.json({ success: true, message: 'Profile updated.' })
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
