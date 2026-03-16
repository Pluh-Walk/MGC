import { Request, Response } from 'express'
import { RowDataPacket } from 'mysql2'
import pool from '../config/db'
import { audit } from '../utils/audit'

// ─── Get All Settings ───────────────────────────────────────
export const getAllSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, setting_key, setting_value, description, updated_at
       FROM system_settings ORDER BY setting_key ASC`
    )
    res.json({ success: true, data: rows })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Get Single Setting ─────────────────────────────────────
export const getSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params
    const [[row]] = await pool.query<RowDataPacket[]>(
      'SELECT setting_key, setting_value, description FROM system_settings WHERE setting_key = ?',
      [key]
    )
    if (!row) { res.status(404).json({ success: false, message: 'Setting not found.' }); return }
    res.json({ success: true, data: row })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Update Setting ─────────────────────────────────────────
export const updateSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = (req as any).user
    const { key } = req.params
    const { value } = req.body

    if (value === undefined || value === null) {
      res.status(400).json({ success: false, message: 'Value is required.' })
      return
    }

    const [[existing]] = await pool.query<RowDataPacket[]>(
      'SELECT id, setting_value FROM system_settings WHERE setting_key = ?', [key]
    )
    if (!existing) { res.status(404).json({ success: false, message: 'Setting not found.' }); return }

    const oldValue = existing.setting_value

    await pool.query(
      'UPDATE system_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?',
      [String(value), admin.id, key]
    )

    await audit(req, 'ADMIN_UPDATE_SETTING', 'setting', existing.id, `${key}: "${oldValue}" → "${value}"`)
    res.json({ success: true, message: 'Setting updated.' })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Bulk Update Settings ───────────────────────────────────
export const bulkUpdateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = (req as any).user
    const { settings } = req.body // Array of { key, value }

    if (!Array.isArray(settings) || !settings.length) {
      res.status(400).json({ success: false, message: 'Settings array is required.' })
      return
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      for (const { key, value } of settings) {
        if (!key || value === undefined) continue
        await conn.query(
          'UPDATE system_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?',
          [String(value), admin.id, key]
        )
      }

      await conn.commit()
    } catch (txErr) {
      await conn.rollback()
      throw txErr
    } finally {
      conn.release()
    }

    const changedKeys = settings.map(s => s.key).join(', ')
    await audit(req, 'ADMIN_BULK_UPDATE_SETTINGS', 'setting', undefined, changedKeys)
    res.json({ success: true, message: `${settings.length} setting(s) updated.` })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
