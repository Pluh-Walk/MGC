import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import pool from '../config/db'
import { sendMail } from '../config/mailer'

// ─── Request Password Reset ─────────────────────────────────
export const requestReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body

    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required.' })
      return
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, fullname, email FROM users WHERE email = ?`,
      [email.trim().toLowerCase()]
    )

    // Always respond with success to prevent email enumeration
    if (!rows.length) {
      res.json({ success: true, message: 'If that email exists, a reset link has been sent.' })
      return
    }

    const user = rows[0]
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Invalidate old tokens
    await pool.query(
      `UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ? AND used = FALSE`,
      [user.id]
    )

    await pool.query<ResultSetHeader>(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
      [user.id, token, expiresAt]
    )

    const resetUrl = `${process.env.CLIENT_ORIGIN || 'http://localhost:3000'}/reset-password?token=${token}`

    await sendMail(
      user.email,
      'MGC Law System — Password Reset Request',
      `
        <div style="font-family:sans-serif;max-width:500px;margin:auto">
          <h2 style="color:#b8962e">MGC Law System</h2>
          <p>Hello ${user.fullname},</p>
          <p>We received a request to reset your password. Click the button below to proceed:</p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:12px 24px;background:#b8962e;color:#fff;
                    text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0">
            Reset Password
          </a>
          <p>This link expires in <strong>1 hour</strong>.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <hr style="margin-top:32px;border:none;border-top:1px solid #eee"/>
          <p style="color:#888;font-size:12px">MGC Law System · Do not reply to this email</p>
        </div>
      `
    )

    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to send reset email.' })
  }
}

// ─── Reset Password ─────────────────────────────────────────
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password, confirmPassword } = req.body

    if (!token || !password || !confirmPassword) {
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

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM password_reset_tokens
       WHERE token = ? AND used = FALSE AND expires_at > NOW()`,
      [token]
    )

    if (!rows.length) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset token.' })
      return
    }

    const resetEntry = rows[0]
    const hashed = await bcrypt.hash(password, 12)

    await pool.query(`UPDATE users SET password = ? WHERE id = ?`, [hashed, resetEntry.user_id])
    await pool.query(
      `UPDATE password_reset_tokens SET used = TRUE WHERE id = ?`,
      [resetEntry.id]
    )

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
