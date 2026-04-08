import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import crypto from 'crypto'
import pool from '../config/db'
import { audit } from '../utils/audit'

// ─── Trigger survey when a case is closed ─────────────────────────
// Called internally from caseController after status change to 'closed'.
export async function triggerSurveyForCase(caseId: number, clientId: number, outcome: string | null, req: any): Promise<void> {
  try {
    // Only send once per case+client
    const [[existing]] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM client_surveys WHERE case_id = ? AND client_id = ?',
      [caseId, clientId]
    )
    if (existing) return

    const token = crypto.randomBytes(32).toString('hex')
    await pool.query<ResultSetHeader>(
      `INSERT INTO client_surveys (case_id, client_id, token, sent_at, outcome)
       VALUES (?, ?, ?, NOW(), ?)`,
      [caseId, clientId, token, outcome ?? null]
    )
    await audit(req, 'SURVEY_SENT', 'case', caseId, `token=${token}`)
  } catch (_e) {
    // Non-critical — don't fail the case update
  }
}

// ─── GET /api/survey/:token ─────── (public, no auth required) ────
export const getSurveyByToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params
    const [[row]] = await pool.query<RowDataPacket[]>(
      `SELECT cs.*, c.case_number, c.title AS case_title,
              u.fullname AS client_name
       FROM client_surveys cs
       JOIN cases c ON c.id = cs.case_id
       JOIN users u ON u.id = cs.client_id
       WHERE cs.token = ?`,
      [token]
    )
    if (!row) { res.status(404).json({ success: false, message: 'Survey not found.' }); return }
    if (row.responded_at) { res.status(410).json({ success: false, message: 'Survey already completed.' }); return }

    res.json({ success: true, data: row })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/survey/:token ─────── (public, no auth required) ───
export const submitSurvey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params
    const { nps_score, satisfaction_rating, communication_rating, outcome_rating, comments } = req.body

    if (nps_score === undefined || satisfaction_rating === undefined || communication_rating === undefined) {
      res.status(400).json({ success: false, message: 'nps_score, satisfaction_rating, and communication_rating are required.' })
      return
    }

    const [[row]] = await pool.query<RowDataPacket[]>(
      'SELECT id, responded_at FROM client_surveys WHERE token = ?', [token]
    )
    if (!row) { res.status(404).json({ success: false, message: 'Survey not found.' }); return }
    if (row.responded_at) { res.status(410).json({ success: false, message: 'Already submitted.' }); return }

    await pool.query(
      `UPDATE client_surveys
       SET responded_at         = NOW(),
           nps_score            = ?,
           satisfaction_rating  = ?,
           communication_rating = ?,
           outcome_rating       = ?,
           comments             = ?
       WHERE token = ?`,
      [
        Math.min(10, Math.max(0, Number(nps_score))),
        Math.min(5,  Math.max(1, Number(satisfaction_rating))),
        Math.min(5,  Math.max(1, Number(communication_rating))),
        outcome_rating ? Math.min(5, Math.max(1, Number(outcome_rating))) : null,
        comments?.trim() || null,
        token,
      ]
    )
    res.json({ success: true, message: 'Thank you for your feedback!' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/admin/surveys ─────── (admin view) ──────────────────
export const listSurveysAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT cs.*,
              c.case_number, c.title AS case_title, c.attorney_id,
              u_client.fullname AS client_name,
              u_atty.fullname   AS attorney_name
       FROM client_surveys cs
       JOIN cases c          ON c.id = cs.case_id
       JOIN users u_client   ON u_client.id = cs.client_id
       JOIN users u_atty     ON u_atty.id   = c.attorney_id
       ORDER BY cs.responded_at DESC, cs.sent_at DESC
       LIMIT 200`
    )
    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/surveys ─────── (attorney — their own clients only) ─
export const listSurveysAttorney = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT cs.*,
              c.case_number, c.title AS case_title,
              u_client.fullname AS client_name
       FROM client_surveys cs
       JOIN cases c        ON c.id = cs.case_id
       JOIN users u_client ON u_client.id = cs.client_id
       WHERE c.attorney_id = ?
       ORDER BY cs.responded_at DESC, cs.sent_at DESC`,
      [user.id]
    )
    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
