import { Request, Response } from 'express'
import { RowDataPacket } from 'mysql2'
import pool from '../config/db'

// ─── Query Audit Logs ───────────────────────────────────────
export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      user_id, action, target_type, search,
      from, to,
      page = '1', limit = '50'
    } = req.query

    const conditions: string[] = []
    const params: any[] = []

    if (user_id && typeof user_id === 'string') {
      conditions.push('al.user_id = ?')
      params.push(Number(user_id))
    }
    if (action && typeof action === 'string') {
      conditions.push('al.action LIKE ?')
      params.push(`%${action}%`)
    }
    if (target_type && typeof target_type === 'string') {
      conditions.push('al.target_type = ?')
      params.push(target_type)
    }
    if (search && typeof search === 'string') {
      conditions.push('(al.details LIKE ? OR al.action LIKE ? OR u.fullname LIKE ?)')
      const s = `%${search}%`
      params.push(s, s, s)
    }
    if (from && typeof from === 'string') {
      conditions.push('al.created_at >= ?')
      params.push(from)
    }
    if (to && typeof to === 'string') {
      conditions.push('al.created_at <= ?')
      params.push(`${to} 23:59:59`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit)

    const [[{ total }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       ${where}`,
      params
    )

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT al.id, al.user_id, al.action, al.target_type, al.target_id,
              al.ip_address, al.details, al.created_at,
              u.fullname AS user_name, u.role AS user_role
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    )

    res.json({ success: true, data: rows, total, page: Number(page), limit: Number(limit) })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Export Audit Logs as CSV ───────────────────────────────
export const exportAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to, action, user_id } = req.query

    const conditions: string[] = []
    const params: any[] = []

    if (user_id && typeof user_id === 'string') {
      conditions.push('al.user_id = ?')
      params.push(Number(user_id))
    }
    if (action && typeof action === 'string') {
      conditions.push('al.action LIKE ?')
      params.push(`%${action}%`)
    }
    if (from && typeof from === 'string') {
      conditions.push('al.created_at >= ?')
      params.push(from)
    }
    if (to && typeof to === 'string') {
      conditions.push('al.created_at <= ?')
      params.push(`${to} 23:59:59`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT al.id, al.user_id, u.fullname AS user_name, u.role AS user_role,
              al.action, al.target_type, al.target_id, al.ip_address,
              al.details, al.created_at
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT 10000`,
      params
    )

    // Build CSV
    const headers = ['ID', 'User ID', 'User Name', 'Role', 'Action', 'Target Type', 'Target ID', 'IP Address', 'Details', 'Date']
    const csvRows = rows.map(r =>
      [
        r.id, r.user_id, `"${(r.user_name || '').replace(/"/g, '""')}"`, r.user_role,
        r.action, r.target_type, r.target_id, r.ip_address,
        `"${(r.details || '').replace(/"/g, '""')}"`, r.created_at
      ].join(',')
    )
    const csv = [headers.join(','), ...csvRows].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="audit_log_${new Date().toISOString().slice(0, 10)}.csv"`)
    res.send(csv)
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Audit Log Summary Stats ────────────────────────────────
export const getAuditStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [byAction] = await pool.query<RowDataPacket[]>(
      `SELECT action, COUNT(*) AS cnt
       FROM audit_log
       WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY action ORDER BY cnt DESC LIMIT 20`
    )

    const [byDay] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(created_at) AS date, COUNT(*) AS cnt
       FROM audit_log
       WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at) ORDER BY date ASC`
    )

    const [[totals]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total,
              SUM(created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)) AS last_24h,
              SUM(created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)) AS last_7d
       FROM audit_log`
    )

    res.json({ success: true, data: { by_action: byAction, by_day: byDay, totals } })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
