/**
 * Conflict of Interest Controller
 *
 * GET  /api/cases/conflict-check?client_id=&opposing_party=  — pre-creation check
 * POST /api/cases/:caseId/conflict-check/acknowledge          — log acknowledgment
 */
import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { audit } from '../utils/audit'
import { getEffectiveAttorneyId } from '../utils/scope'

interface Conflict {
  type:          string
  description:   string
  matched_case?: string
  matched_user?: string
}

export async function checkConflicts(
  clientId: number,
  opposingParty: string | null | undefined,
  attorneyId:    number,
): Promise<Conflict[]> {
  const conflicts: Conflict[] = []

  // 1. Is the proposed client an opposing party in any existing active case?
  const [clientOpposing] = await pool.query<RowDataPacket[]>(
    `SELECT u.fullname, c.case_number, c.title
     FROM cases c
     JOIN users u ON u.id = ?
     WHERE c.attorney_id = ?
       AND c.deleted_at IS NULL
       AND c.status NOT IN ('closed', 'archived', 'draft')
       AND c.opposing_party IS NOT NULL
       AND c.opposing_party != ''
       AND u.fullname LIKE CONCAT('%', SUBSTRING_INDEX(u.fullname, ' ', 1), '%')
     LIMIT 5`,
    [clientId, attorneyId]
  )
  // More accurate: check by fullname pattern
  const [[clientUser]] = await pool.query<RowDataPacket[]>(
    'SELECT fullname FROM users WHERE id = ?', [clientId]
  )
  if (clientUser) {
    const clientName = clientUser.fullname
    const [asOpposing] = await pool.query<RowDataPacket[]>(
      `SELECT c.case_number, c.title, c.opposing_party
       FROM cases c
       WHERE c.attorney_id = ?
         AND c.deleted_at IS NULL
         AND c.status NOT IN ('closed', 'archived', 'draft')
         AND c.opposing_party LIKE ?
       LIMIT 5`,
      [attorneyId, `%${clientName}%`]
    )
    for (const row of asOpposing as RowDataPacket[]) {
      conflicts.push({
        type:        'client_is_opposing',
        description: `The proposed client "${clientName}" appears as an opposing party in case ${row.case_number} ("${row.title}").`,
        matched_case: row.case_number,
      })
    }
  }

  // 2. Is the opposing party already a registered client with this attorney?
  if (opposingParty) {
    const [opposingAsClient] = await pool.query<RowDataPacket[]>(
      `SELECT u.fullname, u.email, c.case_number, c.title
       FROM users u
       JOIN cases c ON c.client_id = u.id
       WHERE u.role = 'client'
         AND c.attorney_id = ?
         AND c.deleted_at IS NULL
         AND c.status NOT IN ('closed', 'archived', 'draft')
         AND u.fullname LIKE ?
       LIMIT 5`,
      [attorneyId, `%${opposingParty}%`]
    )
    for (const row of opposingAsClient as RowDataPacket[]) {
      conflicts.push({
        type:        'opposing_is_client',
        description: `Opposing party "${opposingParty}" matches existing client "${row.fullname}" in your case ${row.case_number} ("${row.title}").`,
        matched_case: row.case_number,
        matched_user: row.fullname,
      })
    }

    // 3. Is the opposing party a registered user (any attorney's client) in the system?
    const [opposingInSystem] = await pool.query<RowDataPacket[]>(
      `SELECT u.fullname, u.email
       FROM users u
       WHERE u.role = 'client'
         AND u.fullname LIKE ?
         AND u.id != ?
       LIMIT 5`,
      [`%${opposingParty}%`, clientId]
    )
    for (const row of opposingInSystem as RowDataPacket[]) {
      conflicts.push({
        type:        'opposing_registered',
        description: `Opposing party "${opposingParty}" may match registered client "${row.fullname}" (${row.email}) in the system.`,
        matched_user: row.fullname,
      })
    }
  }

  return conflicts
}

// GET /api/cases/conflict-check
export const runConflictCheck = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  if (!['attorney', 'secretary', 'admin'].includes(user.role)) {
    res.status(403).json({ success: false, message: 'Access denied.' })
    return
  }

  const clientId     = Number(req.query.client_id)
  const opposingParty = typeof req.query.opposing_party === 'string' ? req.query.opposing_party.trim() : null
  const attorneyId   = getEffectiveAttorneyId(user) ?? user.id

  if (!Number.isFinite(clientId)) {
    res.status(400).json({ success: false, message: 'client_id is required.' })
    return
  }

  const conflicts = await checkConflicts(clientId, opposingParty, attorneyId)

  res.json({
    success:   true,
    hasConflict: conflicts.length > 0,
    conflicts,
  })
}

// POST /api/cases/:caseId/conflict-check/acknowledge
export const acknowledgeConflict = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  const caseId = Number(req.params.caseId)

  const [[caseRow]] = await pool.query<RowDataPacket[]>(
    'SELECT id, client_id, attorney_id, opposing_party FROM cases WHERE id = ? AND deleted_at IS NULL',
    [caseId]
  )
  if (!caseRow) { res.status(404).json({ success: false, message: 'Case not found.' }); return }

  const attorneyId = getEffectiveAttorneyId(user) ?? user.id
  if (caseRow.attorney_id !== attorneyId && user.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Access denied.' })
    return
  }

  const conflicts = await checkConflicts(caseRow.client_id, caseRow.opposing_party, caseRow.attorney_id)

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO conflict_checks (case_id, checked_by, client_id, opposing_party, conflicts_found, acknowledged_at)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE acknowledged_at = NOW(), conflicts_found = VALUES(conflicts_found)`,
    [caseId, user.id, caseRow.client_id, caseRow.opposing_party || null, JSON.stringify(conflicts)]
  )

  await audit(req, 'CONFLICT_ACKNOWLEDGED', 'case', caseId,
    `Conflict check acknowledged for case ${caseId}. Conflicts found: ${conflicts.length}`)

  res.json({ success: true, acknowledged: true, conflicts })
}
