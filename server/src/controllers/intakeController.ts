/**
 * Case Intake Controller
 *
 * Self-service complaint submission by clients. The flow is:
 *   1. Client submits intake form (POST /api/intake)
 *   2. Attorney reviews the queue and accepts or rejects
 *   3. On accept, attorney converts the intake to a real Case with one click
 *
 * Routes:
 *   POST   /api/intake                    — client submits intake (+ optional file uploads)
 *   GET    /api/intake                    — client: their own; attorney/secretary: all pending for them
 *   GET    /api/intake/:id                — detail (client owner or attorney/admin)
 *   PUT    /api/intake/:id/accept         — attorney marks as accepted (assigns self)
 *   PUT    /api/intake/:id/reject         — attorney rejects with reason
 *   POST   /api/intake/:id/convert        — attorney converts accepted intake → real case
 *   DELETE /api/intake/:id                — client withdraws a pending intake
 */
import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import fs from 'fs'
import path from 'path'
import Tesseract from 'tesseract.js'
import pool from '../config/db'
import { verifyMagicBytes } from '../config/upload'
import { audit } from '../utils/audit'
import { notifyWithEmail } from '../utils/emailNotify'
import { generateCaseNumber } from '../utils/caseNumber'

// Keywords expected on a Philippine Barangay Conciliation Certificate /
// Certification to File Action issued by the Lupong Tagapamayapa.
const BARANGAY_KEYWORDS = [
  'BARANGAY',
  'LUPONG',
  'TAGAPAMAYAPA',
  'KATARUNGANG',
  'PAMBARANGAY',
  'CERTIFICATION',
  'CERTIFICATE',
  'FILE ACTION',
  'CONCILIATION',
  'MEDIATION',
  'PUNONG BARANGAY',
  'KAPITAN',
]

// Minimum keyword hits to consider the certificate genuine
const MIN_KEYWORD_HITS = 2

// ─── POST /api/intake/verify-barangay-cert ────────────────────────
// Client uploads a photo of their Barangay Conciliation Certificate.
// The image is held in memory (never written to disk at this stage),
// run through Tesseract OCR, and the result is returned immediately so
// the UI can show real-time verified / failed feedback before the user
// submits the full intake form.
// If verification passes, the image IS saved to disk and the generated
// token (file path) is returned so it can be included in the final
// intake submission.
export const verifyBarangayCert = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file
    if (!file) {
      res.status(400).json({ success: false, message: 'Certificate image is required.' })
      return
    }

    // Run OCR on the in-memory buffer
    const { data: { text } } = await Tesseract.recognize(file.buffer, 'eng', {
      logger: () => {},
    })

    const upper = text.toUpperCase()
    const matched = BARANGAY_KEYWORDS.filter(k => upper.includes(k))
    const verified = matched.length >= MIN_KEYWORD_HITS

    if (!verified) {
      res.status(422).json({
        success: false,
        verified: false,
        message: 'Could not confirm this is a Barangay Conciliation Certificate. Please upload a clearer photo showing the full document.',
        matched_keywords: matched,
      })
      return
    }

    // Save the verified image to the intake uploads folder so it can be stored
    // when the full form is submitted.
    const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'intake')
    fs.mkdirSync(uploadDir, { recursive: true })
    const filename = `barangay_cert_${Date.now()}_${Math.round(Math.random() * 1e6)}${getExt(file.originalname)}`
    const savePath = path.join(uploadDir, filename)
    fs.writeFileSync(savePath, file.buffer)

    await audit(req, 'barangay_cert_verified', 'intake', undefined, `matched=${matched.join(',')}`)

    res.json({
      success: true,
      verified: true,
      message: 'Barangay Conciliation Certificate verified.',
      cert_path: savePath,       // sent back to client, included in form submission
      matched_keywords: matched,
      ocr_text: text,
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'OCR processing failed. Please try again.' })
  }
}

// ─── POST /api/intake ─────────────────────────────────────────────
export const submitIntake = async (req: Request, res: Response): Promise<void> => {
  const files = (req.files as Express.Multer.File[]) ?? []
  try {
    const user = (req as any).user
    const {
      case_type, civil_case_type, claim_amount,
      tort_case_type,
      contract_case_type,
      property_case_type, property_address,
      family_case_type, mediation_acknowledged,
      labor_case_type, date_hired, date_dismissed, monthly_salary, sena_acknowledged,
      probate_case_type, deceased_name, date_of_death, estate_value, probate_acknowledged,
      subject, narration, legal_basis, relief_sought,
      opposing_party, incident_date, preferred_attorney,
      barangay_cert_path, barangay_cert_ocr_text,
    } = req.body

    if (!case_type || !subject?.trim() || !narration?.trim()) {
      cleanupFiles(files)
      res.status(400).json({ success: false, message: 'case_type, subject, and narration are required.' })
      return
    }

    const ALLOWED_TYPES = ['civil', 'tort', 'contract', 'property', 'family', 'labor', 'probate']
    if (!ALLOWED_TYPES.includes(case_type)) {
      cleanupFiles(files)
      res.status(400).json({ success: false, message: 'Self-service intake is not available for this case type. Please contact the office directly.' })
      return
    }

    // Barangay cert only required for standard civil/tort/contract/property cases
    const BARANGAY_REQUIRED = new Set(['civil', 'tort', 'contract', 'property'])
    if (BARANGAY_REQUIRED.has(case_type) && !barangay_cert_path?.trim()) {
      cleanupFiles(files)
      res.status(400).json({ success: false, message: 'A verified Barangay Conciliation Certificate is required before submitting a complaint.' })
      return
    }

    // Per-type acknowledgment checks for alternative pre-filing flow
    if (case_type === 'family' && mediation_acknowledged !== '1') {
      cleanupFiles(files)
      res.status(400).json({ success: false, message: 'You must acknowledge the Family Court mandatory mediation requirement before submitting.' })
      return
    }
    if (case_type === 'labor' && sena_acknowledged !== '1') {
      cleanupFiles(files)
      res.status(400).json({ success: false, message: 'You must acknowledge the SEnA (Single Entry Approach) pre-filing requirement before submitting.' })
      return
    }
    if (case_type === 'probate' && probate_acknowledged !== '1') {
      cleanupFiles(files)
      res.status(400).json({ success: false, message: 'You must acknowledge the special proceedings notice before submitting.' })
      return
    }
    if (case_type === 'probate' && !deceased_name?.trim()) {
      cleanupFiles(files)
      res.status(400).json({ success: false, message: 'The name of the deceased is required for probate / estate matters.' })
      return
    }

    const certStatus  = BARANGAY_REQUIRED.has(case_type) ? 'verified' : 'none'
    const barangayDone = BARANGAY_REQUIRED.has(case_type) ? 1 : 0

    // Verify all uploaded files pass magic-byte check
    for (const file of files) {
      const ok = await verifyMagicBytes(file.path, file.mimetype)
      if (!ok) {
        cleanupFiles(files)
        res.status(400).json({ success: false, message: `File "${file.originalname}" has an unsupported or mismatched type.` })
        return
      }
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO case_intake_requests
         (client_id, case_type, civil_case_type, claim_amount,
          tort_case_type, contract_case_type,
          property_case_type, property_address,
          family_case_type, mediation_acknowledged,
          labor_case_type, date_hired, date_dismissed, monthly_salary, sena_acknowledged,
          probate_case_type, deceased_name, date_of_death, estate_value, probate_acknowledged,
          subject, narration, legal_basis, relief_sought,
          opposing_party, incident_date, preferred_attorney,
          barangay_done, barangay_cert_path, barangay_cert_status, barangay_cert_ocr_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id, case_type,
        civil_case_type?.trim()    || null,
        claim_amount ? parseFloat(claim_amount) : null,
        tort_case_type?.trim()     || null,
        contract_case_type?.trim() || null,
        property_case_type?.trim() || null,
        property_address?.trim()   || null,
        family_case_type?.trim()   || null,
        mediation_acknowledged === '1' ? 1 : 0,
        labor_case_type?.trim()    || null,
        date_hired     || null,
        date_dismissed || null,
        monthly_salary ? parseFloat(monthly_salary) : null,
        sena_acknowledged === '1' ? 1 : 0,
        probate_case_type?.trim()  || null,
        deceased_name?.trim()      || null,
        date_of_death  || null,
        estate_value ? parseFloat(estate_value) : null,
        probate_acknowledged === '1' ? 1 : 0,
        subject.trim(), narration.trim(),
        legal_basis?.trim()    || null, relief_sought?.trim() || null,
        opposing_party?.trim() || null, incident_date || null,
        preferred_attorney ? Number(preferred_attorney) : null,
        barangayDone,
        barangay_cert_path?.trim()      || null,
        certStatus,
        barangay_cert_ocr_text?.trim()  || null,
      ]
    )
    const intakeId = result.insertId

    // Persist attachment records
    if (files.length > 0) {
      const attachRows = files.map(f => [intakeId, f.path, f.originalname, f.size, f.mimetype])
      await pool.query(
        `INSERT INTO case_intake_attachments (intake_id, file_path, original_name, file_size, mime_type)
         VALUES ?`,
        [attachRows]
      )
    }

    await audit(req, 'intake_submitted', 'case_intake', intakeId, `case_type=${case_type}`)

    // Notify all active attorneys (or preferred attorney) about the new intake
    const [attorneys] = await pool.query<RowDataPacket[]>(
      preferred_attorney
        ? `SELECT id FROM users WHERE id = ? AND role = 'attorney' AND status = 'active' LIMIT 1`
        : `SELECT id FROM users WHERE role = 'attorney' AND status = 'active'`,
      preferred_attorney ? [Number(preferred_attorney)] : []
    )

    const [clientRow] = await pool.query<RowDataPacket[]>(
      'SELECT fullname FROM users WHERE id = ?', [user.id]
    )
    const clientName = (clientRow[0] as any)?.fullname ?? 'A client'

    for (const atty of attorneys as RowDataPacket[]) {
      await notifyWithEmail(
        atty.id,
        'case_update',
        `New intake request from ${clientName}: "${subject.trim()}"`,
        intakeId,
        'New Client Intake Request',
        (name) => `<p>Hello ${name},</p>
          <p><strong>${clientName}</strong> has submitted a new complaint intake request:</p>
          <p><em>${subject.trim()}</em></p>
          <p>Please log in to review and accept or reject this request.</p>`
      )
    }

    res.status(201).json({ success: true, message: 'Intake submitted successfully.', data: { id: intakeId } })
  } catch (err: any) {
    cleanupFiles(files)
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/intake ──────────────────────────────────────────────
export const listIntakes = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { status } = req.query

    const conditions: string[] = []
    const params: any[] = []

    if (user.role === 'client') {
      conditions.push('i.client_id = ?')
      params.push(user.id)
    } else if (user.role === 'secretary') {
      // Secretary sees intakes assigned to their linked attorney
      conditions.push('i.attorney_id = ?')
      params.push(user.attorneyId)
    }
    // attorney + admin see all

    if (status) {
      conditions.push('i.status = ?')
      params.push(status)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT i.id, i.case_type, i.civil_case_type, i.claim_amount,
              i.tort_case_type, i.contract_case_type,
              i.property_case_type, i.property_address,
              i.family_case_type, i.mediation_acknowledged,
              i.labor_case_type, i.date_hired, i.date_dismissed, i.monthly_salary, i.sena_acknowledged,
              i.probate_case_type, i.deceased_name, i.date_of_death, i.estate_value, i.probate_acknowledged,
              i.subject, i.status, i.opposing_party,
              i.barangay_done, i.barangay_cert_status, i.incident_date, i.submitted_at, i.reviewed_at,
              i.rejection_reason, i.converted_case_id,
              c.fullname AS client_name, c.email AS client_email,
              a.fullname AS attorney_name,
              (SELECT COUNT(*) FROM case_intake_attachments ia WHERE ia.intake_id = i.id) AS attachment_count
       FROM case_intake_requests i
       JOIN users c ON c.id = i.client_id
       LEFT JOIN users a ON a.id = i.attorney_id
       ${where}
       ORDER BY i.submitted_at DESC`,
      params
    )

    res.json({ success: true, data: rows })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── GET /api/intake/:id ──────────────────────────────────────────
export const getIntake = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT i.*, c.fullname AS client_name, c.email AS client_email,
              a.fullname AS attorney_name, rv.fullname AS reviewed_by_name,
              pa.fullname AS preferred_attorney_name
       FROM case_intake_requests i
       JOIN users c ON c.id = i.client_id
       LEFT JOIN users a  ON a.id  = i.attorney_id
       LEFT JOIN users rv ON rv.id = i.reviewed_by
       LEFT JOIN users pa ON pa.id = i.preferred_attorney
       WHERE i.id = ?`,
      [id]
    )

    if (!rows.length) {
      res.status(404).json({ success: false, message: 'Intake not found.' })
      return
    }

    const intake = rows[0]

    // Clients can only view their own intakes
    if (user.role === 'client' && intake.client_id !== user.id) {
      res.status(403).json({ success: false, message: 'Forbidden.' })
      return
    }

    const [attachments] = await pool.query<RowDataPacket[]>(
      `SELECT id, original_name, file_size, mime_type, uploaded_at FROM case_intake_attachments WHERE intake_id = ?`,
      [id]
    )

    res.json({ success: true, data: { ...intake, attachments } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PUT /api/intake/:id/accept ───────────────────────────────────
export const acceptIntake = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM case_intake_requests WHERE id = ? AND status = 'pending'`, [id]
    )
    if (!rows.length) {
      res.status(404).json({ success: false, message: 'Intake not found or already reviewed.' })
      return
    }

    await pool.query(
      `UPDATE case_intake_requests
       SET status = 'accepted', attorney_id = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [user.id, user.id, id]
    )

    await audit(req, 'intake_accepted', 'case_intake', Number(id))

    // Notify the client
    await notifyWithEmail(
      rows[0].client_id,
      'case_update',
      `Your complaint intake "${rows[0].subject}" has been accepted by an attorney.`,
      Number(id),
      'Intake Request Accepted',
      (name) => `<p>Hello ${name},</p>
        <p>Your complaint intake request <strong>"${rows[0].subject}"</strong> has been <strong>accepted</strong> by our attorney.</p>
        <p>We will be in touch shortly to discuss next steps.</p>`
    )

    res.json({ success: true, message: 'Intake accepted.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── PUT /api/intake/:id/reject ───────────────────────────────────
export const rejectIntake = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params
    const { rejection_reason } = req.body

    if (!rejection_reason?.trim()) {
      res.status(400).json({ success: false, message: 'A rejection reason is required.' })
      return
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM case_intake_requests WHERE id = ? AND status IN ('pending','accepted')`, [id]
    )
    if (!rows.length) {
      res.status(404).json({ success: false, message: 'Intake not found or already processed.' })
      return
    }

    await pool.query(
      `UPDATE case_intake_requests
       SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [rejection_reason.trim(), user.id, id]
    )

    await audit(req, 'intake_rejected', 'case_intake', Number(id), rejection_reason.trim())

    await notifyWithEmail(
      rows[0].client_id,
      'case_update',
      `Your intake request "${rows[0].subject}" could not be accepted at this time.`,
      Number(id),
      'Intake Request Update',
      (name) => `<p>Hello ${name},</p>
        <p>We regret to inform you that your complaint intake request <strong>"${rows[0].subject}"</strong> could not be accepted at this time.</p>
        <p><strong>Reason:</strong> ${rejection_reason.trim()}</p>
        <p>You may submit a new request or contact us directly for further assistance.</p>`
    )

    res.json({ success: true, message: 'Intake rejected.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── POST /api/intake/:id/convert ────────────────────────────────
// Converts an accepted intake into a real Case record, pre-populating
// all fields from the intake data.
export const convertIntake = async (req: Request, res: Response): Promise<void> => {
  const conn = await pool.getConnection()
  try {
    const user = (req as any).user
    const { id } = req.params

    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT i.*, c.fullname AS client_name
       FROM case_intake_requests i
       JOIN users c ON c.id = i.client_id
       WHERE i.id = ? AND i.status = 'accepted' AND i.attorney_id = ?`,
      [id, user.id]
    )

    if (!rows.length) {
      conn.release()
      res.status(404).json({ success: false, message: 'Intake not found, not accepted, or not assigned to you.' })
      return
    }

    const intake: any = rows[0]
    if (intake.converted_case_id) {
      conn.release()
      res.status(409).json({ success: false, message: 'This intake has already been converted to a case.' })
      return
    }

    await conn.beginTransaction()

    const case_number = await generateCaseNumber()

    const [caseResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO cases
         (case_number, title, description, case_type, client_id, attorney_id,
          status, opposing_party, filing_date)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, CURDATE())`,
      [
        case_number,
        intake.subject,
        // Compose a structured description from intake fields
        [
          intake.narration,
          intake.legal_basis   ? `\n\nLegal Basis:\n${intake.legal_basis}` : '',
          intake.relief_sought ? `\n\nRelief Sought:\n${intake.relief_sought}` : '',
        ].join(''),
        intake.case_type,
        intake.client_id,
        user.id,
        intake.opposing_party || null,
      ]
    )
    const caseId = caseResult.insertId

    // Auto timeline entry
    await conn.query(
      `INSERT INTO case_timeline (case_id, event_type, description, event_date, created_by)
       VALUES (?, 'status_change', 'Case created from client intake request.', CURDATE(), ?)`,
      [caseId, user.id]
    )

    // Mark the intake as converted
    await conn.query(
      `UPDATE case_intake_requests SET status = 'converted', converted_case_id = ? WHERE id = ?`,
      [caseId, id]
    )

    await conn.commit()
    conn.release()

    await audit(req, 'intake_converted', 'case_intake', Number(id), `case_id=${caseId}`)

    // Notify the client that their case is now active
    await notifyWithEmail(
      intake.client_id,
      'case_update',
      `Your complaint has been accepted and Case ${case_number} has been opened.`,
      caseId,
      'Your Case Has Been Opened',
      (name) => `<p>Hello ${name},</p>
        <p>Your complaint intake has been converted into an active case:</p>
        <p><strong>Case Number:</strong> ${case_number}<br/>
        <strong>Matter:</strong> ${intake.subject}</p>
        <p>You can now view your case, upcoming hearings, and communicate with your attorney through the portal.</p>`
    )

    res.status(201).json({ success: true, message: 'Case created successfully.', data: { case_id: caseId, case_number } })
  } catch (err: any) {
    await conn.rollback()
    conn.release()
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── DELETE /api/intake/:id ───────────────────────────────────────
export const withdrawIntake = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM case_intake_requests WHERE id = ? AND client_id = ? AND status = 'pending'`,
      [id, user.id]
    )
    if (!rows.length) {
      res.status(404).json({ success: false, message: 'Intake not found or cannot be withdrawn.' })
      return
    }

    await pool.query(`DELETE FROM case_intake_requests WHERE id = ?`, [id])
    await audit(req, 'intake_withdrawn', 'case_intake', Number(id))

    res.json({ success: true, message: 'Intake withdrawn.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────
function cleanupFiles(files: Express.Multer.File[]) {
  for (const f of files) {
    try { fs.unlinkSync(f.path) } catch { /* ignore */ }
  }
}

function getExt(originalname: string): string {
  const ext = path.extname(originalname).toLowerCase()
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg'
}
