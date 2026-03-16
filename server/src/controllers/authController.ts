import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import Tesseract from 'tesseract.js'
import pool from '../config/db'
import { audit } from '../utils/audit'

// ─── helpers ───────────────────────────────────────────────

const sanitize = (str: string) => str.trim().replace(/[<>"']/g, '')

/** Log a login attempt (fire-and-forget) */
const logLoginAttempt = async (email: string, ip: string, success: boolean) => {
  try {
    await pool.query(
      'INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, ?)',
      [email, ip, success]
    )
  } catch { /* never crash on logging */ }
}

/** Check if the account is locked out due to too many failed attempts */
const isLockedOut = async (email: string): Promise<boolean> => {
  try {
    const [[settings]] = await pool.query<RowDataPacket[]>(
      `SELECT
         (SELECT setting_value FROM system_settings WHERE setting_key = 'max_login_attempts') AS max_attempts,
         (SELECT setting_value FROM system_settings WHERE setting_key = 'lockout_duration_minutes') AS lockout_minutes`
    )
    const maxAttempts = Number(settings?.max_attempts) || 5
    const lockoutMin  = Number(settings?.lockout_minutes) || 15

    const [[{ cnt }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM login_attempts
       WHERE email = ? AND success = FALSE
         AND attempted_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [email, lockoutMin]
    )
    return cnt >= maxAttempts
  } catch {
    return false // fail open if settings table missing
  }
}

// ─── REGISTER ──────────────────────────────────────────────

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      fullname,
      username,
      email,
      password,
      confirmPassword,
      role,
    } = req.body

    // ── basic presence
    if (!fullname || !username || !email || !password || !confirmPassword || !role) {
      res.status(400).json({ success: false, message: 'All fields are required.' })
      return
    }

    // ── sanctioned roles
    if (!['attorney', 'client'].includes(role)) {
      res.status(400).json({ success: false, message: 'Invalid role.' })
      return
    }

    // ── email format
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRx.test(email)) {
      res.status(400).json({ success: false, message: 'Invalid email format.' })
      return
    }

    // ── password match
    if (password !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Passwords do not match.' })
      return
    }

    // ── password strength
    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' })
      return
    }

    const cleanName     = sanitize(fullname)
    const cleanUsername = sanitize(username)
    const cleanEmail    = sanitize(email)

    // ── uniqueness check (prepared statement → no SQL injection)
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [cleanUsername, cleanEmail]
    )

    if (existing.length > 0) {
      res.status(409).json({ success: false, message: 'Username or email already taken.' })
      return
    }

    // ── hash
    const hashed = await bcrypt.hash(password, 12)

    // ── insert
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (fullname, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [cleanName, cleanUsername, cleanEmail, hashed, role]
    )

    await audit(
      { ip: req.ip, socket: req.socket, user: { id: result.insertId } } as any,
      'USER_REGISTERED',
      'user',
      result.insertId,
      `Registered as ${role}: ${cleanEmail}`
    )

    res.status(201).json({
      success: true,
      message: 'Registration successful! You can now log in.',
      userId: result.insertId,
    })
  } catch (err) {
    console.error('[register]', err)
    res.status(500).json({ success: false, message: 'Server error. Please try again.' })
  }
}

// ─── LOGIN ─────────────────────────────────────────────────

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, password } = req.body   // identifier = username OR email

    if (!identifier || !password) {
      res.status(400).json({ success: false, message: 'Username/email and password are required.' })
      return
    }

    const clean = sanitize(identifier)
    const ip = req.ip || req.socket.remoteAddress || 'unknown'

    // ── Check lockout before even validating credentials
    if (await isLockedOut(clean)) {
      res.status(429).json({
        success: false,
        message: 'Account temporarily locked due to too many failed attempts. Please try again later.',
      })
      return
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [clean, clean]
    )

    if (rows.length === 0) {
      await logLoginAttempt(clean, ip, false)
      res.status(401).json({ success: false, message: 'Invalid credentials.' })
      return
    }

    const user = rows[0]

    // ── Also check lockout by exact email (in case identifier was username)
    if (await isLockedOut(user.email)) {
      res.status(429).json({
        success: false,
        message: 'Account temporarily locked due to too many failed attempts. Please try again later.',
      })
      return
    }

    const match = await bcrypt.compare(password, user.password)

    if (!match) {
      await logLoginAttempt(user.email, ip, false)
      res.status(401).json({ success: false, message: 'Invalid credentials.' })
      return
    }

    // ── Check account status
    if (user.status === 'suspended') {
      await logLoginAttempt(user.email, ip, false)
      res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact the system administrator.',
      })
      return
    }

    if (user.status === 'inactive') {
      await logLoginAttempt(user.email, ip, false)
      res.status(403).json({
        success: false,
        message: 'Your account is currently inactive. Please contact your attorney or administrator.',
      })
      return
    }

    // ── Enforce verification gates
    if (user.role === 'attorney' && !user.ibp_verified) {
      res.status(403).json({
        success: false,
        message: 'Your account is pending IBP card verification. Please complete verification to log in.',
      })
      return
    }

    if (user.role === 'client' && !user.id_verified) {
      res.status(403).json({
        success: false,
        message: 'Your account is pending ID verification. Please complete verification to log in.',
      })
      return
    }

    // ── Log successful attempt and update last_login
    await logLoginAttempt(user.email, ip, true)
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id])

    // ── sign JWT
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as `${number}${'s'|'m'|'h'|'d'|'w'|'y'}`
    const token = jwt.sign(
      { id: user.id, fullname: user.fullname, username: user.username, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn }
    )

    await audit(req, 'USER_LOGIN', 'user', user.id)

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        fullname: user.fullname,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    })
  } catch (err) {
    console.error('[login]', err)
    res.status(500).json({ success: false, message: 'Server error. Please try again.' })
  }
}

// ─── VERIFY IBP CARD ──────────────────────────────────────

export const verifyIBP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body
    const file = req.file

    if (!userId || !file) {
      res.status(400).json({ success: false, message: 'User ID and IBP card image are required.' })
      return
    }

    // ── Run Tesseract OCR on the uploaded image buffer
    const { data: { text } } = await Tesseract.recognize(file.buffer, 'eng', {
      logger: () => {}, // suppress progress logs
    })

    const upper = text.toUpperCase()

    // Keywords expected on an IBP card
    const keywords = ['INTEGRATED', 'BAR', 'PHILIPPINES', 'IBP', 'MEMBER', 'ROLL', 'PTR']
    const matched = keywords.filter(k => upper.includes(k))

    if (matched.length < 2) {
      res.status(422).json({
        success: false,
        message:
          'Could not verify IBP card. Please ensure the image is clear and fully shows your IBP card.',
        debug_matched: matched,
      })
      return
    }

    // ── Mark user as IBP-verified
    await pool.execute(
      'UPDATE users SET ibp_verified = 1 WHERE id = ? AND role = ?',
      [Number(userId), 'attorney']
    )

    await audit(
      { ip: req.ip, socket: req.socket, user: { id: Number(userId) } } as any,
      'IBP_VERIFIED',
      'user',
      Number(userId),
      'IBP card verified via OCR'
    )

    res.json({ success: true, message: 'IBP card verified! You may now log in.' })
  } catch (err) {
    console.error('[verifyIBP]', err)
    res.status(500).json({ success: false, message: 'OCR processing failed. Please try again.' })
  }
}

// ─── VERIFY CLIENT GOVERNMENT ID ──────────────────────────

export const verifyClientID = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body
    const file = req.file

    if (!userId || !file) {
      res.status(400).json({ success: false, message: 'User ID and ID image are required.' })
      return
    }

    // ── Run Tesseract OCR on the uploaded image buffer
    const { data: { text } } = await Tesseract.recognize(file.buffer, 'eng', {
      logger: () => {}, // suppress progress logs
    })

    const upper = text.toUpperCase()

    // Keywords found on Philippine government-issued IDs
    const keywords = [
      'REPUBLIC OF THE PHILIPPINES',
      'PHILIPPINES',
      'DRIVER',
      'LICENSE',
      'PASSPORT',
      'UMID',
      'UNIFIED MULTI-PURPOSE',
      'SSS',
      'SOCIAL SECURITY',
      'PHILHEALTH',
      'PAG-IBIG',
      'HDMF',
      'VOTER',
      'POSTAL',
      'SENIOR CITIZEN',
      'PROFESSIONAL REGULATION',
      'PRC',
      'PHILIPPINE IDENTIFICATION',
      'PHILSYS',
      'DATE OF BIRTH',
      'NATIONALITY',
      'VALID UNTIL',
      'EXPIRY',
    ]

    const matched = keywords.filter(k => upper.includes(k))

    if (matched.length < 2) {
      res.status(422).json({
        success: false,
        message:
          'Could not verify your ID. Please ensure the image is clear and fully shows your government-issued ID.',
      })
      return
    }

    // ── Mark client as ID-verified
    await pool.execute(
      'UPDATE users SET id_verified = 1 WHERE id = ? AND role = ?',
      [Number(userId), 'client']
    )

    await audit(
      { ip: req.ip, socket: req.socket, user: { id: Number(userId) } } as any,
      'CLIENT_ID_VERIFIED',
      'user',
      Number(userId),
      'Government ID verified via OCR'
    )

    res.json({ success: true, message: 'ID verified! You may now log in.' })
  } catch (err) {
    console.error('[verifyClientID]', err)
    res.status(500).json({ success: false, message: 'ID processing failed. Please try again.' })
  }
}

// ─── GET CURRENT USER ──────────────────────────────────────

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, fullname, username, email, role, status, created_at FROM users WHERE id = ?',
      [req.user!.id]
    )

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found.' })
      return
    }

    const user = rows[0]

    // For secretaries, include the linked attorney info
    if (user.role === 'secretary') {
      const [link] = await pool.query<RowDataPacket[]>(
        `SELECT as2.attorney_id, u.fullname AS attorney_name
         FROM attorney_secretaries as2
         JOIN users u ON u.id = as2.attorney_id
         WHERE as2.secretary_id = ? AND as2.status = 'active'`,
        [user.id]
      )
      if (link.length > 0) {
        user.attorney_id = link[0].attorney_id
        user.attorney_name = link[0].attorney_name
      }
    }

    res.json({ success: true, user })
  } catch (err) {
    console.error('[getMe]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
