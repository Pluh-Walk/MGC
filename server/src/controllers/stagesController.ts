/**
 * Case Stage Workflow Controller (§4.6)
 *
 * Endpoints:
 *   GET  /api/cases/:caseId/stages                   — get stages for a case
 *   POST /api/cases/:caseId/stages/init              — initialise stages from template for case_type
 *   PUT  /api/cases/:caseId/stages/:stageId/advance  — mark a stage complete, auto-advance current
 *   PUT  /api/cases/:caseId/stages/:stageId          — update stage name/notes
 *   GET  /api/cases/stages/templates                 — list available stage templates by case_type
 */
import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { getEffectiveAttorneyId } from '../utils/scope'
import { audit } from '../utils/audit'
import { notify } from '../utils/notify'

async function verifyAccess(caseId: string, user: any): Promise<RowDataPacket | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, attorney_id, case_type, title, client_id FROM cases WHERE id = ? AND deleted_at IS NULL`,
    [caseId]
  )
  if (!rows.length) return null
  const c = rows[0]
  if (user.role === 'admin') return c
  const eid = getEffectiveAttorneyId(user)
  if ((user.role === 'attorney' || user.role === 'secretary') && eid === c.attorney_id) return c
  // Clients can read their own case stages
  if (user.role === 'client') {
    const [[cl]] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM cases WHERE id = ? AND client_id = ? AND deleted_at IS NULL`, [caseId, user.id]
    )
    return cl ?? null
  }
  return null
}

// ─── GET /api/cases/stages/templates ──────────────────────────────
export const getStageTemplates = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT case_type, stage_name, stage_order FROM stage_templates ORDER BY case_type, stage_order`
    )
    // Group by case_type
    const map: Record<string, string[]> = {}
    for (const r of rows) {
      if (!map[r.case_type]) map[r.case_type] = []
      map[r.case_type].push(r.stage_name)
    }
    res.json({ success: true, data: map })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/cases/:caseId/stages ────────────────────────────────
export const getCaseStages = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params
    const c = await verifyAccess(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found or access denied.' }); return }

    const [stages] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, u.fullname AS completed_by_name
       FROM case_stages s
       LEFT JOIN users u ON u.id = s.completed_by
       WHERE s.case_id = ? ORDER BY s.stage_order`,
      [caseId]
    )
    res.json({ success: true, data: stages })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/cases/:caseId/stages/init ──────────────────────────
export const initCaseStages = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params
    const c = await verifyAccess(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found or access denied.' }); return }
    if (user.role === 'client') { res.status(403).json({ success: false, message: 'Forbidden.' }); return }

    // Only initialise if no stages exist yet
    const [[existing]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM case_stages WHERE case_id = ?`, [caseId]
    )
    if (existing.cnt > 0) {
      res.status(409).json({ success: false, message: 'Stages already initialised for this case.' })
      return
    }

    const { case_type } = req.body
    const normalised = (case_type || c.case_type || '').toLowerCase()

    // For civil cases, select the appropriate sub-type template when available.
    // civil_ejectment  → Rule on Summary Procedure (no discovery)
    // civil_family     → Family Courts Rules (annulment, legal_separation, support, adoption)
    // civil            → standard 9-stage civil workflow (all other sub-types)
    const FAMILY_SUBTYPES = new Set(['annulment', 'legal_separation', 'support', 'adoption'])
    let templateKey = normalised
    if (normalised === 'civil') {
      const [[intake]] = await pool.query<RowDataPacket[]>(
        `SELECT civil_case_type FROM case_intake_requests WHERE converted_case_id = ? LIMIT 1`,
        [caseId]
      )
      const subType: string = intake?.civil_case_type ?? ''
      if (subType === 'ejectment') {
        templateKey = 'civil_ejectment'
      } else if (FAMILY_SUBTYPES.has(subType)) {
        templateKey = 'civil_family'
      }
    }

    // Fetch template stages; fall back to base case_type if no sub-type template found
    let [templates] = await pool.query<RowDataPacket[]>(
      `SELECT stage_name, stage_order FROM stage_templates WHERE case_type = ? ORDER BY stage_order`,
      [templateKey]
    )
    if (!templates.length && templateKey !== normalised) {
      ;[templates] = await pool.query<RowDataPacket[]>(
        `SELECT stage_name, stage_order FROM stage_templates WHERE case_type = ? ORDER BY stage_order`,
        [normalised]
      )
    }

    if (!templates.length) {
      res.status(422).json({ success: false, message: `No stage template found for case type "${normalised}".` })
      return
    }

    // Insert all stages; mark stage_order=1 as current
    await pool.query(
      `INSERT INTO case_stages (case_id, stage_name, stage_order, is_current) VALUES ?`,
      [templates.map((t, i) => [caseId, t.stage_name, t.stage_order, i === 0 ? 1 : 0])]
    )

    const [stages] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM case_stages WHERE case_id = ? ORDER BY stage_order`, [caseId]
    )
    await audit(req, 'STAGE_INIT', 'case', Number(caseId), `Initialised ${stages.length} stages (${templateKey})`)
    res.status(201).json({ success: true, data: stages })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PUT /api/cases/:caseId/stages/:stageId/advance ───────────────
export const advanceCaseStage = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId, stageId } = req.params
    const c = await verifyAccess(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found or access denied.' }); return }
    if (user.role === 'client') { res.status(403).json({ success: false, message: 'Forbidden.' }); return }

    // Fetch the stage to advance
    const [[stage]] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM case_stages WHERE id = ? AND case_id = ?`, [stageId, caseId]
    )
    if (!stage) { res.status(404).json({ success: false, message: 'Stage not found.' }); return }
    if (stage.completed) { res.status(409).json({ success: false, message: 'Stage already completed.' }); return }

    const { notes } = req.body

    // Mark current stage complete
    await pool.query(
      `UPDATE case_stages SET completed = 1, completed_at = NOW(), completed_by = ?, is_current = 0,
              notes = COALESCE(?, notes)
       WHERE id = ?`,
      [user.id, notes || null, stageId]
    )

    // Find next stage
    const [[nextStage]] = await pool.query<RowDataPacket[]>(
      `SELECT id, stage_name FROM case_stages
       WHERE case_id = ? AND stage_order > ? AND completed = 0 ORDER BY stage_order ASC LIMIT 1`,
      [caseId, stage.stage_order]
    )
    if (nextStage) {
      await pool.query(`UPDATE case_stages SET is_current = 1 WHERE id = ?`, [nextStage.id])
    }

    // Notify client about stage advance
    await notify(c.client_id, 'case_update',
      `Case stage updated: "${stage.stage_name}" completed${nextStage ? `. Now at: "${nextStage.stage_name}"` : ' — case workflow complete'}`,
      Number(caseId)
    )

    await audit(req, 'STAGE_ADVANCED', 'case', Number(caseId), `"${stage.stage_name}" → ${nextStage?.stage_name ?? 'complete'}`)

    const [stages] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, u.fullname AS completed_by_name FROM case_stages s LEFT JOIN users u ON u.id = s.completed_by
       WHERE s.case_id = ? ORDER BY s.stage_order`,
      [caseId]
    )
    res.json({ success: true, data: stages })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PUT /api/cases/:caseId/stages/:stageId ───────────────────────
export const updateCaseStage = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId, stageId } = req.params
    const c = await verifyAccess(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found or access denied.' }); return }
    if (user.role === 'client') { res.status(403).json({ success: false, message: 'Forbidden.' }); return }

    const { stage_name, notes } = req.body
    if (!stage_name?.trim() && notes === undefined) {
      res.status(400).json({ success: false, message: 'Nothing to update.' }); return
    }

    const sets: string[] = []
    const vals: any[] = []
    if (stage_name?.trim()) { sets.push('stage_name = ?'); vals.push(stage_name.trim()) }
    if (notes !== undefined) { sets.push('notes = ?'); vals.push(notes) }
    vals.push(stageId, caseId)

    await pool.query(`UPDATE case_stages SET ${sets.join(', ')} WHERE id = ? AND case_id = ?`, vals)
    res.json({ success: true, message: 'Stage updated.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
