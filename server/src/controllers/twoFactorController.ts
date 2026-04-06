/**
 * Two-Factor Authentication Controller
 *
 * Endpoints:
 *   POST /api/2fa/setup          — generate a pending TOTP secret + QR code
 *   POST /api/2fa/confirm-setup  — verify first OTP and activate 2FA (also returns backup codes)
 *   POST /api/2fa/disable        — disable 2FA after password + OTP confirmation
 *   GET  /api/2fa/backup-codes   — list remaining (unused) backup codes
 *   POST /api/2fa/regenerate-backup-codes — burn all existing codes, issue 8 new ones
 *
 * The login gate (validate OTP when totp_enabled) lives in authController.ts.
 */

import { Request, Response } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { RowDataPacket } from 'mysql2'
import pool from '../config/db'
import { audit } from '../utils/audit'

// ─── Internal helpers ─────────────────────────────────────

/** Hash an 8-digit backup code with SHA-256 for storage. */
const hashCode = (plain: string): string =>
  crypto.createHash('sha256').update(plain).digest('hex')

/** Generate 8 random 8-digit backup codes and store their hashes for a user. */
export const generateAndStoreBackupCodes = async (userId: number): Promise<string[]> => {
  // Invalidate all previous codes
  await pool.query('DELETE FROM two_factor_backup_codes WHERE user_id = ?', [userId])
  const codes: string[] = []
  for (let i = 0; i < 8; i++) {
    // 4 bytes → 8 hex chars → easy-to-type code
    const plain = crypto.randomBytes(4).toString('hex').toUpperCase()
    codes.push(plain)
    await pool.query(
      'INSERT INTO two_factor_backup_codes (user_id, code_hash) VALUES (?, ?)',
      [userId, hashCode(plain)]
    )
  }
  return codes
}

const SITE_NAME = 'MGC Law System'

// ─── POST /api/2fa/setup ──────────────────────────────────
/**
 * Generates a new TOTP secret, stores it as pending (not yet active),
 * returns the QR code data-URL for scanning in an authenticator app.
 * The user must confirm with a valid OTP before 2FA is actually enabled.
 */
export const setup2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!

    // Only allowed for attorneys and admins
    if (!['attorney', 'admin'].includes(user.role)) {
      res.status(403).json({ success: false, message: '2FA is only available to attorneys and administrators.' })
      return
    }

    // Check if already enabled
    const [[row]] = await pool.query<RowDataPacket[]>(
      'SELECT totp_enabled FROM users WHERE id = ?', [user.id]
    )
    if (row?.totp_enabled) {
      res.status(400).json({ success: false, message: '2FA is already enabled on your account.' })
      return
    }

    // Generate new secret
    const secret = speakeasy.generateSecret({ length: 20, name: `${SITE_NAME}:${user.username}` })

    // Upsert pending record — replace any previous incomplete setup
    await pool.query(
      `INSERT INTO totp_pending (user_id, secret) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE secret = VALUES(secret), created_at = NOW()`,
      [user.id, secret.base32]
    )

    // Build otpauth URL for QR code
    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret.ascii,
      label: encodeURIComponent(`${SITE_NAME}:${user.username}`),
      issuer: SITE_NAME,
    })

    const qrDataUrl = await QRCode.toDataURL(otpauthUrl)

    res.json({
      success: true,
      qrCode: qrDataUrl,
      // Also expose the manual-entry key for users who can't scan
      manualKey: secret.base32,
    })
  } catch (err) {
    console.error('[setup2FA]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── POST /api/2fa/confirm-setup ─────────────────────────
/**
 * The user scans the QR code and enters the 6-digit OTP.
 * If valid, activates 2FA and returns 8 backup codes.
 */
export const confirmSetup2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!
    const { otp } = req.body as { otp: string }

    if (!otp || !/^\d{6}$/.test(otp)) {
      res.status(400).json({ success: false, message: 'Please enter a valid 6-digit OTP.' })
      return
    }

    // Retrieve pending secret
    const [[pending]] = await pool.query<RowDataPacket[]>(
      'SELECT secret FROM totp_pending WHERE user_id = ?', [user.id]
    )
    if (!pending) {
      res.status(400).json({ success: false, message: 'No pending 2FA setup found. Please start setup again.' })
      return
    }

    const valid = speakeasy.totp.verify({
      secret: pending.secret,
      encoding: 'base32',
      token: otp,
      window: 1,
    })

    if (!valid) {
      res.status(422).json({ success: false, message: 'Invalid OTP. Please try again.' })
      return
    }

    // Activate 2FA
    await pool.query(
      'UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?',
      [pending.secret, user.id]
    )
    await pool.query('DELETE FROM totp_pending WHERE user_id = ?', [user.id])

    const backupCodes = await generateAndStoreBackupCodes(user.id)
    await audit(req, '2FA_ENABLED', 'user', user.id)

    res.json({
      success: true,
      message: '2FA has been enabled on your account.',
      backupCodes,
    })
  } catch (err) {
    console.error('[confirmSetup2FA]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── POST /api/2fa/disable ────────────────────────────────
/**
 * Disables 2FA. Requires the user's current password + a valid OTP (or backup code).
 */
export const disable2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!
    const { password, otp } = req.body as { password: string; otp: string }

    if (!password || !otp) {
      res.status(400).json({ success: false, message: 'Password and OTP are required.' })
      return
    }

    const [[row]] = await pool.query<RowDataPacket[]>(
      'SELECT password, totp_secret, totp_enabled FROM users WHERE id = ?', [user.id]
    )
    if (!row?.totp_enabled) {
      res.status(400).json({ success: false, message: '2FA is not enabled on your account.' })
      return
    }

    const passwordOk = await bcrypt.compare(password, row.password)
    if (!passwordOk) {
      res.status(401).json({ success: false, message: 'Incorrect password.' })
      return
    }

    const totpOk = speakeasy.totp.verify({
      secret: row.totp_secret,
      encoding: 'base32',
      token: otp,
      window: 1,
    })
    if (!totpOk) {
      res.status(422).json({ success: false, message: 'Invalid OTP.' })
      return
    }

    await pool.query(
      'UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?',
      [user.id]
    )
    await pool.query('DELETE FROM two_factor_backup_codes WHERE user_id = ?', [user.id])
    await audit(req, '2FA_DISABLED', 'user', user.id)

    res.json({ success: true, message: '2FA has been disabled.' })
  } catch (err) {
    console.error('[disable2FA]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── GET /api/2fa/backup-codes ────────────────────────────
export const listBackupCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, used_at, created_at FROM two_factor_backup_codes
       WHERE user_id = ? ORDER BY id`,
      [user.id]
    )

    res.json({
      success: true,
      total: rows.length,
      remaining: rows.filter((r) => !r.used_at).length,
      codes: rows,
    })
  } catch (err) {
    console.error('[listBackupCodes]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── POST /api/2fa/regenerate-backup-codes ───────────────
export const regenerateBackupCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!
    const { otp } = req.body as { otp: string }

    if (!otp) {
      res.status(400).json({ success: false, message: 'OTP is required to regenerate backup codes.' })
      return
    }

    const [[row]] = await pool.query<RowDataPacket[]>(
      'SELECT totp_secret, totp_enabled FROM users WHERE id = ?', [user.id]
    )
    if (!row?.totp_enabled) {
      res.status(400).json({ success: false, message: '2FA is not enabled.' })
      return
    }

    const valid = speakeasy.totp.verify({
      secret: row.totp_secret,
      encoding: 'base32',
      token: otp,
      window: 1,
    })
    if (!valid) {
      res.status(422).json({ success: false, message: 'Invalid OTP.' })
      return
    }

    const backupCodes = await generateAndStoreBackupCodes(user.id)
    await audit(req, '2FA_BACKUP_CODES_REGENERATED', 'user', user.id)

    res.json({
      success: true,
      message: 'New backup codes generated. Previous codes are now invalid.',
      backupCodes,
    })
  } catch (err) {
    console.error('[regenerateBackupCodes]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── GET /api/2fa/status ─────────────────────────────────
export const get2FAStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const [[row]] = await pool.query<RowDataPacket[]>(
      'SELECT totp_enabled FROM users WHERE id = ?', [req.user!.id]
    )
    const [backupRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS remaining FROM two_factor_backup_codes WHERE user_id = ? AND used_at IS NULL',
      [req.user!.id]
    )
    res.json({
      success: true,
      enabled: !!row?.totp_enabled,
      backupCodesRemaining: backupRows[0]?.remaining ?? 0,
    })
  } catch (err) {
    console.error('[get2FAStatus]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
