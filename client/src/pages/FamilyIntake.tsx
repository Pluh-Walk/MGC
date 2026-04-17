import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, Users, AlertCircle, CheckCircle2,
  Upload, X, Paperclip, Loader2, Info,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { intakeApi } from '../services/api'
import { ChevronDown } from 'lucide-react'

const FAMILY_CASE_TYPES = [
  { value: 'annulment',           label: 'Annulment of Marriage',                              defaultSubject: 'Petition for annulment of marriage' },
  { value: 'nullity_of_marriage', label: 'Declaration of Nullity of Marriage',                 defaultSubject: 'Petition for declaration of nullity of marriage' },
  { value: 'legal_separation',    label: 'Legal Separation',                                   defaultSubject: 'Petition for legal separation' },
  { value: 'custody',             label: 'Child Custody',                                      defaultSubject: 'Petition for custody of minor child(ren)' },
  { value: 'support',             label: 'Support (Child / Spouse)',                           defaultSubject: 'Petition for support' },
  { value: 'adoption',            label: 'Adoption',                                           defaultSubject: 'Petition for adoption' },
  { value: 'vawc',                label: 'VAWC / Domestic Violence (RA 9262)',                 defaultSubject: 'Action under RA 9262 — VAWC / domestic violence' },
  { value: 'habeas_corpus_minor', label: 'Habeas Corpus (minor child)',                        defaultSubject: 'Petition for writ of habeas corpus — custody of minor' },
  { value: 'parental_authority',  label: 'Parental Authority / Guardianship',                  defaultSubject: 'Petition re: parental authority / guardianship' },
  { value: 'change_of_name',      label: 'Change of Name (Rule 103)',                          defaultSubject: 'Petition for change of name' },
  { value: 'correction_of_entry', label: 'Correction of Civil Registry Entry (RA 9048/10172)', defaultSubject: 'Petition for correction of civil registry entry' },
  { value: 'other',               label: 'Other Family Law Matter',                            defaultSubject: '' },
]

const MAX_FILES = 10
const MAX_MB    = 20

export default function FamilyIntake() {
  useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    case_type:              'family',
    family_case_type:       '',
    subject:                '',
    narration:              '',
    legal_basis:            '',
    relief_sought:          '',
    opposing_party:         '',
    incident_date:          '',
    mediation_acknowledged: false,
  })
  const [files,         setFiles]         = useState<File[]>([])
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState('')
  const [submitted,     setSubmitted]     = useState(false)
  const [subjectEdited, setSubjectEdited] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (field: string, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleFamilyTypeChange = (value: string) => {
    const found = FAMILY_CASE_TYPES.find(t => t.value === value)
    setForm(prev => ({
      ...prev,
      family_case_type: value,
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

    if (!form.family_case_type)       { setError('Please select the type of family law matter.'); return }
    if (!form.subject.trim())         { setError('Please provide a brief subject/title.'); return }
    if (!form.narration.trim())       { setError('Please describe the facts of your case.'); return }
    if (!form.mediation_acknowledged) {
      setError('You must acknowledge the Family Court mandatory mediation requirement before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('case_type',              form.case_type)
      fd.append('family_case_type',       form.family_case_type)
      fd.append('subject',                form.subject.trim())
      fd.append('narration',              form.narration.trim())
      fd.append('legal_basis',            form.legal_basis.trim())
      fd.append('relief_sought',          form.relief_sought.trim())
      fd.append('opposing_party',         form.opposing_party.trim())
      fd.append('incident_date',          form.incident_date)
      fd.append('mediation_acknowledged', '1')
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
            Your family law intake has been received. An attorney will review it and contact you. You can track the status from your dashboard.
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
              <Users size={22} color="var(--accent)" />
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)' }}>
                Family Law Complaint Intake
              </h1>
            </div>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem' }}>
              Use this form to describe your family law matter — annulment, custody, support, adoption,
              VAWC, and related proceedings. An attorney will review your submission and respond.
            </p>
            {/* Different flow notice */}
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(59,130,246,0.07)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59,130,246,0.25)', fontSize: '0.85rem', color: 'var(--info, #60a5fa)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                <strong>Different pre-filing flow:</strong> Family cases are filed with the Family Court (R.A. 8369)
                and do <em>not</em> require barangay conciliation. Instead, the court mandates
                court-annexed mediation before trial proceedings can begin. No Barangay Certificate is needed.
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2rem' }}>

              {/* Type + Subject (2-col) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Type of Family Matter <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={form.family_case_type}
                      onChange={e => handleFamilyTypeChange(e.target.value)}
                      style={{ ...inputStyle, appearance: 'none', paddingRight: '2rem' }}
                    >
                      <option value="">Select matter type…</option>
                      {FAMILY_CASE_TYPES.map(t => (
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
                    placeholder="Brief title (e.g. Petition for annulment — psychological incapacity)"
                    value={form.subject}
                    onChange={e => { setSubjectEdited(true); set('subject', e.target.value) }}
                    maxLength={255}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Narration */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Narration of Facts <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea
                  rows={6}
                  placeholder="Describe the situation in as much detail as possible. For annulment: grounds and history of the marriage. For custody: current situation of the child(ren) and why custody should be awarded to you. For support: financial situation and needs."
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
                  placeholder="Which law or provision applies? (e.g. Art. 36 FC — psychological incapacity; Art. 213 FC — custody; Art. 195 FC — support; RA 9262 — VAWC; RA 8552 — Domestic Adoption Act, etc.)"
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
                  placeholder="What do you want the court to order? (e.g. declaration of nullity of marriage, sole custody of the children, monthly support of ₱15,000, issuance of protection order, etc.)"
                  value={form.relief_sought}
                  onChange={e => set('relief_sought', e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              {/* Respondent + Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Respondent (Other Party)</label>
                  <input
                    type="text"
                    placeholder="Full name of spouse, other parent, or respondent"
                    value={form.opposing_party}
                    onChange={e => set('opposing_party', e.target.value)}
                    maxLength={255}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Date of Incident / Start</label>
                  <input
                    type="date"
                    value={form.incident_date}
                    onChange={e => set('incident_date', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* ── Court-Annexed Mediation Notice ── */}
              <div style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'rgba(59,130,246,0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59,130,246,0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <Info size={16} color="var(--info, #60a5fa)" />
                  <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>
                    Court-Annexed Mediation
                  </p>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.65, marginBottom: '1rem' }}>
                  Under the Family Courts Act (R.A. 8369) and A.M. No. 04-10-11-SC, the Family Court will refer
                  your case to <strong>court-annexed mediation</strong> before trial. This is a mandatory step.
                  Unlike civil disputes, <strong>no Barangay Conciliation Certificate is required</strong> to file
                  a family law case. The attorney will guide you through the court mediation process after filing.
                </p>
                {/* Required acknowledgment checkbox */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.mediation_acknowledged}
                    onChange={e => set('mediation_acknowledged', e.target.checked)}
                    style={{ marginTop: '0.15rem', width: 16, height: 16, flexShrink: 0, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5 }}>
                    <strong>I understand and acknowledge</strong> that the Family Court will require mandatory
                    court-annexed mediation after filing, and that no Barangay Conciliation Certificate
                    is needed for my case. <span style={{ color: 'var(--danger)' }}>*</span>
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
                    Click or drag files — marriage certificate, birth certificates, CENOMAR, affidavits, medical records, photos, police blotter, etc.
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                    PDF, Word, Excel, JPEG, PNG, WebP accepted
                  </p>
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
                <p style={hintStyle}>Attach the marriage certificate and any relevant documents. The attorney may request additional documents after review.</p>
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
