import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, BookOpen, AlertCircle, CheckCircle2,
  Upload, X, Paperclip, Loader2, Info,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { intakeApi } from '../services/api'
import { ChevronDown } from 'lucide-react'

const PROBATE_CASE_TYPES = [
  { value: 'intestate_estate',         label: 'Intestate Estate Settlement (No Will)',        defaultSubject: 'Petition for settlement of intestate estate' },
  { value: 'testate_estate',           label: 'Testate Estate Settlement (With Will)',         defaultSubject: 'Petition for settlement of testate estate' },
  { value: 'probate_of_will',          label: 'Probate of Will',                              defaultSubject: 'Petition for probate of will' },
  { value: 'letters_of_administration',label: 'Letters of Administration',                    defaultSubject: 'Petition for issuance of letters of administration' },
  { value: 'extrajudicial_settlement', label: 'Extrajudicial Settlement of Estate',            defaultSubject: 'Extrajudicial settlement of estate of the deceased' },
  { value: 'partition_of_estate',      label: 'Partition of Estate / Inheritance Dispute',    defaultSubject: 'Action for partition of estate' },
  { value: 'guardianship',             label: 'Guardianship (Incapacitated Person)',           defaultSubject: 'Petition for guardianship' },
  { value: 'other',                    label: 'Other Probate / Estate Matter',                 defaultSubject: '' },
]

const MAX_FILES = 10
const MAX_MB    = 20

// MTC jurisdiction: if assessed value of real property ≤ ₱400,000 (Metro Manila) or ≤ ₱300,000 (elsewhere)
// RTC for everything above. Attorney determines based on estate_value.
const JURISDICTION_HINT =
  'The assessed value of the estate determines whether the case is filed at the MTC or RTC. ' +
  'For estates consisting mainly of personal property, the gross value determines jurisdiction. ' +
  'Providing an estimate helps the attorney identify the correct court.'

export default function ProbateIntake() {
  useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    case_type:            'probate',
    probate_case_type:    '',
    subject:              '',
    narration:            '',
    legal_basis:          '',
    relief_sought:        '',
    opposing_party:       '',   // Other heirs / interested parties
    incident_date:        '',   // Not very relevant for probate but kept for schema consistency
    deceased_name:        '',
    date_of_death:        '',
    estate_value:         '',
    probate_acknowledged: false,
  })
  const [files,         setFiles]         = useState<File[]>([])
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState('')
  const [submitted,     setSubmitted]     = useState(false)
  const [subjectEdited, setSubjectEdited] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (field: string, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleProbateTypeChange = (value: string) => {
    const found = PROBATE_CASE_TYPES.find(t => t.value === value)
    setForm(prev => ({
      ...prev,
      probate_case_type: value,
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

    if (!form.probate_case_type)      { setError('Please select the type of probate / estate matter.'); return }
    if (!form.subject.trim())         { setError('Please provide a brief subject/title.'); return }
    if (!form.narration.trim())       { setError('Please describe the details of the estate.'); return }
    if (!form.deceased_name.trim())   { setError('The name of the deceased is required for probate / estate matters.'); return }
    if (!form.probate_acknowledged)   {
      setError('You must acknowledge the special proceedings notice before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('case_type',            form.case_type)
      fd.append('probate_case_type',    form.probate_case_type)
      fd.append('subject',              form.subject.trim())
      fd.append('narration',            form.narration.trim())
      fd.append('legal_basis',          form.legal_basis.trim())
      fd.append('relief_sought',        form.relief_sought.trim())
      fd.append('opposing_party',       form.opposing_party.trim())
      fd.append('incident_date',        form.date_of_death || form.incident_date)
      fd.append('deceased_name',        form.deceased_name.trim())
      if (form.date_of_death) fd.append('date_of_death', form.date_of_death)
      if (form.estate_value)  fd.append('estate_value',  form.estate_value)
      fd.append('probate_acknowledged', '1')
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
            Petition Submitted
          </h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '1.75rem' }}>
            Your estate / probate intake has been received. An attorney will review it and contact you about next steps including court publication requirements.
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
              <BookOpen size={22} color="var(--accent)" />
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)' }}>
                Estate / Probate Petition Intake
              </h1>
            </div>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem' }}>
              Use this form to describe your estate or probate matter — settlement of the deceased's estate,
              probate of a will, letters of administration, or partition among heirs. An attorney will
              review your submission and guide you through the special proceedings.
            </p>
            {/* Different flow notice */}
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(59,130,246,0.07)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59,130,246,0.25)', fontSize: '0.85rem', color: 'var(--info, #60a5fa)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                <strong>Different pre-filing flow:</strong> Estate settlement is a <strong>special proceeding</strong> under
                Rule 73–91 of the Rules of Court. It is largely non-adversarial and petition-based.
                No barangay conciliation is required. The court will set hearings and may require
                publication in a newspaper of general circulation to notify creditors and interested parties.
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2rem' }}>

              {/* Probate Type + Subject */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Type of Estate Matter <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={form.probate_case_type}
                      onChange={e => handleProbateTypeChange(e.target.value)}
                      style={{ ...inputStyle, appearance: 'none', paddingRight: '2rem' }}
                    >
                      <option value="">Select matter type…</option>
                      {PROBATE_CASE_TYPES.map(t => (
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
                    placeholder="Brief title (e.g. Intestate estate settlement of Juan dela Cruz — Quezon City)"
                    value={form.subject}
                    onChange={e => { setSubjectEdited(true); set('subject', e.target.value) }}
                    maxLength={255}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Deceased Details (3-col) */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Name of Deceased <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    placeholder="Full legal name of the deceased"
                    value={form.deceased_name}
                    onChange={e => set('deceased_name', e.target.value)}
                    maxLength={255}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Date of Death</label>
                  <input
                    type="date"
                    value={form.date_of_death}
                    onChange={e => set('date_of_death', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Est. Estate Value{' '}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600, pointerEvents: 'none' }}>₱</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={form.estate_value}
                      onChange={e => set('estate_value', e.target.value)}
                      style={{ ...inputStyle, paddingLeft: '1.75rem' }}
                    />
                  </div>
                </div>
              </div>
              <p style={{ ...hintStyle, marginTop: '-0.8rem', marginBottom: '1.25rem' }}>{JURISDICTION_HINT}</p>

              {/* Narration */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Description of the Estate and Circumstances <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea
                  rows={6}
                  placeholder="Describe the estate — what properties and assets are involved (real property, bank accounts, vehicles, business interests), who the known heirs are, whether a will exists, and any disputes among heirs or with creditors."
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
                  placeholder="Which law applies? (e.g. Rule 74 RoC — extrajudicial settlement; Rule 79 — letters of administration; Art. 960 NCC — intestate succession; Art. 838 NCC — probate of will; RA 11057 — PPSA, etc.)"
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
                  placeholder="What do you want the court to order? (e.g. issuance of letters of administration, probate of the attached will, judicial partition of the estate, approval of the project of partition, etc.)"
                  value={form.relief_sought}
                  onChange={e => set('relief_sought', e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              {/* Other Heirs / Interested Parties */}
              <div style={fieldStyle}>
                <label style={labelStyle}>
                  Other Known Heirs / Interested Parties{' '}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Names of other heirs, surviving spouse, or known creditors (separate with commas)"
                  value={form.opposing_party}
                  onChange={e => set('opposing_party', e.target.value)}
                  maxLength={255}
                  style={inputStyle}
                />
                <p style={hintStyle}>All heirs and interested parties must be notified by the court. Listing them here helps the attorney prepare the petition.</p>
              </div>

              {/* ── Special Proceedings Notice ── */}
              <div style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'rgba(59,130,246,0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59,130,246,0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <Info size={16} color="var(--info, #60a5fa)" />
                  <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>
                    Special Proceedings — Court Publication Requirement
                  </p>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.65, marginBottom: '1rem' }}>
                  Estate settlement is a <strong>special proceeding</strong> under Rules 73–91 of the Rules of Court.
                  Unlike ordinary civil actions, it is petition-based and not adversarial (unless heirs dispute the
                  settlement). The court will typically require <strong>publication of the notice of hearing</strong> in
                  a newspaper of general circulation once a week for three consecutive weeks to notify creditors and
                  all interested parties. Publication costs are borne by the estate. No barangay conciliation
                  certificate is required.
                </p>
                {/* Required acknowledgment */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.probate_acknowledged}
                    onChange={e => set('probate_acknowledged', e.target.checked)}
                    style={{ marginTop: '0.15rem', width: 16, height: 16, flexShrink: 0, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5 }}>
                    <strong>I understand and acknowledge</strong> that this is a special proceeding subject to
                    court publication requirements and that all heirs and known creditors must be notified.
                    No Barangay Conciliation Certificate is required. <span style={{ color: 'var(--danger)' }}>*</span>
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
                    Click or drag files — death certificate, original will, land titles/TCT, tax declarations, bank certificates, birth/marriage certificates of heirs, inventory of properties, etc.
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
                <p style={hintStyle}>The death certificate and a list of all properties and heirs are the most critical documents. Attach what you have — the attorney may request more after review.</p>
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
                  {submitting ? <><Loader2 size={16} className="spin" /> Submitting…</> : 'Submit Petition'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
