import pool from '../config/db'
import { Request } from 'express'

/**
 * Writes an audit log entry. Fire-and-forget — never throws.
 */
export const audit = async (
  req: Request,
  action: string,
  targetType?: string,
  targetId?: number,
  details?: string
): Promise<void> => {
  try {
    const userId = (req as any).user?.id ?? null
    const ip = req.ip || req.socket.remoteAddress || null
    await pool.query(
      `INSERT INTO audit_log (user_id, action, target_type, target_id, ip_address, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, action, targetType ?? null, targetId ?? null, ip, details ?? null]
    )
  } catch {
    // Audit failures must never crash the main request
  }
}
