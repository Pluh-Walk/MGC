import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, Home, AlertCircle, CheckCircle2,
  Upload, X, Paperclip, Loader2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { intakeApi } from '../services/api'
import { ChevronDown } from 'lucide-react'

const PROPERTY_CASE_TYPES = [
  { value: 'ejectment',           label: 'Ejectment / Unlawful Detainer',                      defaultSubject: 'Ejectment — unlawful detainer' },
  { value: 'forcible_entry',      label: 'Forcible Entry',                                      defaultSubject: 'Action for forcible entry' },
  { value: 'quieting_of_title',   label: 'Quieting of Title',                                   defaultSubject: 'Action for quieting of title' },
  { value: 'recovery_possession', label: 'Recovery of Possession (Accion Reivindicatoria)',     defaultSubject: 'Accion reivindicatoria — recovery of possession' },
  { value: 'accion_publiciana',   label: 'Accion Publiciana (Possession over 1 year)',          defaultSubject: 'Accion publiciana — recovery of right of possession' },
  { value: 'boundary_dispute',    label: 'Boundary Dispute',                                    defaultSubject: 'Property boundary dispute' },
  { value: 'partition',           label: 'Partition of Co-owned Property',                      defaultSubject: 'Action for partition of co-owned property' },
  { value: 'encroachment',        label: 'Encroachment / Illegal Construction',                 defaultSubject: 'Action for removal of encroachment / illegal construction' },
  { value: 'easement',            label: 'Easement / Right of Way Dispute',                     defaultSubject: 'Dispute over easement / right of way' },
  { value: 'landlord_tenant',     label: 'Landlord-Tenant Dispute (Non-Ejectment)',             defaultSubject: 'Landlord-tenant dispute' },
  { value: 'other',               label: 'Other Property Dispute',                              defaultSubject: '' },
]

const MAX_FILES = 10
const MAX_MB    = 20

export default function PropertyIntake() {
  useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    case_type:          'property',
    property_case_type: '',
    property_address:   '',
    subject:            '',
    narration:          '',
    legal_basis:        '',
    relief_sought:      '',
    opposing_party:     '',
    incident_date:      '',
  })
  const [files,         setFiles]         = useState<File[]>([])
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState('')
  const [submitted,     setSubmitted]     = useState(false)
  const [subjectEdited, setSubjectEdited] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const certRef = useRef<HTMLInputElement>(null)

  // ── Certificate OCR state ────────────────────────────────────────
  type CertStatus = 'idle' | 'verifying' | 'verified' | 'failed'
  const [certFile,    setCertFile]    = useState<File | null>(null)
  const [certStatus,  setCertStatus]  = useState<CertStatus>('idle')
  const [certPath,    setCertPath]    = useState('')
  const [certOcrText, setCertOcrText] = useState('')
  const [certError,   setCertError]   = useState('')
  const [certMatches, setCertMatches] = useState(0)

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handlePropertyTypeChange = (value: string) => {
    const found = PROPERTY_CASE_TYPES.find(t => t.value === value)
    setForm(prev => ({
      ...prev,
      property_case_type: value,
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

    if (!form.property_case_type) { setError('Please select the type of property dispute.'); return }
    if (!form.subject.trim())     { setError('Please provide a brief subject/title.'); return }
    if (!form.narration.trim())   { setError('Please describe the facts of your complaint.'); return }
    if (certStatus !== 'verified') {
      setError('You must upload and verify your Barangay Conciliation Certificate before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('case_type',          form.case_type)
      fd.append('property_case_type', form.property_case_type)
      if (form.property_address.trim()) fd.append('property_address', form.property_address.trim())
      fd.append('subject',        form.subject.trim())
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

  // ── Success screen ───────────────────────────────────────────────
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
  const hintStyle: React.CSSProperties  = { fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }

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
              <Home size={22} color="var(--accent)" />
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)' }}>
                Property Dispute Complaint Intake
              </h1>
            </div>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem' }}>
              Use this form to describe your dispute involving land, buildings, or real property —
              including ejectment, recovery of possession, boundary conflicts, and co-ownership
              issues. An attorney will review your submission and respond. Please include the
              property's location and attach any title, tax declaration, or survey documents if available.
            </p>
            <div style={{
              marginTop: '1rem', padding: '0.75rem 1rem',
              background: 'rgba(201,168,76,0.08)', borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(201,168,76,0.2)', fontSize: '0.85rem', color: 'var(--accent-light)',
            }}>
              <strong>Note:</strong> Most property disputes between parties in the same barangay require barangay
              conciliation before filing in court. Ejectment (MTC) and recovery of possession cases
              follow the Rules of Court on Summary Procedure or regular civil procedure depending on
              the assessed value of the property.
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{
              background: 'var(--surface-solid)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '2rem',
            }}>

              {/* Property Case Type + Subject (2-col) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Type of Property Dispute <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={form.property_case_type}
                      onChange={e => handlePropertyTypeChange(e.target.value)}
                      style={{ ...inputStyle, appearance: 'none', paddingRight: '2rem' }}
                    >
                      <option value="">Select dispute type…</option>
                      {PROPERTY_CASE_TYPES.map(t => (
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
                    placeholder="Brief title of your complaint (e.g. Ejectment of tenant — unlawful detainer at Brgy. San Juan)"
                    value={form.subject}
                    onChange={e => { setSubjectEdited(true); set('subject', e.target.value) }}
                    maxLength={255}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Property Address / Description */}
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Property Address / Description{' '}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Street address, barangay, city/municipality, province — or TCT/OCT/Tax Dec number if known."
                  value={form.property_address}
                  onChange={e => set('property_address', e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
                <p style={hintStyle}>Include the lot/block number or land title number if available. This helps the attorney identify jurisdiction.</p>
              </div>

              {/* Narration */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Narration of Facts <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea
                  rows={6}
                  placeholder="Describe what happened in as much detail as possible. Include: your claim or right over the property, when and how the dispute started, what the other party did (e.g. refused to vacate, entered without permission, built on your land), and any steps you have already taken."
                  value={form.narration}
                  onChange={e => set('narration', e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
                <p style={hintStyle}>Attach your title, tax declaration, or survey plan below if available.</p>
              </div>

              {/* Legal Basis */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Legal Basis <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <textarea
                  rows={3}
                  placeholder="Which law or provision do you believe applies? (e.g. Rule 70 RoC — Ejectment; Art. 428 NCC — ownership; Art. 434 — recovery of property; PD 1529 — Property Registration Decree; RA 7279 — UDHA, etc.)"
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
                  placeholder="What do you want the court to order? (e.g. order defendant to vacate and surrender possession, issuance of writ of possession, award of back rentals, demolition of illegal structure, quieting of title, etc.)"
                  value={form.relief_sought}
                  onChange={e => set('relief_sought', e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              {/* Opposing Party + Date of Incident */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Other Party (Respondent)</label>
                  <input
                    type="text"
                    placeholder="Full name of the person or entity occupying / claiming the property"
                    value={form.opposing_party}
                    onChange={e => set('opposing_party', e.target.value)}
                    maxLength={255}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Date Dispute Started</label>
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
                  Required for disputes between parties in the same city or barangay. Upload a photo of your
                  Certificate to File Action issued by the Lupong Tagapamayapa. The system will verify it automatically.
                </p>
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

              {/* Supporting Documents */}
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
                    Click or drag files here — title/TCT/OCT, tax declaration, survey plan, lease contract, demand letter, photos, etc.
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
