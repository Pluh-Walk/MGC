import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, FileText, AlertCircle, CheckCircle2,
  Upload, X, Paperclip, Loader2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { intakeApi } from '../services/api'
import { ChevronDown } from 'lucide-react'

const CIVIL_CASE_TYPES = [
  { value: 'collection',           label: 'Collection of Sum of Money / Unpaid Debt',          defaultSubject: 'Collection of sum of money — unpaid debt' },
  { value: 'breach_of_contract',   label: 'Breach of Contract',                                defaultSubject: 'Breach of contract' },
  { value: 'property_dispute',     label: 'Property Dispute / Ownership',                      defaultSubject: 'Property dispute / ownership claim' },
  { value: 'ejectment',            label: 'Ejectment / Unlawful Detainer',                     defaultSubject: 'Ejectment — unlawful detainer' },
  { value: 'annulment',            label: 'Annulment / Declaration of Nullity of Marriage',    defaultSubject: 'Petition for annulment / declaration of nullity of marriage' },
  { value: 'legal_separation',     label: 'Legal Separation',                                  defaultSubject: 'Petition for legal separation' },
  { value: 'inheritance',          label: 'Inheritance / Estate Settlement',                   defaultSubject: 'Settlement of estate / inheritance dispute' },
  { value: 'support',              label: 'Support (Spouse / Child)',                          defaultSubject: 'Petition for support' },
  { value: 'adoption',             label: 'Adoption',                                          defaultSubject: 'Petition for adoption' },
  { value: 'partition',            label: 'Partition of Property',                             defaultSubject: 'Action for partition of property' },
  { value: 'specific_performance', label: 'Specific Performance',                              defaultSubject: 'Action for specific performance of contract' },
  { value: 'rescission',           label: 'Rescission / Cancellation of Contract',             defaultSubject: 'Action for rescission / cancellation of contract' },
  { value: 'damages',              label: 'Damages (Contract-Based)',                          defaultSubject: 'Claim for damages arising from contract' },
  { value: 'other',                label: 'Other Civil Matter',                                defaultSubject: '' },
]

const MAX_FILES = 10
const MAX_MB    = 20

// Case types where a monetary claim amount is relevant
const MONEY_CASE_TYPES = new Set(['collection', 'breach_of_contract', 'damages'])

export default function ClientIntake() {
  useAuth()
  const navigate  = useNavigate()

  const [form, setForm] = useState({
    case_type:       'civil',
    civil_case_type: '',
    claim_amount:    '',
    subject:         '',
    narration:       '',
    legal_basis:     '',
    relief_sought:   '',
    opposing_party:  '',
    incident_date:   '',
  })
  const [files,       setFiles]       = useState<File[]>([])
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')
  const [submitted,   setSubmitted]   = useState(false)
  const [subjectEdited, setSubjectEdited] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const certRef = useRef<HTMLInputElement>(null)

  // ── Certificate OCR state ───────────────────────────────────────
  type CertStatus = 'idle' | 'verifying' | 'verified' | 'failed'
  const [certFile,    setCertFile]    = useState<File | null>(null)
  const [certStatus,  setCertStatus]  = useState<CertStatus>('idle')
  const [certPath,    setCertPath]    = useState('')
  const [certOcrText, setCertOcrText] = useState('')
  const [certError,   setCertError]   = useState('')
  const [certMatches, setCertMatches] = useState(0)

  const set = (field: string, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleCivilTypeChange = (value: string) => {
    const found = CIVIL_CASE_TYPES.find(t => t.value === value)
    setForm(prev => ({
      ...prev,
      civil_case_type: value,
      // Clear claim amount when switching away from a money-type case
      claim_amount: MONEY_CASE_TYPES.has(value) ? prev.claim_amount : '',
      subject: !subjectEdited && found?.defaultSubject !== undefined
        ? found.defaultSubject
        : prev.subject,
    }))
  }

  const handleCertFile = async (file: File | null | undefined) => {
    if (!file) return
    setCertFile(file)
    setCertStatus('verifying')
    setCertError('')
    try {
      const fd = new FormData()
      fd.append('cert_image', file)
      const res = await intakeApi.verifyCert(fd)
      const { verified, cert_path, matched_keywords, ocr_text } = res.data
      if (verified) {
        setCertStatus('verified')
        setCertPath(cert_path ?? '')
        setCertOcrText(ocr_text ?? '')
        setCertMatches(matched_keywords ?? 0)
      } else {
        setCertStatus('failed')
        setCertError('The photo does not appear to be a valid Barangay Conciliation Certificate. Please upload a clearer photo.')
        setCertMatches(matched_keywords ?? 0)
      }
    } catch (err: any) {
      setCertStatus('failed')
      setCertError(err.response?.data?.message ?? 'Verification failed. Please try again.')
    }
  }

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const next = [...files]
    for (const f of Array.from(incoming)) {
      if (next.length >= MAX_FILES) break
      if (f.size > MAX_MB * 1024 * 1024) {
        setError(`"${f.name}" exceeds the ${MAX_MB} MB limit.`)
        return
      }
      if (!next.find(x => x.name === f.name && x.size === f.size)) next.push(f)
    }
    setFiles(next)
    setError('')
  }

  const removeFile = (idx: number) =>
    setFiles(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.civil_case_type)  { setError('Please select the type of civil case.'); return }
    if (!form.subject.trim())   { setError('Please provide a brief subject/title.'); return }  
    if (!form.narration.trim()) { setError('Please describe the facts of your complaint.'); return }
    if (certStatus !== 'verified') {
      setError('You must upload and verify your Barangay Conciliation Certificate before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('case_type',       form.case_type)
      fd.append('civil_case_type',  form.civil_case_type)
      if (form.claim_amount) fd.append('claim_amount', form.claim_amount)
      fd.append('subject',          form.subject.trim())
      fd.append('narration',      form.narration.trim())
      fd.append('legal_basis',    form.legal_basis.trim())
      fd.append('relief_sought',  form.relief_sought.trim())
      fd.append('opposing_party', form.opposing_party.trim())
      fd.append('incident_date',  form.incident_date)
      if (certPath)    fd.append('barangay_cert_path',     certPath)
      if (certOcrText) fd.append('barangay_cert_ocr_text', certOcrText)
      for (const f of files) fd.append('attachments', f)

      await intakeApi.submit(fd)
      setSubmitted(true)
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ──────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '3rem 2.5rem', maxWidth: 520, width: '100%', textAlign: 'center' }}>
          <CheckCircle2 size={56} color="var(--success)" style={{ marginBottom: '1.25rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.75rem' }}>
            Complaint Submitted
          </h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '1.75rem' }}>
            Your complaint intake has been received. An attorney will review it and get back to you. You can track the status from your dashboard.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/intake')}
              style={{ padding: '0.6rem 1.4rem', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              View My Requests
            </button>
            <button
              onClick={() => navigate('/dashboard/client')}
              style={{ padding: '0.6rem 1.4rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600 }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.9rem', background: 'var(--surface-2)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    color: 'var(--text)', fontSize: '0.9rem', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: '0.4rem', fontWeight: 600,
    fontSize: '0.85rem', color: 'var(--text)',
  }
  const fieldStyle: React.CSSProperties = { marginBottom: '1.25rem' }
  const hintStyle: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }

  return (
    <div className="dashboard">
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className="role-badge client">Client</span>
          <NotificationBell />
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        <button className="btn-back" onClick={() => navigate('/intake/select-type')}>
          <ArrowLeft size={16} /> Back to Case Type Selection
        </button>

      <div style={{ marginTop: '1rem', maxWidth: 760, margin: '1rem auto 0' }}>
        {/* Header card */}
        <div style={{
          background: 'var(--surface-solid)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '1.75rem 2rem', marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <FileText size={22} color="var(--accent)" />
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)' }}>
              Civil Case Complaint Intake
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem' }}>
            Use this form to formally describe your legal complaint. An attorney will review your
            submission and respond. Please be as specific as possible — the more detail you provide,
            the faster we can evaluate your case.
          </p>
          <div style={{
            marginTop: '1rem', padding: '0.75rem 1rem',
            background: 'rgba(201,168,76,0.08)', borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(201,168,76,0.2)', fontSize: '0.85rem', color: 'var(--accent-light)',
          }}>
            <strong>Note:</strong> For disputes between individuals in the same city or barangay, Philippine law
            requires barangay conciliation (Lupong Tagapamayapa) before filing a case in court.
            Please indicate below whether you have completed this step.
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{
            background: 'var(--surface-solid)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '2rem',
          }}>

            {/* Civil Case Type + Subject (2-col) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Type of Civil Case <span style={{ color: 'var(--danger)' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={form.civil_case_type}
                    onChange={e => handleCivilTypeChange(e.target.value)}
                    style={{ ...inputStyle, appearance: 'none', paddingRight: '2rem' }}
                  >
                    <option value="">Select civil case type…</option>
                    {CIVIL_CASE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Subject / Matter <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  type="text"
                  placeholder="Brief title of your complaint (e.g. Unpaid loan of ₱50,000, property boundary dispute)"
                  value={form.subject}
                  onChange={e => { setSubjectEdited(true); set('subject', e.target.value) }}
                  maxLength={255}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Claim Amount — shown only for money-related case types */}
            {MONEY_CASE_TYPES.has(form.civil_case_type) && (
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Amount Being Claimed{' '}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                </label>
                <div style={{ position: 'relative', maxWidth: 280 }}>
                  <span style={{
                    position: 'absolute', left: '0.9rem', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-muted)',
                    fontSize: '0.9rem', pointerEvents: 'none', fontWeight: 600,
                  }}>₱</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.claim_amount}
                    onChange={e => set('claim_amount', e.target.value)}
                    style={{ ...inputStyle, paddingLeft: '1.75rem' }}
                  />
                </div>
                <p style={hintStyle}>Enter the total peso amount you are claiming. This helps the attorney assess the appropriate court jurisdiction.</p>
              </div>
            )}

            {/* Narration */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Narration of Facts <span style={{ color: 'var(--danger)' }}>*</span></label>
              <textarea
                rows={6}
                placeholder="Describe what happened in as much detail as possible. Include dates, places, and the names of persons involved."
                value={form.narration}
                onChange={e => set('narration', e.target.value)}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
              <p style={hintStyle}>This becomes the core facts section of your verified complaint.</p>
            </div>

            {/* Legal Basis */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Legal Basis <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <textarea
                rows={3}
                placeholder="What right or law do you believe was violated? (e.g. breach of contract under Art. 1170 NCC, RA 9262 — VAWC, etc.)"
                value={form.legal_basis}
                onChange={e => set('legal_basis', e.target.value)}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {/* Relief Sought */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Relief Sought <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <textarea
                rows={3}
                placeholder="What do you want the court to order? (e.g. payment of ₱50,000 + interest, issuance of restraining order, annulment of contract, etc.)"
                value={form.relief_sought}
                onChange={e => set('relief_sought', e.target.value)}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {/* Opposing Party + Incident Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Opposing Party</label>
                <input
                  type="text"
                  placeholder="Full name or company name of the other party"
                  value={form.opposing_party}
                  onChange={e => set('opposing_party', e.target.value)}
                  maxLength={255}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Date of Incident</label>
                <input
                  type="date"
                  value={form.incident_date}
                  onChange={e => set('incident_date', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Barangay Conciliation Certificate Upload */}
            <div style={{
              marginBottom: '1.5rem', padding: '1.25rem',
              background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}>
              <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                Barangay Conciliation Certificate <span style={{ color: 'var(--danger)' }}>*</span>
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                Required for disputes between residents of the same city/barangay. Upload a photo of your
                Certificate to File Action issued by the Lupong Tagapamayapa. The system will verify it automatically.
              </p>
              {/* Upload / status area */}
              <div
                onClick={() => certRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleCertFile(e.dataTransfer.files[0]) }}
                style={{
                  border: `2px dashed ${certStatus === 'verified' ? 'var(--success)' : certStatus === 'failed' ? 'var(--danger)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)', padding: '1.4rem', textAlign: 'center', cursor: 'pointer',
                  background: certStatus === 'verified' ? 'rgba(34,197,94,0.05)' : certStatus === 'failed' ? 'rgba(239,68,68,0.05)' : 'var(--surface-solid)',
                  transition: 'all 0.2s',
                }}
              >
                {certStatus === 'idle' && (
                  <>
                    <Upload size={22} color="var(--text-muted)" style={{ marginBottom: '0.35rem' }} />
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Click or drag — JPEG, PNG, or WebP photo</p>
                  </>
                )}
                {certStatus === 'verifying' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                    <Loader2 size={18} className="spin" />
                    <span style={{ fontSize: '0.85rem' }}>Verifying certificate…</span>
                  </div>
                )}
                {certStatus === 'verified' && (
                  <div style={{ color: 'var(--success)' }}>
                    <CheckCircle2 size={22} style={{ marginBottom: '0.3rem' }} />
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Certificate Verified</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {certFile?.name} · {certMatches} keyword{certMatches !== 1 ? 's' : ''} matched
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Click to replace</p>
                  </div>
                )}
                {certStatus === 'failed' && (
                  <div style={{ color: 'var(--danger)' }}>
                    <AlertCircle size={22} style={{ marginBottom: '0.3rem' }} />
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Verification Failed</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{certError}</p>
                    <p style={{ fontSize: '0.75rem', marginTop: '0.4rem' }}>Click to upload a different photo</p>
                  </div>
                )}
              </div>
              <input
                ref={certRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={e => handleCertFile(e.target.files?.[0])}
              />
            </div>

            {/* File Attachments */}
            <div style={fieldStyle}>
              <label style={labelStyle}>
                Supporting Documents <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(up to {MAX_FILES} files, {MAX_MB} MB each)</span>
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
                style={{
                  border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)',
                  padding: '1.5rem', textAlign: 'center', cursor: 'pointer',
                  transition: 'border-color 0.2s',
                  background: 'var(--surface-2)',
                }}
              >
                <Upload size={24} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Click or drag files here — contracts, receipts, photos, affidavits, barangay certificate, etc.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                  PDF, Word, Excel, JPEG, PNG, WebP accepted
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                style={{ display: 'none' }}
                onChange={e => handleFiles(e.target.files)}
              />

              {files.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {files.map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.45rem 0.75rem', background: 'var(--surface-2)',
                      border: '1px solid var(--border)', borderRadius: 6,
                    }}>
                      <Paperclip size={14} color="var(--text-muted)" />
                      <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.name}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {(f.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                padding: '0.8rem 1rem', background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)',
                color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '1.25rem',
              }}>
                <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* Submit */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => navigate('/intake/select-type')}
                style={{
                  padding: '0.65rem 1.5rem', borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  color: 'var(--text)', cursor: 'pointer', fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '0.65rem 1.75rem', borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent)', border: 'none',
                  color: '#000', cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? <><Loader2 size={16} className="spin" /> Submitting…</> : 'Submit Complaint'}
              </button>
            </div>
          </div>
        </form>
      </div>
      </main>
    </div>
  )
}
