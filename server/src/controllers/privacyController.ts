/**
 * Data Privacy Controller — RA 10173 (Data Privacy Act of the Philippines)
 *
 * Provides:
 *   GET  /api/admin/privacy/dsar/:userId   — export all personal data as JSON
 *   POST /api/admin/privacy/erase/:userId  — anonymise + soft-delete user data
 */
import { Request, Response } from 'express'
import { RowDataPacket } from 'mysql2'
import crypto from 'crypto'
import pool from '../config/db'
import { audit } from '../utils/audit'
import logger from '../config/logger'

// ─── DSAR: Export all personal data for a user ───────────────
export const dsarExport = async (req: Request, res: Response): Promise<void> => {
  const admin = (req as any).user
  const userId = Number(req.params.userId)

  if (!Number.isFinite(userId)) {
    res.status(400).json({ success: false, message: 'Invalid user ID.' })
    return
  }

  try {
    const [[user]] = await pool.query<RowDataPacket[]>(
      `SELECT id, fullname, username, email, role, status, created_at, last_login
       FROM users WHERE id = ?`,
      [userId]
    )
    if (!user) { res.status(404).json({ success: false, message: 'User not found.' }); return }

    const [[profile]] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM attorney_profiles WHERE user_id = ? UNION ALL
       SELECT * FROM client_profiles WHERE user_id = ? LIMIT 1`,
      [userId, userId]
    ).catch(() => [[null]] as any)

    const [cases] = await pool.query<RowDataPacket[]>(
      `SELECT id, case_number, title, status, case_type, created_at FROM cases
       WHERE (client_id = ? OR attorney_id = ?) AND deleted_at IS NULL`,
      [userId, userId]
    )

    const [messages] = await pool.query<RowDataPacket[]>(
      `SELECT id, content, created_at FROM messages
       WHERE sender_id = ? AND deleted_for_sender = 0 ORDER BY created_at DESC LIMIT 500`,
      [userId]
    )

    const [documents] = await pool.query<RowDataPacket[]>(
      `SELECT id, filename, original_name, category, uploaded_at FROM documents
       WHERE uploaded_by = ? AND deleted_at IS NULL`,
      [userId]
    )

    const [auditLogs] = await pool.query<RowDataPacket[]>(
      `SELECT action, target_type, target_id, details, ip_address, created_at
       FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 1000`,
      [userId]
    )

    const payload = {
      exported_at: new Date().toISOString(),
      exported_by: `admin:${admin.id}`,
      user,
      profile: profile || null,
      cases,
      messages,
      documents,
      audit_logs: auditLogs,
    }

    await audit(req, 'ADMIN_DSAR_EXPORT', 'user', userId, `DSAR export for user ${userId}`)
    logger.info(`DSAR export for user ${userId}`, { adminId: admin.id })

    res
      .header('Content-Disposition', `attachment; filename="dsar-user-${userId}-${Date.now()}.json"`)
      .header('Content-Type', 'application/json')
      .send(JSON.stringify(payload, null, 2))
  } catch (err: any) {
    logger.error('DSAR export error', { error: err.message })
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Right to Erasure: Anonymise user personal data ──────────
export const eraseUserData = async (req: Request, res: Response): Promise<void> => {
  const admin = (req as any).user
  const userId = Number(req.params.userId)

  if (!Number.isFinite(userId)) {
    res.status(400).json({ success: false, message: 'Invalid user ID.' })
    return
  }
  if (userId === admin.id) {
    res.status(400).json({ success: false, message: 'Cannot erase your own account.' })
    return
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [[user]] = await conn.query<RowDataPacket[]>(
      'SELECT id, role FROM users WHERE id = ?', [userId]
    )
    if (!user) { await conn.rollback(); res.status(404).json({ success: false, message: 'User not found.' }); return }

    // Generate anonymous replacement identifiers
    const anonId   = `ANON_${crypto.randomBytes(6).toString('hex').toUpperCase()}`
    const anonEmail = `${anonId.toLowerCase()}@erased.invalid`

    // Anonymise core user record
    await conn.query(
      `UPDATE users SET
         fullname     = ?,
         username     = ?,
         email        = ?,
         totp_secret  = NULL,
         totp_enabled = 0,
         status       = 'inactive'
       WHERE id = ?`,
      [anonId, anonId, anonEmail, userId]
    )

    // Remove attorney profile PII
    await conn.query(
      `UPDATE attorney_profiles SET
         bio = NULL, address = NULL, education = NULL, phone = NULL
       WHERE user_id = ?`,
      [userId]
    ).catch(() => {})

    // Remove client profile PII
    await conn.query(
      `UPDATE client_profiles SET
         address = NULL, phone = NULL, emergency_contact = NULL
       WHERE user_id = ?`,
      [userId]
    ).catch(() => {})

    // Scrub IBP/ID verification images
    await conn.query(
      `UPDATE users SET ibp_card_url = NULL, id_image_url = NULL WHERE id = ?`, [userId]
    ).catch(() => {})

    // Revoke all active tokens
    await conn.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`,
      [userId]
    ).catch(() => {})

    // Remove 2FA backup codes
    await conn.query('DELETE FROM two_factor_backup_codes WHERE user_id = ?', [userId]).catch(() => {})
    await conn.query('DELETE FROM totp_pending WHERE user_id = ?', [userId]).catch(() => {})

    await conn.commit()

    await audit(req, 'ADMIN_ERASE_USER', 'user', userId,
      `Personal data erased for user ${userId} (was ${user.role}). Anonymised as ${anonId}.`)
    logger.warn(`User ${userId} data erased by admin ${admin.id}`)

    res.json({
      success: true,
      message: `User data has been anonymised. Identifier: ${anonId}`,
      anonymised_id: anonId,
    })
  } catch (err: any) {
    await conn.rollback()
    logger.error('Data erasure error', { error: err.message })
    res.status(500).json({ success: false, message: 'Server error.' })
  } finally {
    conn.release()
  }
}
