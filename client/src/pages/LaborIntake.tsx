import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, Briefcase, AlertCircle, CheckCircle2,
  Upload, X, Paperclip, Loader2, Info,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { intakeApi } from '../services/api'
import { ChevronDown } from 'lucide-react'

const LABOR_CASE_TYPES = [
  { value: 'illegal_dismissal',      label: 'Illegal Dismissal',                           defaultSubject: 'Complaint for illegal dismissal' },
  { value: 'constructive_dismissal', label: 'Constructive Dismissal',                       defaultSubject: 'Complaint for constructive dismissal' },
  { value: 'unpaid_wages',           label: 'Unpaid Wages / Salary',                        defaultSubject: 'Complaint for unpaid wages / salary' },
  { value: '13th_month_pay',         label: '13th Month Pay',                               defaultSubject: 'Complaint for non-payment of 13th month pay' },
  { value: 'overtime_pay',           label: 'Overtime / Holiday Pay',                       defaultSubject: 'Complaint for unpaid overtime / holiday pay' },
  { value: 'separation_pay',         label: 'Separation Pay',                               defaultSubject: 'Complaint for non-payment of separation pay' },
  { value: 'non_regularization',     label: 'Non-Regularization / Security of Tenure',     defaultSubject: 'Complaint for non-regularization' },
  { value: 'illegal_suspension',     label: 'Illegal Suspension',                           defaultSubject: 'Complaint for illegal suspension' },
  { value: 'unjust_demotion',        label: 'Unjust Demotion',                              defaultSubject: 'Complaint for unjust demotion' },
  { value: 'ofw_poea',               label: 'OFW / POEA Dispute',                           defaultSubject: 'OFW complaint — POEA / recruitment dispute' },
  { value: 'other',                  label: 'Other Labor / Employment Matter',              defaultSubject: '' },
]

const MAX_FILES = 10
const MAX_MB    = 20

export default function LaborIntake() {
  useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    case_type:         'labor',
    labor_case_type:   '',
    subject:           '',
    narration:         '',
    legal_basis:       '',
    relief_sought:     '',
    opposing_party:    '',   // Employer / Company Name
    incident_date:     '',   // Date of dismissal / incident
    date_hired:        '',
    date_dismissed:    '',
    monthly_salary:    '',
    sena_acknowledged: false,
  })
  const [files,         setFiles]         = useState<File[]>([])
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState('')
  const [submitted,     setSubmitted]     = useState(false)
  const [subjectEdited, setSubjectEdited] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (field: string, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleLaborTypeChange = (value: string) => {
    const found = LABOR_CASE_TYPES.find(t => t.value === value)
    setForm(prev => ({
      ...prev,
      labor_case_type: value,
      subject: !subjectEdited && found?.defaultSubject !== undefined
        ? found.defaultSubject
        : prev.subject,
    }))
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

    if (!form.labor_case_type)       { setError('Please select the type of labor complaint.'); return }
    if (!form.subject.trim())        { setError('Please provide a brief subject/title.'); return }
    if (!form.narration.trim())      { setError('Please describe the facts of your complaint.'); return }
    if (!form.sena_acknowledged)     {
      setError('You must acknowledge the SEnA (Single Entry Approach) pre-filing requirement before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('case_type',         form.case_type)
      fd.append('labor_case_type',   form.labor_case_type)
      fd.append('subject',           form.subject.trim())
      fd.append('narration',         form.narration.trim())
      fd.append('legal_basis',       form.legal_basis.trim())
      fd.append('relief_sought',     form.relief_sought.trim())
      fd.append('opposing_party',    form.opposing_party.trim())
      fd.append('incident_date',     form.incident_date)
      if (form.date_hired)     fd.append('date_hired',     form.date_hired)
      if (form.date_dismissed) fd.append('date_dismissed', form.date_dismissed)
      if (form.monthly_salary) fd.append('monthly_salary', form.monthly_salary)
      fd.append('sena_acknowledged', '1')
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
            Your labor complaint intake has been received. An attorney will review it and guide you through the SEnA and NLRC process.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/intake')} style={{ padding: '0.6rem 1.4rem', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              View My Requests
            </button>
            <button onClick={() => navigate('/dashboard/client')} style={{ padding: '0.6rem 1.4rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600 }}>
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
          <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.75rem 2rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <Briefcase size={22} color="var(--accent)" />
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)' }}>
                Labor / Employment Complaint Intake
              </h1>
            </div>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem' }}>
              Use this form to describe your labor or employment complaint — illegal dismissal, unpaid wages,
              benefits claims, and related matters. An attorney will review your submission and guide you
              through the NLRC filing process.
            </p>
            {/* Different flow notice */}
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(59,130,246,0.07)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59,130,246,0.25)', fontSize: '0.85rem', color: 'var(--info, #60a5fa)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                <strong>Different pre-filing flow:</strong> Labor cases go through the <strong>Single Entry Approach (SEnA)</strong>
                — a mandatory 30-day conciliation-mediation at DOLE or NLRC — before a formal complaint can be
                docketed. No Barangay Certificate is required. Your attorney will guide you through SEnA.
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2rem' }}>

              {/* Labor Type + Subject */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Type of Labor Complaint <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={form.labor_case_type}
                      onChange={e => handleLaborTypeChange(e.target.value)}
                      style={{ ...inputStyle, appearance: 'none', paddingRight: '2rem' }}
                    >
                      <option value="">Select complaint type…</option>
                      {LABOR_CASE_TYPES.map(t => (
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
                    placeholder="Brief title (e.g. Illegal dismissal — ABC Corp. terminated without cause, March 2026)"
                    value={form.subject}
                    onChange={e => { setSubjectEdited(true); set('subject', e.target.value) }}
                    maxLength={255}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Employer / Company + Employment Period (3-col) */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Employer / Company Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(respondent)</span></label>
                  <input
                    type="text"
                    placeholder="Full name of employer or company"
                    value={form.opposing_party}
                    onChange={e => set('opposing_party', e.target.value)}
                    maxLength={255}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Date Hired</label>
                  <input
                    type="date"
                    value={form.date_hired}
                    onChange={e => set('date_hired', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Date Dismissed / Incident</label>
                  <input
                    type="date"
                    value={form.date_dismissed}
                    onChange={e => {
                      set('date_dismissed', e.target.value)
                      set('incident_date', e.target.value)
                    }}
                    max={new Date().toISOString().split('T')[0]}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Monthly Salary */}
              <div style={{ ...fieldStyle, maxWidth: 280 }}>
                <label style={labelStyle}>
                  Monthly Salary / Rate{' '}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, pointerEvents: 'none' }}>₱</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.monthly_salary}
                    onChange={e => set('monthly_salary', e.target.value)}
                    style={{ ...inputStyle, paddingLeft: '1.75rem' }}
                  />
                </div>
                <p style={hintStyle}>Used to compute back wages, separation pay, and other monetary claims.</p>
              </div>

              {/* Narration */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Narration of Facts <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea
                  rows={6}
                  placeholder="Describe what happened in as much detail as possible. Include: your position/job title, the nature of your employment, how you were dismissed or how your rights were violated, whether you were given a notice or heard, and any verbal or written communications from your employer."
                  value={form.narration}
                  onChange={e => set('narration', e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              {/* Legal Basis */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Legal Basis <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <textarea
                  rows={3}
                  placeholder="Which law was violated? (e.g. Art. 294 LC — security of tenure; Art. 297 — just causes; Art. 298 — authorized causes; Art. 116 — withholding wages; RA 6727 — Wage Rationalization Act; RA 10361 — Kasambahay Law, etc.)"
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
                  placeholder="What do you want the NLRC to order? (e.g. reinstatement with full back wages, payment of separation pay in lieu of reinstatement, payment of unpaid wages from __ to __, 13th month pay, damages, attorney's fees, etc.)"
                  value={form.relief_sought}
                  onChange={e => set('relief_sought', e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              {/* ── SEnA Pre-Filing Section ── */}
              <div style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'rgba(59,130,246,0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59,130,246,0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <Info size={16} color="var(--info, #60a5fa)" />
                  <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>
                    SEnA — Single Entry Approach (DOLE / NLRC)
                  </p>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.65, marginBottom: '0.8rem' }}>
                  Under <strong>Department Order No. 107-10</strong> and the NLRC Rules, all labor complaints must go through
                  a <strong>mandatory 30-day SEnA conference</strong> at the DOLE Regional Office or NLRC before a formal complaint
                  can be docketed. The SEnA officer will attempt conciliation-mediation between you and your employer.
                  If unresolved, you receive a <em>SEnA referral</em> or <em>Certificate of Non-Settlement</em> that
                  your attorney will use to file the formal complaint.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.65, marginBottom: '1rem' }}>
                  If you have already completed SEnA, please attach your <strong>SEnA Certificate / Referral</strong> in the
                  Supporting Documents section below. If not yet completed, your attorney will guide you through the SEnA process.
                </p>
                {/* Required acknowledgment */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.sena_acknowledged}
                    onChange={e => set('sena_acknowledged', e.target.checked)}
                    style={{ marginTop: '0.15rem', width: 16, height: 16, flexShrink: 0, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5 }}>
                    <strong>I understand and acknowledge</strong> that a SEnA conciliation-mediation conference at DOLE/NLRC
                    is required before my formal complaint can be filed. I authorize the attorney to guide me through
                    this pre-filing step. <span style={{ color: 'var(--danger)' }}>*</span>
                  </span>
                </label>
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
                  style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)' }}
                >
                  <Upload size={24} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Click or drag files — employment contract, payslips, payroll records, notice of termination, SEnA certificate (if completed), DTR, affidavits, etc.
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.3rem' }}>PDF, Word, Excel, JPEG, PNG, WebP accepted</p>
                </div>
                <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
                {files.length > 0 && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {files.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.75rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
                        <Paperclip size={14} color="var(--text-muted)" />
                        <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                        <button type="button" onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.8rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                  <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                  {error}
                </div>
              )}

              {/* Submit */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => navigate('/intake/select-type')} style={{ padding: '0.65rem 1.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting} style={{ padding: '0.65rem 1.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', border: 'none', color: '#000', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: submitting ? 0.7 : 1 }}>
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
