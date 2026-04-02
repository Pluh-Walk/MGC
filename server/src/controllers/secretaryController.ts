import { Request, Response } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { sendMail } from '../config/mailer'
import { audit } from '../utils/audit'
import { notify } from '../utils/notify'
import { secretaryInviteEmail } from '../templates/secretaryInvite'

const sanitize = (str: string) => str.trim().replace(/[<>"']/g, '')

// ─── Invite Secretary ───────────────────────────────────────
export const inviteSecretary = async (req: Request, res: Response): Promise<void> => {
  try {
    const attorney = req.user!
    const { email } = req.body

    if (!email) {
      res.status(400).json({ success: false, message: 'Email address is required.' })
      return
    }

    // Verify the inviting attorney is still active
    const [[attyStatus]] = await pool.query<RowDataPacket[]>(
      "SELECT status FROM users WHERE id = ? AND role = 'attorney'", [attorney.id]
    )
    if (!attyStatus || attyStatus.status !== 'active') {
      res.status(403).json({ success: false, message: 'Your account is not active. Cannot send invitations.' })
      return
    }

    const cleanEmail = sanitize(email)

    // Check if email is already registered
    const [existingUser] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?',
      [cleanEmail]
    )
    if (existingUser.length > 0) {
      res.status(409).json({ success: false, message: 'This email is already registered in the system.' })
      return
    }

    // Check if there's already a pending invitation for this email from this attorney
    const [existingInvite] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM secretary_invitations
       WHERE attorney_id = ? AND email = ? AND status = 'pending' AND expires_at > NOW()`,
      [attorney.id, cleanEmail]
    )
    if (existingInvite.length > 0) {
      res.status(409).json({ success: false, message: 'A pending invitation already exists for this email.' })
      return
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours

    await pool.query<ResultSetHeader>(
      `INSERT INTO secretary_invitations (attorney_id, email, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [attorney.id, cleanEmail, token, expiresAt]
    )

    // Send invitation email
    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000'
    const inviteLink = `${clientOrigin}/secretary/register?token=${token}`

    let emailSent = false
    let emailError: string | null = null
    try {
      await sendMail(
        cleanEmail,
        'Invitation to Join MGC Law System as Secretary',
        secretaryInviteEmail(attorney.fullname, inviteLink)
      )
      emailSent = true
    } catch (emailErr: any) {
      emailError = emailErr?.message || 'Unknown error'
      console.error('[inviteSecretary] Email send failed:', emailErr)
    }

    await audit(req, 'SECRETARY_INVITED', 'user', attorney.id, `Invited: ${cleanEmail}`)

    const message = emailSent
      ? `Invitation sent to ${cleanEmail}.`
      : `Invitation created but email delivery failed. Share the link manually.`

    res.status(201).json({
      success: true,
      emailSent,
      emailError,
      message,
      inviteLink,
    })
  } catch (err) {
    console.error('[inviteSecretary]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Validate Invitation Token ──────────────────────────────
export const validateInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query

    if (!token || typeof token !== 'string') {
      res.status(400).json({ success: false, message: 'Token is required.' })
      return
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT si.*, u.fullname AS attorney_name
       FROM secretary_invitations si
       JOIN users u ON u.id = si.attorney_id
       WHERE si.token = ? AND si.status = 'pending' AND si.expires_at > NOW()`,
      [token]
    )

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Invalid or expired invitation.' })
      return
    }

    res.json({
      success: true,
      invitation: {
        email: rows[0].email,
        attorney_name: rows[0].attorney_name,
      },
    })
  } catch (err) {
    console.error('[validateInvitation]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Register Secretary (via invitation) ────────────────────
export const registerSecretary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, fullname, username, password, confirmPassword } = req.body

    if (!token || !fullname || !username || !password || !confirmPassword) {
      res.status(400).json({ success: false, message: 'All fields are required.' })
      return
    }

    if (password !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Passwords do not match.' })
      return
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' })
      return
    }

    // Validate the invitation token
    const [invites] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM secretary_invitations
       WHERE token = ? AND status = 'pending' AND expires_at > NOW()`,
      [token]
    )

    if (invites.length === 0) {
      res.status(404).json({ success: false, message: 'Invalid or expired invitation.' })
      return
    }

    const invitation = invites[0]

    // Verify the linked attorney is still active
    const [[attyCheck]] = await pool.query<RowDataPacket[]>(
      "SELECT status FROM users WHERE id = ? AND role = 'attorney'", [invitation.attorney_id]
    )
    if (!attyCheck || attyCheck.status !== 'active') {
      res.status(403).json({ success: false, message: 'The inviting attorney\'s account is no longer active. Registration cannot proceed.' })
      return
    }

    const cleanName = sanitize(fullname)
    const cleanUsername = sanitize(username)

    // Check uniqueness
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [cleanUsername, invitation.email]
    )
    if (existing.length > 0) {
      res.status(409).json({ success: false, message: 'Username or email already taken.' })
      return
    }

    const hashed = await bcrypt.hash(password, 12)

    // Create the user
    const [userResult] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (fullname, username, email, password, role, status)
       VALUES (?, ?, ?, ?, 'secretary', 'active')`,
      [cleanName, cleanUsername, invitation.email, hashed]
    )

    const secretaryId = userResult.insertId

    // Create secretary profile
    await pool.query(
      'INSERT INTO secretary_profiles (user_id) VALUES (?)',
      [secretaryId]
    )

    // Link to attorney
    await pool.query<ResultSetHeader>(
      `INSERT INTO attorney_secretaries (attorney_id, secretary_id, status)
       VALUES (?, ?, 'active')`,
      [invitation.attorney_id, secretaryId]
    )

    // Mark invitation as accepted
    await pool.query(
      `UPDATE secretary_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = ?`,
      [invitation.id]
    )

    // Notify attorney
    await notify(
      invitation.attorney_id,
      'case_update',
      `Secretary ${cleanName} has joined and is now linked to your account.`,
      secretaryId
    )

    await audit(
      { ip: req.ip, socket: req.socket, user: { id: secretaryId } } as any,
      'SECRETARY_REGISTERED',
      'user',
      secretaryId,
      `Linked to attorney ID: ${invitation.attorney_id}`
    )

    // Issue JWT so secretary can log in immediately
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as `${number}${'s'|'m'|'h'|'d'|'w'|'y'}`
    const jwtToken = jwt.sign(
      { id: secretaryId, fullname: cleanName, username: cleanUsername, role: 'secretary' as const, attorneyId: invitation.attorney_id },
      process.env.JWT_SECRET as string,
      { expiresIn }
    )

    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      token: jwtToken,
      user: {
        id: secretaryId,
        fullname: cleanName,
        username: cleanUsername,
        email: invitation.email,
        role: 'secretary',
        status: 'active',
      },
    })
  } catch (err) {
    console.error('[registerSecretary]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── List Attorney's Secretaries ────────────────────────────
export const listSecretaries = async (req: Request, res: Response): Promise<void> => {
  try {
    const attorneyId = req.user!.id

    // Active secretaries
    const [secretaries] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.fullname, u.username, u.email, u.status, u.created_at,
              als.hired_at, als.status AS link_status,
              sp.phone, sp.photo_path
       FROM attorney_secretaries als
       JOIN users u ON u.id = als.secretary_id
       LEFT JOIN secretary_profiles sp ON sp.user_id = u.id
       WHERE als.attorney_id = ?
       ORDER BY als.hired_at DESC`,
      [attorneyId]
    )

    // Pending invitations
    const [invitations] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, status, created_at, expires_at
       FROM secretary_invitations
       WHERE attorney_id = ? AND status = 'pending' AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [attorneyId]
    )

    res.json({ success: true, secretaries, invitations })
  } catch (err) {
    console.error('[listSecretaries]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Remove Secretary ───────────────────────────────────────
export const removeSecretary = async (req: Request, res: Response): Promise<void> => {
  try {
    const attorneyId = req.user!.id
    const { id } = req.params

    // Verify this secretary belongs to this attorney
    const [link] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM attorney_secretaries
       WHERE attorney_id = ? AND secretary_id = ? AND status = 'active'`,
      [attorneyId, id]
    )

    if (link.length === 0) {
      res.status(404).json({ success: false, message: 'Secretary not found or already removed.' })
      return
    }

    // Deactivate the link
    await pool.query(
      `UPDATE attorney_secretaries SET status = 'removed', removed_at = NOW()
       WHERE attorney_id = ? AND secretary_id = ?`,
      [attorneyId, id]
    )

    // Set user status to inactive
    await pool.query(
      `UPDATE users SET status = 'inactive' WHERE id = ?`,
      [id]
    )

    await audit(req, 'SECRETARY_REMOVED', 'user', Number(id), `Removed by attorney ID: ${attorneyId}`)

    res.json({ success: true, message: 'Secretary removed.' })
  } catch (err) {
    console.error('[removeSecretary]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Get Linked Attorney Info (secretary-only) ─────────────
export const getLinkedAttorneyInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const secretaryId = req.user!.id
    const [[row]] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.fullname, u.email,
              ap.phone, ap.availability
       FROM attorney_secretaries als
       JOIN users u ON u.id = als.attorney_id
       LEFT JOIN attorney_profiles ap ON ap.user_id = als.attorney_id
       WHERE als.secretary_id = ? AND als.status = 'active'
       LIMIT 1`,
      [secretaryId]
    )
    if (!row) {
      res.status(404).json({ success: false, message: 'No linked attorney found.' })
      return
    }
    res.json({ success: true, data: row })
  } catch (err) {
    console.error('[getLinkedAttorneyInfo]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Revoke Invitation ──────────────────────────────────────
// ─── Get Secretary By ID (attorney-only) ───────────────────
export const getSecretaryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const attorneyId = req.user!.id
    const { id } = req.params

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.fullname, u.username, u.email, u.created_at,
              als.hired_at, als.status AS link_status,
              sp.phone, sp.photo_path
       FROM attorney_secretaries als
       JOIN users u ON u.id = als.secretary_id
       LEFT JOIN secretary_profiles sp ON sp.user_id = u.id
       WHERE als.attorney_id = ? AND als.secretary_id = ? AND als.status = 'active'`,
      [attorneyId, id]
    )

    if (!rows[0]) {
      res.status(404).json({ success: false, message: 'Secretary not found.' })
      return
    }

    res.json({ success: true, data: rows[0] })
  } catch (err) {
    console.error('[getSecretaryById]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

export const revokeInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const attorneyId = req.user!.id
    const { id } = req.params

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE secretary_invitations SET status = 'revoked'
       WHERE id = ? AND attorney_id = ? AND status = 'pending'`,
      [id, attorneyId]
    )

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: 'Invitation not found or already processed.' })
      return
    }

    await audit(req, 'SECRETARY_INVITE_REVOKED', 'invitation', Number(id))

    res.json({ success: true, message: 'Invitation revoked.' })
  } catch (err) {
    console.error('[revokeInvitation]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
