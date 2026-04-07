import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import fs from 'fs'
import pool from '../config/db'
import { getEffectiveAttorneyId } from '../utils/scope'
import { audit } from '../utils/audit'
import { scanWithClamav, verifyMagicBytes } from '../config/upload'

// ─── Helper: verify case access ────────────────────────────────────
async function getCase(caseId: string | number, user: any) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, client_id, attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`,
    [caseId]
  )
  return rows[0] ?? null
}

function canAccess(c: RowDataPacket, user: any): boolean {
  const eid = getEffectiveAttorneyId(user)
  if (user.role === 'admin') return true
  if (user.role === 'client') return c.client_id === user.id
  return eid === c.attorney_id  // attorney / secretary
}

// ─── GET /api/cases/:caseId/billing ────────────────────────────────
export const getBillingEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params

    const c = await getCase(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    if (!canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    // Clients see a summary only (no rates)
    if (user.role === 'client') {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, entry_type, description, amount, billing_date, is_billed, is_paid, invoice_number
         FROM case_billing WHERE case_id = ? ORDER BY billing_date DESC`,
        [caseId]
      )
      const total = (rows as RowDataPacket[]).reduce((s, r) => s + Number(r.amount), 0)
      res.json({ success: true, data: rows, total })
      return
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT cb.*, u.fullname
       FROM case_billing cb
       JOIN users u ON u.id = cb.attorney_id
       WHERE cb.case_id = ?
       ORDER BY cb.billing_date DESC, cb.id DESC`,
      [caseId]
    )
    const total = (rows as RowDataPacket[]).reduce((s, r) => s + Number(r.amount), 0)
    res.json({ success: true, data: rows, total })
  } catch (err) {
    console.error('getBillingEntries:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── POST /api/cases/:caseId/billing ───────────────────────────────
export const addBillingEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params

    if (user.role === 'client') { res.status(403).json({ success: false, message: 'Clients cannot add billing entries.' }); return }

    const c = await getCase(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    if (!canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    const { entry_type, description, hours, rate, amount, billing_date, is_billed, invoice_number, notes } = req.body

    if (!description || amount == null) {
      res.status(400).json({ success: false, message: 'description and amount are required.' })
      return
    }

    const attorneyId = getEffectiveAttorneyId(user) ?? user.id

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO case_billing
         (case_id, attorney_id, entry_type, description, hours, rate, amount, billing_date, is_billed, invoice_number, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId, attorneyId,
        entry_type ?? 'flat_fee',
        description,
        hours ?? null, rate ?? null,
        amount,
        billing_date ?? new Date().toISOString().slice(0, 10),
        is_billed ? 1 : 0,
        invoice_number ?? null,
        notes ?? null
      ]
    )

    await audit(req, 'BILLING_CREATED', 'billing', result.insertId, `case ${caseId}: ${description} ₱${amount}`)
    res.status(201).json({ success: true, id: result.insertId })
  } catch (err) {
    console.error('addBillingEntry:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── PATCH /api/cases/:caseId/billing/:entryId ─────────────────────
export const updateBillingEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId, entryId } = req.params

    if (user.role === 'client') { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    const c = await getCase(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    if (!canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    const { entry_type, description, hours, rate, amount, billing_date, is_billed, is_paid, paid_at, invoice_number, notes } = req.body

    await pool.query(
      `UPDATE case_billing SET
         entry_type = COALESCE(?, entry_type),
         description = COALESCE(?, description),
         hours = COALESCE(?, hours),
         rate = COALESCE(?, rate),
         amount = COALESCE(?, amount),
         billing_date = COALESCE(?, billing_date),
         is_billed = COALESCE(?, is_billed),
         is_paid = COALESCE(?, is_paid),
         paid_at = COALESCE(?, paid_at),
         invoice_number = COALESCE(?, invoice_number),
         notes = COALESCE(?, notes)
       WHERE id = ? AND case_id = ?`,
      [entry_type, description, hours, rate, amount, billing_date,
       is_billed != null ? (is_billed ? 1 : 0) : null,
       is_paid != null ? (is_paid ? 1 : 0) : null,
       paid_at ?? null, invoice_number, notes,
       entryId, caseId]
    )

    await audit(req, 'BILLING_UPDATED', 'billing', parseInt(entryId), `case ${caseId}`)
    res.json({ success: true })
  } catch (err) {
    console.error('updateBillingEntry:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── GET /api/cases/:caseId/billing/retainer ───────────────────────
export const getRetainerSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params

    const c = await getCase(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    if (!canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    // Fetch retainer_amount from cases table
    const [caseRows] = await pool.query<RowDataPacket[]>(
      `SELECT retainer_amount FROM cases WHERE id = ?`, [caseId]
    )
    const retainerAmount = Number(caseRows[0]?.retainer_amount ?? 0)

    // All retainer_deduction entries
    const [deductions] = await pool.query<RowDataPacket[]>(
      `SELECT cb.id, cb.description, cb.amount, cb.billing_date, cb.invoice_number, cb.notes,
              cb.is_paid, u.fullname AS recorded_by
       FROM case_billing cb
       LEFT JOIN users u ON u.id = cb.attorney_id
       WHERE cb.case_id = ? AND cb.entry_type = 'retainer_deduction'
       ORDER BY cb.billing_date ASC, cb.id ASC`,
      [caseId]
    )

    const totalDeducted = (deductions as RowDataPacket[]).reduce((s, r) => s + Number(r.amount), 0)
    const remaining = retainerAmount - totalDeducted

    res.json({
      success: true,
      data: {
        retainer_amount: retainerAmount,
        total_deducted: totalDeducted,
        remaining_balance: remaining,
        entries: deductions
      }
    })
  } catch (err) {
    console.error('getRetainerSummary:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── GET /api/cases/:caseId/billing/retainer/statement ─────────────
export const exportRetainerStatement = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params

    const c = await getCase(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    if (!canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    const [caseRows] = await pool.query<RowDataPacket[]>(
      `SELECT title, case_number, retainer_amount FROM cases WHERE id = ?`, [caseId]
    )
    const caseInfo = caseRows[0]
    const retainerAmount = Number(caseInfo?.retainer_amount ?? 0)

    const [deductions] = await pool.query<RowDataPacket[]>(
      `SELECT cb.billing_date, cb.description, cb.amount, cb.invoice_number, cb.notes, u.fullname AS recorded_by
       FROM case_billing cb
       LEFT JOIN users u ON u.id = cb.attorney_id
       WHERE cb.case_id = ? AND cb.entry_type = 'retainer_deduction'
       ORDER BY cb.billing_date ASC, cb.id ASC`,
      [caseId]
    )

    const rows = deductions as RowDataPacket[]
    let totalDeducted = 0

    const escCsv = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines: string[] = [
      `Retainer Statement`,
      `Case: ${escCsv((caseInfo?.case_number ?? '') + ' – ' + (caseInfo?.title ?? ''))}`,
      `Starting Retainer: ₱${retainerAmount.toFixed(2)}`,
      ``,
      `Date,Description,Amount,Invoice #,Notes,Recorded By,Running Balance`
    ]

    let balance = retainerAmount
    for (const r of rows) {
      const amt = Number(r.amount)
      totalDeducted += amt
      balance -= amt
      lines.push([
        escCsv(r.billing_date ? new Date(r.billing_date).toLocaleDateString('en-PH') : ''),
        escCsv(r.description),
        escCsv(amt.toFixed(2)),
        escCsv(r.invoice_number ?? ''),
        escCsv(r.notes ?? ''),
        escCsv(r.recorded_by ?? ''),
        escCsv(balance.toFixed(2))
      ].join(','))
    }

    lines.push(``)
    lines.push(`Total Deducted: ₱${totalDeducted.toFixed(2)}`)
    lines.push(`Remaining Balance: ₱${(retainerAmount - totalDeducted).toFixed(2)}`)

    const csv = lines.join('\r\n')
    const filename = `retainer-statement-case-${caseId}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csv)
  } catch (err) {
    console.error('exportRetainerStatement:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── DELETE /api/cases/:caseId/billing/:entryId ────────────────────
export const deleteBillingEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId, entryId } = req.params

    if (user.role === 'client') { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    const c = await getCase(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    if (!canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    await pool.query(`DELETE FROM case_billing WHERE id = ? AND case_id = ?`, [entryId, caseId])
    await audit(req, 'BILLING_DELETED', 'billing', parseInt(entryId), `case ${caseId}`)
    res.json({ success: true })
  } catch (err) {
    console.error('deleteBillingEntry:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── PUT /api/cases/:caseId/billing/:entryId/receipt ───────────────
export const uploadExpenseReceipt = async (req: Request, res: Response): Promise<void> => {
  const file = (req as any).file as Express.Multer.File | undefined
  try {
    const user = (req as any).user
    const { caseId, entryId } = req.params

    if (user.role === 'client') { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    const c = await getCase(caseId, user)
    if (!c) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    if (!canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    if (!file) { res.status(400).json({ success: false, message: 'No file uploaded.' }); return }

    const valid = await verifyMagicBytes(file.path, file.mimetype)
    if (!valid) {
      fs.unlinkSync(file.path)
      res.status(400).json({ success: false, message: 'File type mismatch detected.' })
      return
    }

    await scanWithClamav(file.path).catch((e: Error) => {
      fs.unlinkSync(file.path)
      throw e
    })

    const relPath = `receipts/${file.filename}`

    await pool.query(
      `UPDATE case_billing SET receipt_path = ? WHERE id = ? AND case_id = ?`,
      [relPath, entryId, caseId]
    )

    await audit(req, 'RECEIPT_UPLOADED', 'billing', parseInt(entryId), `case ${caseId}: ${file.originalname}`)
    res.json({ success: true, receipt_path: relPath })
  } catch (err: any) {
    if (file?.path) { try { fs.unlinkSync(file.path) } catch {} }
    if (err?.message === 'VIRUS_FOUND') {
      res.status(400).json({ success: false, message: 'File rejected: virus detected.' })
      return
    }
    console.error('uploadExpenseReceipt:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
