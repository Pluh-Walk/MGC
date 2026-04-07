/**
 * Invoice Controller
 *
 * Routes:
 *   POST /api/cases/:caseId/invoices              — generate invoice from billing entries
 *   GET  /api/cases/:caseId/invoices              — list invoices for a case
 *   GET  /api/cases/:caseId/invoices/:invoiceId   — get invoice detail
 *   GET  /api/cases/:caseId/invoices/:invoiceId/pdf — download PDF
 *   POST /api/cases/:caseId/invoices/:invoiceId/send — mark as sent + notify client
 *   POST /api/cases/:caseId/invoices/:invoiceId/pay  — mark as paid (manual)
 *   PUT  /api/cases/:caseId/invoices/:invoiceId/void — void invoice
 */
import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'
import pool from '../config/db'
import { audit } from '../utils/audit'
import { getEffectiveAttorneyId } from '../utils/scope'
import { notify } from '../utils/notify'
import { sendMail } from '../config/mailer'
import logger from '../config/logger'

// ── Helpers ────────────────────────────────────────────────────────

async function getCase(caseId: number, user: any) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, case_number, title, client_id, attorney_id FROM cases WHERE id = ? AND deleted_at IS NULL`,
    [caseId]
  )
  return rows[0] ?? null
}

function canAccess(c: RowDataPacket, user: any): boolean {
  const eid = getEffectiveAttorneyId(user)
  if (user.role === 'admin') return true
  if (user.role === 'client') return c.client_id === user.id
  return eid === c.attorney_id
}

/** Generate a human-readable invoice number: INV-YYYYMMDD-XXXXXXXX */
function genInvoiceNumber(): string {
  const d  = new Date()
  const dt = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rnd = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0')
  return `INV-${dt}-${rnd}`
}

/** Build a PDF invoice and write it to disk, returning the file path */
async function buildInvoicePdf(data: {
  invoiceNumber: string
  caseNumber:    string
  caseTitle:     string
  clientName:    string
  clientEmail:   string
  attorneyName:  string
  firmName:      string
  issueDate:     string
  dueDate:       string | null
  entries:       Array<{ description: string; entry_type: string; hours: number|null; rate: number|null; amount: number; billing_date: string }>
  subtotal:      number
  taxAmount:     number
  total:         number
  notes:         string | null
}): Promise<string> {
  const dir = path.join(process.cwd(), 'uploads', 'invoices')
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${data.invoiceNumber}.pdf`)

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    const PRIMARY = '#1a365d'
    const LIGHT   = '#e2e8f0'
    const W       = 495

    // ─ Header ─
    doc.rect(50, 50, W, 80).fill(PRIMARY)
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
       .text(data.firmName, 65, 65)
    doc.fontSize(10).font('Helvetica')
       .text('Legal Case Management System', 65, 92)
    doc.fillColor(PRIMARY).fontSize(18).font('Helvetica-Bold')
       .text('INVOICE', 400, 65, { align: 'right', width: 130 })
    doc.fillColor('#4a5568').fontSize(10).font('Helvetica')
       .text(data.invoiceNumber, 400, 90, { align: 'right', width: 130 })

    doc.moveDown(3)

    // ─ Bill To / Invoice Info ─
    const infoY = 155
    doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold').text('BILL TO', 50, infoY)
    doc.fillColor('#2d3748').fontSize(10).font('Helvetica')
       .text(data.clientName, 50, infoY + 14)
       .text(data.clientEmail, 50, infoY + 28)

    doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold').text('CASE', 300, infoY)
    doc.fillColor('#2d3748').fontSize(10).font('Helvetica')
       .text(data.caseNumber, 300, infoY + 14)
       .text(data.caseTitle.slice(0, 40), 300, infoY + 28)

    doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold').text('INVOICE DATE', 420, infoY)
    doc.fillColor('#2d3748').fontSize(10).font('Helvetica')
       .text(data.issueDate, 420, infoY + 14)
    if (data.dueDate) {
      doc.fillColor('#e53e3e').fontSize(9).font('Helvetica-Bold').text('DUE DATE', 420, infoY + 30)
      doc.fillColor('#e53e3e').fontSize(10).font('Helvetica').text(data.dueDate, 420, infoY + 44)
    }

    // ─ Billing Entries Table ─
    const tableTop = 235
    doc.rect(50, tableTop, W, 20).fill(PRIMARY)
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
       .text('DATE',        55,  tableTop + 6)
       .text('DESCRIPTION', 105, tableTop + 6)
       .text('TYPE',        295, tableTop + 6)
       .text('HRS',         365, tableTop + 6, { width: 30, align: 'right' })
       .text('RATE',        400, tableTop + 6, { width: 50, align: 'right' })
       .text('AMOUNT',      455, tableTop + 6, { width: 85, align: 'right' })

    let rowY = tableTop + 22
    data.entries.forEach((e, i) => {
      if (i % 2 === 0) doc.rect(50, rowY - 3, W, 18).fill(LIGHT)
      doc.fillColor('#2d3748').fontSize(9).font('Helvetica')
         .text(e.billing_date,             55,  rowY)
         .text(e.description.slice(0, 55), 105, rowY)
         .text(e.entry_type.replace('_', ' '), 295, rowY)
         .text(e.hours  ? String(e.hours)  : '—', 365, rowY, { width: 30, align: 'right' })
         .text(e.rate   ? `₱${Number(e.rate).toFixed(2)}`  : '—', 400, rowY, { width: 50, align: 'right' })
         .text(`₱${Number(e.amount).toFixed(2)}`, 455, rowY, { width: 85, align: 'right' })
      rowY += 18
    })

    // ─ Totals ─
    rowY += 10
    doc.moveTo(350, rowY).lineTo(545, rowY).stroke(LIGHT)
    rowY += 8
    doc.fillColor('#4a5568').fontSize(10).font('Helvetica')
       .text('Subtotal:',   350, rowY)
       .text(`₱${data.subtotal.toFixed(2)}`, 350, rowY, { width: 190, align: 'right' })
    rowY += 16
    if (data.taxAmount > 0) {
      doc.text('12% VAT:', 350, rowY)
         .text(`₱${data.taxAmount.toFixed(2)}`, 350, rowY, { width: 190, align: 'right' })
      rowY += 16
    }
    doc.rect(350, rowY, 195, 22).fill(PRIMARY)
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
       .text('TOTAL DUE:', 355, rowY + 5)
       .text(`₱${data.total.toFixed(2)}`, 355, rowY + 5, { width: 184, align: 'right' })

    // ─ Notes / Footer ─
    if (data.notes) {
      rowY += 40
      doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold').text('Notes:', 50, rowY)
      doc.fillColor('#4a5568').fontSize(9).font('Helvetica').text(data.notes, 50, rowY + 13, { width: W })
    }

    const footerY = doc.page.height - 60
    doc.rect(50, footerY, W, 1).fill(LIGHT)
    doc.fillColor('#718096').fontSize(8).font('Helvetica')
       .text(`Attorney: ${data.attorneyName}  •  Generated by MGC Law System  •  ${new Date().toLocaleString()}`,
             50, footerY + 8, { align: 'center', width: W })

    doc.end()
    stream.on('finish', () => resolve(filePath))
    stream.on('error',  reject)
  })
}

// ── Controllers ────────────────────────────────────────────────────

// POST /api/cases/:caseId/invoices
export const createInvoice = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  const caseId = Number(req.params.caseId)
  if (user.role === 'client') { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  const c = await getCase(caseId, user)
  if (!c) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
  if (!canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  const { entry_ids, due_date, notes, include_tax } = req.body
  if (!Array.isArray(entry_ids) || !entry_ids.length) {
    res.status(400).json({ success: false, message: 'entry_ids array is required.' })
    return
  }

  try {
    // Fetch billing entries
    const placeholders = entry_ids.map(() => '?').join(',')
    const [entries] = await pool.query<RowDataPacket[]>(
      `SELECT cb.*, u.fullname AS attorney_name
       FROM case_billing cb JOIN users u ON u.id = cb.attorney_id
       WHERE cb.id IN (${placeholders}) AND cb.case_id = ?`,
      [...entry_ids, caseId]
    )

    if (!entries.length) {
      res.status(400).json({ success: false, message: 'No valid billing entries found.' })
      return
    }

    // Fetch client + attorney info
    const [[client]] = await pool.query<RowDataPacket[]>(
      'SELECT fullname, email FROM users WHERE id = ?', [c.client_id]
    )
    const [[attorney]] = await pool.query<RowDataPacket[]>(
      'SELECT fullname FROM users WHERE id = ?', [c.attorney_id]
    )

    // Fetch firm name from settings
    const [[firmSetting]] = await pool.query<RowDataPacket[]>(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'firm_name' LIMIT 1`
    ).catch(() => [[{ setting_value: 'MGC Law Office' }]] as any)
    const firmName = firmSetting?.setting_value || 'MGC Law Office'

    const subtotal   = entries.reduce((s, e) => s + Number(e.amount), 0)
    const taxAmount  = include_tax ? +(subtotal * 0.12).toFixed(2) : 0
    const total      = +(subtotal + taxAmount).toFixed(2)
    const invNumber  = genInvoiceNumber()
    const issueDate  = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    const dueDateStr = due_date ? new Date(due_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : null

    // Generate PDF
    const pdfPath = await buildInvoicePdf({
      invoiceNumber: invNumber,
      caseNumber:    c.case_number,
      caseTitle:     c.title,
      clientName:    client?.fullname || 'Client',
      clientEmail:   client?.email   || '',
      attorneyName:  attorney?.fullname || 'Attorney',
      firmName,
      issueDate,
      dueDate:       dueDateStr,
      entries:       entries as any,
      subtotal,
      taxAmount,
      total,
      notes:         notes || null,
    })

    // Relative path for storage
    const relativePdfPath = path.relative(process.cwd(), pdfPath)

    // Save invoice record
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO invoices
         (invoice_number, case_id, attorney_id, client_id, entries_json, subtotal, tax_amount, total_amount,
          status, due_date, notes, pdf_path, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
      [invNumber, caseId, c.attorney_id, c.client_id,
       JSON.stringify(entry_ids), subtotal, taxAmount, total,
       due_date || null, notes || null, relativePdfPath,
       user.id]
    )

    // Mark billing entries as billed
    await pool.query(
      `UPDATE case_billing SET is_billed = 1, invoice_number = ? WHERE id IN (${placeholders})`,
      [invNumber, ...entry_ids]
    )

    await audit(req, 'CREATE', 'invoice', result.insertId, `Invoice ${invNumber} for case ${caseId} ₱${total}`)
    res.status(201).json({ success: true, id: result.insertId, invoice_number: invNumber, total })
  } catch (err: any) {
    logger.error('createInvoice error', { error: err.message })
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// GET /api/cases/:caseId/invoices
export const listInvoices = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  const caseId = Number(req.params.caseId)
  const c = await getCase(caseId, user)
  if (!c || !canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT i.*, u.fullname AS client_name
     FROM invoices i JOIN users u ON u.id = i.client_id
     WHERE i.case_id = ? ORDER BY i.created_at DESC`,
    [caseId]
  )
  res.json({ success: true, data: rows })
}

// GET /api/cases/:caseId/invoices/:invoiceId
export const getInvoice = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  const caseId = Number(req.params.caseId)
  const invoiceId = Number(req.params.invoiceId)
  const c = await getCase(caseId, user)
  if (!c || !canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  const [[inv]] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM invoices WHERE id = ? AND case_id = ?', [invoiceId, caseId]
  )
  if (!inv) { res.status(404).json({ success: false, message: 'Invoice not found.' }); return }

  // Fetch the billing entries included in this invoice
  const ids: number[] = JSON.parse(inv.entries_json) || []
  const [entries] = ids.length
    ? await pool.query<RowDataPacket[]>(`SELECT * FROM case_billing WHERE id IN (${ids.map(() => '?').join(',')})`, ids)
    : [[] as RowDataPacket[]]

  res.json({ success: true, data: inv, entries })
}

// GET /api/cases/:caseId/invoices/:invoiceId/pdf
export const downloadInvoicePdf = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  const caseId = Number(req.params.caseId)
  const invoiceId = Number(req.params.invoiceId)
  const c = await getCase(caseId, user)
  if (!c || !canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  const [[inv]] = await pool.query<RowDataPacket[]>(
    'SELECT invoice_number, pdf_path FROM invoices WHERE id = ? AND case_id = ?', [invoiceId, caseId]
  )
  if (!inv?.pdf_path) { res.status(404).json({ success: false, message: 'PDF not found.' }); return }

  const absPath = path.join(process.cwd(), inv.pdf_path)
  if (!fs.existsSync(absPath)) { res.status(404).json({ success: false, message: 'PDF file not found on disk.' }); return }

  await audit(req, 'DOWNLOAD', 'invoice', invoiceId, `Downloaded invoice ${inv.invoice_number}`)
  res.download(absPath, `${inv.invoice_number}.pdf`)
}

// POST /api/cases/:caseId/invoices/:invoiceId/send
export const sendInvoice = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  if (user.role === 'client') { res.status(403).json({ success: false, message: 'Access denied.' }); return }
  const caseId = Number(req.params.caseId)
  const invoiceId = Number(req.params.invoiceId)
  const c = await getCase(caseId, user)
  if (!c || !canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  const [[inv]] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM invoices WHERE id = ? AND case_id = ?', [invoiceId, caseId]
  )
  if (!inv) { res.status(404).json({ success: false, message: 'Invoice not found.' }); return }
  if (inv.status === 'void') { res.status(400).json({ success: false, message: 'Cannot send a voided invoice.' }); return }

  await pool.query(
    `UPDATE invoices SET status = 'sent', sent_at = NOW() WHERE id = ?`, [invoiceId]
  )

  await notify(c.client_id, 'invoice_sent',
    `Invoice ${inv.invoice_number} has been sent. Total: ₱${Number(inv.total_amount).toFixed(2)}`,
    caseId)

  await audit(req, 'SEND', 'invoice', invoiceId, `Sent invoice ${inv.invoice_number}`)
  res.json({ success: true, message: 'Invoice marked as sent and client notified.' })
}

// ── Build payment receipt PDF ──────────────────────────────────────
async function buildReceiptPdf(data: {
  invoiceNumber: string
  receiptNumber: string
  caseNumber: string
  clientName: string
  attorneyName: string
  firmName: string
  amount: number
  reference: string | null
  paidAt: string
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end',  () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W       = 495
    const PRIMARY = '#1a56db'
    const LIGHT   = '#e2e8f0'

    // Header band
    doc.rect(50, 45, W, 55).fill(PRIMARY)
    doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold').text('OFFICIAL RECEIPT', 60, 58, { width: W - 20 })
    doc.fillColor('#cbd5e0').fontSize(9).font('Helvetica').text(data.firmName, 60, 80)

    // Receipt meta
    doc.fillColor('#1a202c').fontSize(9).font('Helvetica-Bold').text('Receipt #:', 50, 120)
    doc.font('Helvetica').text(data.receiptNumber, 140, 120)
    doc.font('Helvetica-Bold').text('Invoice #:', 50, 135)
    doc.font('Helvetica').text(data.invoiceNumber, 140, 135)
    doc.font('Helvetica-Bold').text('Date Paid:', 50, 150)
    doc.font('Helvetica').text(data.paidAt, 140, 150)
    doc.font('Helvetica-Bold').text('Case #:', 50, 165)
    doc.font('Helvetica').text(data.caseNumber, 140, 165)

    doc.rect(50, 185, W, 1).fill(LIGHT)

    // Client/attorney
    doc.fillColor('#2d3748').fontSize(10).font('Helvetica-Bold').text('Received from:', 50, 200)
    doc.fillColor('#1a202c').fontSize(10).font('Helvetica').text(data.clientName, 50, 215)
    doc.fillColor('#2d3748').fontSize(10).font('Helvetica-Bold').text('Attorney:', 300, 200)
    doc.fillColor('#1a202c').font('Helvetica').text(data.attorneyName, 300, 215)

    doc.rect(50, 240, W, 1).fill(LIGHT)

    // Amount highlight
    doc.rect(50, 255, W, 60).fill('#f0fff4')
    doc.fillColor('#276749').fontSize(12).font('Helvetica-Bold').text('AMOUNT RECEIVED', 70, 265)
    doc.fontSize(20).text(
      `₱ ${Number(data.amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      70, 282
    )

    // Reference
    if (data.reference) {
      doc.fillColor('#2d3748').fontSize(9).font('Helvetica-Bold').text('Payment Reference:', 50, 330)
      doc.font('Helvetica').fillColor('#1a202c').text(data.reference, 170, 330)
    }

    doc.rect(50, 360, W, 1).fill(LIGHT)
    doc.fillColor('#718096').fontSize(8).font('Helvetica')
       .text('This receipt serves as official proof of payment. Thank you for your prompt settlement.',
             50, 372, { align: 'center', width: W })

    doc.end()
  })
}

// POST /api/cases/:caseId/invoices/:invoiceId/pay
export const markInvoicePaid = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  if (user.role === 'client') { res.status(403).json({ success: false, message: 'Access denied.' }); return }
  const caseId = Number(req.params.caseId)
  const invoiceId = Number(req.params.invoiceId)
  const { reference } = req.body

  const c = await getCase(caseId, user)
  if (!c || !canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  const [[inv]] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM invoices WHERE id = ? AND case_id = ?', [invoiceId, caseId]
  )
  if (!inv) { res.status(404).json({ success: false, message: 'Invoice not found.' }); return }
  if (inv.status === 'paid')   { res.status(400).json({ success: false, message: 'Invoice is already paid.' }); return }
  if (inv.status === 'void')   { res.status(400).json({ success: false, message: 'Cannot pay a voided invoice.' }); return }

  await pool.query(
    `UPDATE invoices SET status = 'paid', paid_at = NOW(), paid_reference = ? WHERE id = ?`,
    [reference || null, invoiceId]
  )

  // Mark billing entries as paid
  const ids: number[] = JSON.parse(inv.entries_json) || []
  if (ids.length) {
    await pool.query(
      `UPDATE case_billing SET is_paid = 1, paid_at = CURDATE() WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    )
  }

  // ── Generate & email payment receipt ──────────────────────────
  try {
    const [[client]]  = await pool.query<RowDataPacket[]>('SELECT fullname, email FROM users WHERE id = ?', [c.client_id])
    const [[attorney]] = await pool.query<RowDataPacket[]>('SELECT fullname FROM users WHERE id = ?', [c.attorney_id])
    const [[firmSetting]] = await pool.query<RowDataPacket[]>(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'firm_name' LIMIT 1`
    ).catch(() => [[{ setting_value: 'MGC Law Office' }]] as any)

    const receiptNumber = `RCP-${Date.now().toString().slice(-8)}`
    const paidAt = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })

    const receiptBuf = await buildReceiptPdf({
      invoiceNumber: inv.invoice_number,
      receiptNumber,
      caseNumber:    c.case_number,
      clientName:    client?.fullname ?? 'Client',
      attorneyName:  attorney?.fullname ?? '',
      firmName:      firmSetting?.setting_value ?? 'MGC Law Office',
      amount:        inv.total_amount,
      reference:     reference || null,
      paidAt,
    })

    // Save receipt to invoices/receipts/ upload folder
    const receiptDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'invoices', 'receipts')
    fs.mkdirSync(receiptDir, { recursive: true })
    const receiptPath = path.join(receiptDir, `receipt_${invoiceId}_${Date.now()}.pdf`)
    fs.writeFileSync(receiptPath, receiptBuf)

    // Store receipt path so it can be downloaded later
    await pool.query(
      `UPDATE invoices SET receipt_path = ? WHERE id = ?`,
      [receiptPath, invoiceId]
    ).catch(() => {}) // column may not exist in older DBs

    // Email receipt to client
    if (client?.email) {
      const html = `<div style="font-family:sans-serif;max-width:580px;margin:0 auto">
        <h2 style="color:#1a56db">Payment Receipt</h2>
        <p>Dear ${client.fullname},</p>
        <p>Your payment of <strong>₱${Number(inv.total_amount).toFixed(2)}</strong> for Invoice <strong>${inv.invoice_number}</strong> has been received.</p>
        ${reference ? `<p>Reference: <strong>${reference}</strong></p>` : ''}
        <p>Please find your official receipt attached.</p>
        <p style="color:#718096;font-size:13px">This is an automated message from ${firmSetting?.setting_value ?? 'MGC Law System'}.</p>
        </div>`

      sendMail(client.email, `Payment Receipt — Invoice ${inv.invoice_number}`, html).catch(() => {})
    }
  } catch (err) {
    logger.warn('Receipt generation failed:', err)
  }

  await notify(c.client_id, 'payment_received',
    `Payment received for invoice ${inv.invoice_number}. Thank you.`,
    caseId)

  await audit(req, 'PAY', 'invoice', invoiceId,
    `Invoice ${inv.invoice_number} marked paid. Ref: ${reference || 'none'}`)
  res.json({ success: true, message: 'Invoice marked as paid.' })
}

// GET /api/cases/:caseId/invoices/:invoiceId/receipt
export const downloadReceipt = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  const caseId = Number(req.params.caseId)
  const invoiceId = Number(req.params.invoiceId)

  const c = await getCase(caseId, user)
  if (!c || !canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  const [[inv]] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM invoices WHERE id = ? AND case_id = ?', [invoiceId, caseId]
  )
  if (!inv) { res.status(404).json({ success: false, message: 'Invoice not found.' }); return }
  if (inv.status !== 'paid') { res.status(400).json({ success: false, message: 'Invoice is not paid yet.' }); return }

  // Try saved receipt file first
  if (inv.receipt_path && fs.existsSync(inv.receipt_path)) {
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="receipt_${inv.invoice_number}.pdf"`)
    fs.createReadStream(inv.receipt_path).pipe(res)
    return
  }

  // Regenerate on the fly
  try {
    const [[client]]  = await pool.query<RowDataPacket[]>('SELECT fullname, email FROM users WHERE id = ?', [c.client_id])
    const [[attorney]] = await pool.query<RowDataPacket[]>('SELECT fullname FROM users WHERE id = ?', [c.attorney_id])
    const [[firmSetting]] = await pool.query<RowDataPacket[]>(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'firm_name' LIMIT 1`
    ).catch(() => [[{ setting_value: 'MGC Law Office' }]] as any)

    const paidAt = inv.paid_at
      ? new Date(inv.paid_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })

    const buf = await buildReceiptPdf({
      invoiceNumber: inv.invoice_number,
      receiptNumber: `RCP-${String(invoiceId).padStart(8,'0')}`,
      caseNumber:    c.case_number,
      clientName:    client?.fullname ?? 'Client',
      attorneyName:  attorney?.fullname ?? '',
      firmName:      firmSetting?.setting_value ?? 'MGC Law Office',
      amount:        inv.total_amount,
      reference:     inv.paid_reference || null,
      paidAt,
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="receipt_${inv.invoice_number}.pdf"`)
    res.setHeader('Content-Length', buf.length)
    res.end(buf)
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// PUT /api/cases/:caseId/invoices/:invoiceId/void
export const voidInvoice = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  if (!['attorney', 'admin', 'secretary'].includes(user.role)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }
  const caseId = Number(req.params.caseId)
  const invoiceId = Number(req.params.invoiceId)

  const c = await getCase(caseId, user)
  if (!c || !canAccess(c, user)) { res.status(403).json({ success: false, message: 'Access denied.' }); return }

  const [[inv]] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM invoices WHERE id = ? AND case_id = ?', [invoiceId, caseId]
  )
  if (!inv)             { res.status(404).json({ success: false, message: 'Invoice not found.' }); return }
  if (inv.status === 'paid') { res.status(400).json({ success: false, message: 'Cannot void a paid invoice.' }); return }

  await pool.query(`UPDATE invoices SET status = 'void' WHERE id = ?`, [invoiceId])
  await audit(req, 'VOID', 'invoice', invoiceId, `Voided invoice ${inv.invoice_number}`)
  res.json({ success: true, message: 'Invoice voided.' })
}
