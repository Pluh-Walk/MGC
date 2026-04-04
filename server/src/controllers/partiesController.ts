import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'
import { getEffectiveAttorneyId } from '../utils/scope'
import { audit } from '../utils/audit'

// ─── List Parties for a Case ────────────────────────────────
export const getParties = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params

    // Verify access
    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    const [caseRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, client_id, attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`,
      [caseId]
    )
    if (!caseRows.length) {
      res.status(404).json({ success: false, message: 'Case not found.' })
      return
    }
    const c = caseRows[0]
    if (user.role === 'client' && c.client_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }
    if ((user.role === 'attorney' || user.role === 'secretary') && effectiveAttorneyId !== c.attorney_id) {
      res.status(403).json({ success: false, message: 'Access denied.' })
      return
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.*, u.fullname AS created_by_name
       FROM case_parties p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.case_id = ?
       ORDER BY p.created_at ASC`,
      [caseId]
    )

    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Add Party ───────────────────────────────────────────────
export const addParty = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params
    const { party_type, fullname, email, phone, address, organization, notes } = req.body

    if (!fullname || !party_type) {
      res.status(400).json({ success: false, message: 'fullname and party_type are required.' })
      return
    }

    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    const [caseRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, attorney_id FROM cases WHERE id = ? AND attorney_id = ? AND deleted_at IS NULL`,
      [caseId, effectiveAttorneyId]
    )
    if (!caseRows.length) {
      res.status(403).json({ success: false, message: 'Case not found or access denied.' })
      return
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO case_parties (case_id, party_type, fullname, email, phone, address, organization, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [caseId, party_type, fullname, email || null, phone || null, address || null, organization || null, notes || null, user.id]
    )

    await audit(req, 'PARTY_ADDED', 'case', Number(caseId), `Party: ${fullname} (${party_type})`)

    res.status(201).json({ success: true, message: 'Party added.', partyId: result.insertId })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Update Party ────────────────────────────────────────────
export const updateParty = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId, partyId } = req.params
    const { party_type, fullname, email, phone, address, organization, notes } = req.body

    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.id FROM case_parties p
       JOIN cases c ON c.id = p.case_id
       WHERE p.id = ? AND p.case_id = ? AND c.attorney_id = ? AND c.deleted_at IS NULL`,
      [partyId, caseId, effectiveAttorneyId]
    )
    if (!rows.length) {
      res.status(403).json({ success: false, message: 'Party not found or access denied.' })
      return
    }

    await pool.query(
      `UPDATE case_parties SET party_type=COALESCE(?,party_type), fullname=COALESCE(?,fullname),
              email=COALESCE(?,email), phone=COALESCE(?,phone), address=COALESCE(?,address),
              organization=COALESCE(?,organization), notes=COALESCE(?,notes)
       WHERE id = ?`,
      [party_type, fullname, email, phone, address, organization, notes, partyId]
    )

    await audit(req, 'PARTY_UPDATED', 'case', Number(caseId))
    res.json({ success: true, message: 'Party updated.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Delete Party ────────────────────────────────────────────
export const deleteParty = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId, partyId } = req.params

    const effectiveAttorneyId = getEffectiveAttorneyId(user)
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.id FROM case_parties p
       JOIN cases c ON c.id = p.case_id
       WHERE p.id = ? AND p.case_id = ? AND c.attorney_id = ? AND c.deleted_at IS NULL`,
      [partyId, caseId, effectiveAttorneyId]
    )
    if (!rows.length) {
      res.status(403).json({ success: false, message: 'Party not found or access denied.' })
      return
    }

    await pool.query(`DELETE FROM case_parties WHERE id = ?`, [partyId])
    await audit(req, 'PARTY_DELETED', 'case', Number(caseId))
    res.json({ success: true, message: 'Party removed.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
