import { Request, Response, NextFunction } from 'express'
import { RowDataPacket } from 'mysql2'
import pool from '../config/db'

let maintenanceCached: boolean | null = null
let cacheExpiry = 0
const CACHE_TTL_MS = 30_000 // recheck DB every 30 seconds

/** Returns true when maintenance_mode = '1' in system_settings */
async function isMaintenanceActive(): Promise<boolean> {
  if (maintenanceCached !== null && Date.now() < cacheExpiry) {
    return maintenanceCached
  }
  try {
    const [[row]] = await pool.query<RowDataPacket[]>(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'maintenance_mode' LIMIT 1`
    )
    maintenanceCached = row?.setting_value === '1' || row?.setting_value === 'true'
  } catch {
    maintenanceCached = false
  }
  cacheExpiry = Date.now() + CACHE_TTL_MS
  return maintenanceCached
}

/** Call this to force the next request to recheck the DB (e.g. after updating the setting) */
export function invalidateMaintenanceCache() {
  maintenanceCached = null
  cacheExpiry = 0
}

/**
 * Maintenance mode guard.
 * Admin users bypass it; everyone else gets 503.
 * Must be registered BEFORE route handlers.
 */
export const maintenanceGuard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Always allow health checks and admin API through
  if (
    req.path === '/api/health' ||
    req.path.startsWith('/api/auth') ||
    req.path.startsWith('/api/admin')
  ) {
    next()
    return
  }

  const active = await isMaintenanceActive()
  if (!active) { next(); return }

  // Check if the caller is an admin (token already decoded by verifyToken if present)
  const user = (req as any).user
  if (user?.role === 'admin') { next(); return }

  res.status(503).json({
    success:     false,
    maintenance: true,
    message:     'The system is currently undergoing maintenance. Please try again shortly.',
  })
}
