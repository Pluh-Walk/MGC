import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import bcrypt from 'bcryptjs'
import pool from '../config/db'
import { audit } from '../utils/audit'
import { notify } from '../utils/notify'

// ─── List Users (with filters) ──────────────────────────────
export const listUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, status, search, verified, page = '1', limit = '25' } = req.query

    const conditions: string[] = []
    const params: any[] = []

    if (role && typeof role === 'string') {
      conditions.push('u.role = ?')
      params.push(role)
    }
    if (status && typeof status === 'string') {
      conditions.push('u.status = ?')
      params.push(status)
    }
    if (verified === 'true') {
      conditions.push('u.ibp_verified = 1')
    } else if (verified === 'false') {
      conditions.push('(u.ibp_verified = 0 OR u.ibp_verified IS NULL)')
    }
    if (search && typeof search === 'string') {
      conditions.push('(u.fullname LIKE ? OR u.email LIKE ? OR u.username LIKE ?)')
      const s = `%${search}%`
      params.push(s, s, s)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit)

    const [[{ total }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM users u ${where}`,
      params
    )

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.fullname, u.username, u.email, u.role, u.status,
              u.ibp_verified, u.created_at, u.last_login
       FROM users u ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    )

    res.json({ success: true, data: rows, total, page: Number(page), limit: Number(limit) })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Get Single User Detail ─────────────────────────────────
export const getUserDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const [[user]] = await pool.query<RowDataPacket[]>(
      `SELECT id, fullname, username, email, role, status, ibp_verified, created_at, last_login
       FROM users WHERE id = ?`,
      [id]
    )
    if (!user) { res.status(404).json({ success: false, message: 'User not found.' }); return }

    // Fetch role-specific profile
    let profile = null
    if (user.role === 'attorney') {
      const [p] = await pool.query<RowDataPacket[]>('SELECT * FROM attorney_profiles WHERE user_id = ?', [id])
      profile = p[0] ?? null
    } else if (user.role === 'client') {
      const [p] = await pool.query<RowDataPacket[]>('SELECT * FROM client_profiles WHERE user_id = ?', [id])
      profile = p[0] ?? null
    } else if (user.role === 'secretary') {
      const [p] = await pool.query<RowDataPacket[]>(
        `SELECT sp.*, u.fullname AS attorney_name, als.attorney_id
         FROM secretary_profiles sp
         LEFT JOIN attorney_secretaries als ON als.secretary_id = sp.user_id AND als.status = 'active'
         LEFT JOIN users u ON u.id = als.attorney_id
         WHERE sp.user_id = ?`, [id])
      profile = p[0] ?? null
    }

    // Recent audit entries for this user
    const [auditRows] = await pool.query<RowDataPacket[]>(
      `SELECT action, target_type, details, ip_address, created_at
       FROM audit_log WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 20`,
      [id]
    )

    res.json({ success: true, data: { ...user, profile, recent_audit: auditRows } })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Create User (admin-only, bypasses verification) ────────
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullname, username, email, password, role } = req.body

    if (!fullname || !username || !email || !password || !role) {
      res.status(400).json({ success: false, message: 'All fields are required.' })
      return
    }
    if (!['attorney', 'client', 'admin', 'secretary'].includes(role)) {
      res.status(400).json({ success: false, message: 'Invalid role.' })
      return
    }
    // Only the original seed admin (id=11) can create other admin accounts
    if (role === 'admin') {
      const existingAdminId = (req as any).user?.id
      const [[caller]] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE id = ? AND role = ?', [existingAdminId, 'admin']
      )
      if (!caller) {
        res.status(403).json({ success: false, message: 'Only administrators can create admin accounts.' })
        return
      }
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' })
      return
    }

    // Check duplicates
    const [[exists]] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? OR username = ?', [email, username]
    )
    if (exists) {
      res.status(409).json({ success: false, message: 'Email or username already exists.' })
      return
    }

    const hash = await bcrypt.hash(password, 12)
    const ibpVerified = role === 'admin' ? 1 : 0

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (fullname, username, email, password, role, status, ibp_verified)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      [fullname.trim(), username.trim(), email.trim().toLowerCase(), hash, role, ibpVerified]
    )

    await audit(req, 'ADMIN_CREATE_USER', 'user', result.insertId, `Created ${role}: ${email}`)
    res.status(201).json({ success: true, data: { id: result.insertId } })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Update User ────────────────────────────────────────────
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { fullname, email, role, status } = req.body
    const admin = (req as any).user

    if (Number(id) === admin.id && status === 'suspended') {
      res.status(400).json({ success: false, message: 'Cannot suspend your own account.' })
      return
    }

    const fields: string[] = []
    const params: any[] = []

    if (fullname) { fields.push('fullname = ?'); params.push(fullname.trim()) }
    if (email) { fields.push('email = ?'); params.push(email.trim().toLowerCase()) }
    if (role && ['attorney', 'client', 'admin', 'secretary'].includes(role)) {
      // Prevent elevating users to admin via update
      if (role === 'admin') {
        const [[targetUser]] = await pool.query<RowDataPacket[]>(
          'SELECT role FROM users WHERE id = ?', [id]
        )
        if (targetUser?.role !== 'admin') {
          res.status(403).json({ success: false, message: 'Cannot elevate a user to admin role via updates.' })
          return
        }
      }
      fields.push('role = ?'); params.push(role)
    }
    if (status && ['active', 'suspended', 'inactive', 'pending'].includes(status)) {
      fields.push('status = ?'); params.push(status)
    }

    if (!fields.length) {
      res.status(400).json({ success: false, message: 'No fields to update.' })
      return
    }

    params.push(id)
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params)
    await audit(req, 'ADMIN_UPDATE_USER', 'user', Number(id), `Fields: ${fields.map(f => f.split('=')[0].trim()).join(', ')}`)

    res.json({ success: true, message: 'User updated.' })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Suspend User ───────────────────────────────────────────
export const suspendUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = (req as any).user
    const { id } = req.params
    const { reason } = req.body

    if (Number(id) === admin.id) {
      res.status(400).json({ success: false, message: 'Cannot suspend your own account.' })
      return
    }
    if (!reason?.trim()) {
      res.status(400).json({ success: false, message: 'Reason is required.' })
      return
    }

    const [[target]] = await pool.query<RowDataPacket[]>(
      'SELECT id, status, email FROM users WHERE id = ?', [id]
    )
    if (!target) { res.status(404).json({ success: false, message: 'User not found.' }); return }
    if (target.status === 'suspended') {
      res.status(400).json({ success: false, message: 'User is already suspended.' })
      return
    }

    await pool.query('UPDATE users SET status = ? WHERE id = ?', ['suspended', id])
    await pool.query(
      'INSERT INTO user_suspensions (user_id, suspended_by, reason) VALUES (?, ?, ?)',
      [id, admin.id, reason.trim()]
    )

    await audit(req, 'ADMIN_SUSPEND_USER', 'user', Number(id), reason.trim())
    res.json({ success: true, message: 'User suspended.' })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Reactivate User ────────────────────────────────────────
export const reactivateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = (req as any).user
    const { id } = req.params

    const [[target]] = await pool.query<RowDataPacket[]>(
      'SELECT id, status FROM users WHERE id = ?', [id]
    )
    if (!target) { res.status(404).json({ success: false, message: 'User not found.' }); return }
    if (target.status !== 'suspended' && target.status !== 'inactive') {
      res.status(400).json({ success: false, message: 'User is not suspended or inactive.' })
      return
    }

    await pool.query('UPDATE users SET status = ? WHERE id = ?', ['active', id])

    // Lift latest suspension record
    await pool.query(
      `UPDATE user_suspensions SET lifted_at = NOW(), lifted_by = ?
       WHERE user_id = ? AND lifted_at IS NULL ORDER BY suspended_at DESC LIMIT 1`,
      [admin.id, id]
    )

    await audit(req, 'ADMIN_REACTIVATE_USER', 'user', Number(id))
    res.json({ success: true, message: 'User reactivated.' })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Reset User Password (admin-triggered) ──────────────────
export const resetUserPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { newPassword } = req.body

    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' })
      return
    }

    const [[target]] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE id = ?', [id]
    )
    if (!target) { res.status(404).json({ success: false, message: 'User not found.' }); return }

    const hash = await bcrypt.hash(newPassword, 12)
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, id])

    await audit(req, 'ADMIN_RESET_PASSWORD', 'user', Number(id))
    res.json({ success: true, message: 'Password reset successfully.' })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Delete User (hard delete) ──────────────────────────────
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = (req as any).user
    const { id } = req.params

    if (Number(id) === admin.id) {
      res.status(400).json({ success: false, message: 'Cannot delete your own account.' })
      return
    }

    const [[target]] = await pool.query<RowDataPacket[]>(
      'SELECT id, email, role FROM users WHERE id = ?', [id]
    )
    if (!target) { res.status(404).json({ success: false, message: 'User not found.' }); return }

    await audit(req, 'ADMIN_DELETE_USER', 'user', Number(id), `Deleted ${target.role}: ${target.email}`)
    await pool.query('DELETE FROM users WHERE id = ?', [id])

    res.json({ success: true, message: 'User permanently deleted.' })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Verification Queue ─────────────────────────────────────
export const getVerificationQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.query // 'attorney' | 'client' | undefined (both)

    const conditions: string[] = ["u.status != 'suspended'"]
    const params: any[] = []

    if (type === 'attorney') {
      conditions.push("u.role = 'attorney'")
      conditions.push('u.ibp_verified = 0')
    } else if (type === 'client') {
      conditions.push("u.role = 'client'")
      conditions.push('u.id_verified = 0')
    } else {
      conditions.push("((u.role = 'attorney' AND u.ibp_verified = 0) OR (u.role = 'client' AND u.id_verified = 0))")
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.fullname, u.email, u.role, u.created_at,
              ap.ibp_number,
              cp.id_type, cp.id_number
       FROM users u
       LEFT JOIN attorney_profiles ap ON ap.user_id = u.id AND u.role = 'attorney'
       LEFT JOIN client_profiles cp ON cp.user_id = u.id AND u.role = 'client'
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.created_at ASC`,
      params
    )

    res.json({ success: true, data: rows })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Approve/Reject Verification ────────────────────────────
export const handleVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { action, reason } = req.body // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({ success: false, message: 'Action must be approve or reject.' })
      return
    }

    const [[target]] = await pool.query<RowDataPacket[]>(
      'SELECT id, email, role FROM users WHERE id = ?', [id]
    )
    if (!target) { res.status(404).json({ success: false, message: 'User not found.' }); return }

    // Use the correct verification column based on role
    const verifyColumn = target.role === 'client' ? 'id_verified' : 'ibp_verified'

    if (action === 'approve') {
      await pool.query(`UPDATE users SET ${verifyColumn} = 1 WHERE id = ?`, [id])
      await notify(Number(id), 'case_update', 'Your identity verification has been approved. You now have full access.')
    } else {
      await pool.query(`UPDATE users SET ${verifyColumn} = 0 WHERE id = ?`, [id])
      await notify(Number(id), 'case_update', `Your identity verification was rejected. Reason: ${reason || 'Not specified'}`)
    }

    await audit(req, `ADMIN_VERIFY_${action.toUpperCase()}`, 'user', Number(id), reason || undefined)
    res.json({ success: true, message: `Verification ${action}d.` })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── All Cases (system-wide) ────────────────────────────────
export const getAllCases = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search, page = '1', limit = '25' } = req.query

    const conditions: string[] = ['c.deleted_at IS NULL']
    const params: any[] = []

    if (status && typeof status === 'string') {
      conditions.push('c.status = ?')
      params.push(status)
    }
    if (search && typeof search === 'string') {
      conditions.push('(c.case_number LIKE ? OR c.title LIKE ?)')
      const s = `%${search}%`
      params.push(s, s)
    }

    const where = conditions.join(' AND ')
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit)

    const [[{ total }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM cases c WHERE ${where}`, params
    )

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.*, a.fullname AS attorney_name, cl.fullname AS client_name
       FROM cases c
       LEFT JOIN users a ON a.id = c.attorney_id
       LEFT JOIN users cl ON cl.id = c.client_id
       WHERE ${where}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    )

    res.json({ success: true, data: rows, total, page: Number(page), limit: Number(limit) })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Reassign Case ──────────────────────────────────────────
export const reassignCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { attorney_id } = req.body

    if (!attorney_id) {
      res.status(400).json({ success: false, message: 'attorney_id is required.' })
      return
    }

    const [[caseRow]] = await pool.query<RowDataPacket[]>(
      'SELECT id, attorney_id AS old_attorney_id, client_id, case_number FROM cases WHERE id = ? AND deleted_at IS NULL', [id]
    )
    if (!caseRow) { res.status(404).json({ success: false, message: 'Case not found.' }); return }

    const [[newAtty]] = await pool.query<RowDataPacket[]>(
      "SELECT id, fullname FROM users WHERE id = ? AND role = 'attorney' AND status = 'active'", [attorney_id]
    )
    if (!newAtty) { res.status(404).json({ success: false, message: 'Target attorney not found or inactive.' }); return }

    await pool.query('UPDATE cases SET attorney_id = ? WHERE id = ?', [attorney_id, id])

    // Timeline entry
    await pool.query(
      `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
       VALUES (?, 'status_change', ?, CURDATE(), ?)`,
      [id, `Case reassigned to ${newAtty.fullname} by admin`, (req as any).user.id]
    )

    // Notify new attorney
    await notify(attorney_id, 'case_update', `Case ${caseRow.case_number} has been reassigned to you.`, Number(id))
    // Notify client
    if (caseRow.client_id) {
      await notify(caseRow.client_id, 'case_update', `Your case ${caseRow.case_number} has been reassigned to a new attorney.`, Number(id))
    }

    await audit(req, 'ADMIN_REASSIGN_CASE', 'case', Number(id), `From attorney ${caseRow.old_attorney_id} to ${attorney_id}`)
    res.json({ success: true, message: 'Case reassigned.' })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Force Archive Case ─────────────────────────────────────
export const forceArchiveCase = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const [[caseRow]] = await pool.query<RowDataPacket[]>(
      'SELECT id, case_number FROM cases WHERE id = ? AND deleted_at IS NULL', [id]
    )
    if (!caseRow) { res.status(404).json({ success: false, message: 'Case not found.' }); return }

    await pool.query("UPDATE cases SET status = 'archived' WHERE id = ?", [id])

    await pool.query(
      `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
       VALUES (?, 'status_change', 'Case force-archived by admin', CURDATE(), ?)`,
      [id, (req as any).user.id]
    )

    await audit(req, 'ADMIN_ARCHIVE_CASE', 'case', Number(id))
    res.json({ success: true, message: 'Case archived.' })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Dashboard Stats ────────────────────────────────────────
export const getDashboardStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    // User stats
    const [roleCounts] = await pool.query<RowDataPacket[]>(
      `SELECT role, COUNT(*) AS cnt FROM users GROUP BY role`
    )
    const [statusCounts] = await pool.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) AS cnt FROM users GROUP BY status`
    )
    const [[activeUsers]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM users WHERE last_login > DATE_SUB(NOW(), INTERVAL 7 DAY)`
    )
    const [[pendingVerifications]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM users WHERE ibp_verified = 0 AND role IN ('attorney','client') AND status != 'suspended'`
    )

    // Case stats
    const [caseCounts] = await pool.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) AS cnt FROM cases WHERE deleted_at IS NULL GROUP BY status`
    )
    const [[totalCases]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM cases WHERE deleted_at IS NULL`
    )

    // Recent activity
    const [recentActivity] = await pool.query<RowDataPacket[]>(
      `SELECT al.action, al.target_type, al.details, al.created_at,
              u.fullname AS user_name, u.role AS user_role
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC LIMIT 50`
    )

    // Login stats (last 24h)
    const [[loginStats]] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS total_attempts,
         SUM(success = 1) AS successful,
         SUM(success = 0) AS failed
       FROM login_attempts
       WHERE attempted_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    )

    res.json({
      success: true,
      data: {
        users: {
          by_role: roleCounts,
          by_status: statusCounts,
          active_last_7_days: activeUsers.cnt,
          pending_verifications: pendingVerifications.cnt
        },
        cases: {
          by_status: caseCounts,
          total: totalCases.cnt
        },
        recent_activity: recentActivity,
        login_stats_24h: loginStats
      }
    })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Reports: User Statistics ───────────────────────────────
export const getUserReport = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [registrations] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(created_at) AS date, role, COUNT(*) AS cnt
       FROM users
       WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(created_at), role
       ORDER BY date ASC`
    )

    const [logins] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(attempted_at) AS date, SUM(success=1) AS successful, SUM(success=0) AS failed
       FROM login_attempts
       WHERE attempted_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(attempted_at)
       ORDER BY date ASC`
    )

    const [topActive] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.fullname, u.role, COUNT(al.id) AS action_count
       FROM users u
       JOIN audit_log al ON al.user_id = u.id
       WHERE al.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY u.id
       ORDER BY action_count DESC LIMIT 10`
    )

    res.json({ success: true, data: { registrations, logins, top_active_users: topActive } })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Reports: Case Statistics ───────────────────────────────
export const getCaseReport = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [casesByMonth] = await pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS cnt
       FROM cases WHERE deleted_at IS NULL
       GROUP BY month ORDER BY month DESC LIMIT 12`
    )

    const [casesByType] = await pool.query<RowDataPacket[]>(
      `SELECT case_type, COUNT(*) AS cnt
       FROM cases WHERE deleted_at IS NULL
       GROUP BY case_type ORDER BY cnt DESC`
    )

    const [workload] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.fullname,
              COUNT(c.id) AS total_cases,
              SUM(c.status = 'active') AS active,
              SUM(c.status = 'closed') AS closed
       FROM users u
       LEFT JOIN cases c ON c.attorney_id = u.id AND c.deleted_at IS NULL
       WHERE u.role = 'attorney' AND u.status = 'active'
       GROUP BY u.id
       ORDER BY total_cases DESC`
    )

    res.json({ success: true, data: { cases_by_month: casesByMonth, cases_by_type: casesByType, attorney_workload: workload } })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Suspension History for a User ──────────────────────────
export const getSuspensionHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT us.*, su.fullname AS suspended_by_name, lu.fullname AS lifted_by_name
       FROM user_suspensions us
       LEFT JOIN users su ON su.id = us.suspended_by
       LEFT JOIN users lu ON lu.id = us.lifted_by
       WHERE us.user_id = ?
       ORDER BY us.suspended_at DESC`,
      [id]
    )

    res.json({ success: true, data: rows })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── Login Attempts for a User ──────────────────────────────
export const getUserLoginAttempts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const [[user]] = await pool.query<RowDataPacket[]>(
      'SELECT email FROM users WHERE id = ?', [id]
    )
    if (!user) { res.status(404).json({ success: false, message: 'User not found.' }); return }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ip_address, success, attempted_at
       FROM login_attempts WHERE email = ?
       ORDER BY attempted_at DESC LIMIT 50`,
      [user.email]
    )

    res.json({ success: true, data: rows })
  } catch (err: any) {
    console.error('[admin]', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
