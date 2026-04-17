import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, Inbox, Clock, CheckCircle2, XCircle,
  ChevronRight, Loader2, User, X, AlertCircle, FileText,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { intakeApi } from '../services/api'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',      color: '#f59e0b' },
  reviewing: { label: 'Reviewing',    color: '#3b82f6' },
  accepted:  { label: 'Accepted',     color: '#22c55e' },
  rejected:  { label: 'Not Accepted', color: '#ef4444' },
  converted: { label: 'Case Opened',  color: '#a78bfa' },
}

const CASE_TYPE_LABELS: Record<string, string> = {
  civil: 'Civil', criminal: 'Criminal', family: 'Family', corporate: 'Corporate',
  administrative: 'Administrative', labor: 'Labor', property: 'Property',
  immigration: 'Immigration', intellectual_property: 'Intellectual Property',
  tax: 'Tax', constitutional: 'Constitutional', probate: 'Probate / Estate',
  tort: 'Tort / Damages', contract: 'Contract Dispute', other: 'Other',
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: '#6b7280' }
  return (
    <span style={{
      padding: '0.2rem 0.6rem', borderRadius: 20,
      background: `${cfg.color}1a`, color: cfg.color,
      fontSize: '0.78rem', fontWeight: 600,
    }}>
      {cfg.label}
    </span>
  )
}

export default function IntakeQueue() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [intakes,   setIntakes]   = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('pending')
  const [selected,  setSelected]  = useState<any>(null)
  const [detail,    setDetail]    = useState<any>(null)
  const [loadingD,  setLoadingD]  = useState(false)

  // Action state
  const [accepting,        setAccepting]        = useState(false)
  const [rejecting,        setRejecting]        = useState(false)
  const [converting,       setConverting]       = useState(false)
  const [rejectReason,     setRejectReason]     = useState('')
  const [showRejectForm,   setShowRejectForm]   = useState(false)
  const [actionError,      setActionError]      = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await intakeApi.list(filter || undefined)
      setIntakes(r.data.data ?? [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const openDetail = async (intake: any) => {
    setSelected(intake)
    setDetail(null)
    setShowRejectForm(false)
    setRejectReason('')
    setActionError('')
    setLoadingD(true)
    try {
      const r = await intakeApi.get(intake.id)
      setDetail(r.data.data)
    } catch {}
    setLoadingD(false)
  }

  const handleAccept = async () => {
    if (!selected) return
    setAccepting(true)
    setActionError('')
    try {
      await intakeApi.accept(selected.id)
      await openDetail({ ...selected, status: 'accepted' })
      load()
    } catch (e: any) {
      setActionError(e.response?.data?.message ?? 'Failed to accept.')
    }
    setAccepting(false)
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) { setActionError('Please provide a rejection reason.'); return }
    setRejecting(true)
    setActionError('')
    try {
      await intakeApi.reject(selected.id, rejectReason)
      setShowRejectForm(false)
      await openDetail({ ...selected, status: 'rejected' })
      load()
    } catch (e: any) {
      setActionError(e.response?.data?.message ?? 'Failed to reject.')
    }
    setRejecting(false)
  }

  const handleConvert = async () => {
    if (!selected || !window.confirm('Convert this intake into an active case? This cannot be undone.')) return
    setConverting(true)
    setActionError('')
    try {
      const r = await intakeApi.convert(selected.id)
      const { case_id } = r.data.data
      navigate(`/cases/${case_id}`)
    } catch (e: any) {
      setActionError(e.response?.data?.message ?? 'Conversion failed.')
    }
    setConverting(false)
  }

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <div className="dashboard">
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className={`role-badge ${user?.role}`}>Attorney</span>
          <NotificationBell />
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        <button className="btn-back" onClick={() => navigate('/dashboard/attorney')}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

      <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: selected ? '1fr 1.4fr' : '1fr', gap: '1.5rem' }}>
        {/* Left: list */}
        <div>
          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {[
              { val: 'pending',   label: 'Pending' },
              { val: 'accepted',  label: 'Accepted' },
              { val: 'converted', label: 'Converted' },
              { val: 'rejected',  label: 'Rejected' },
              { val: '',          label: 'All' },
            ].map(f => (
              <button
                key={f.val}
                onClick={() => setFilter(f.val)}
                style={{
                  padding: '0.4rem 1rem', borderRadius: 20, border: '1px solid var(--border)',
                  background: filter === f.val ? 'var(--accent)' : 'var(--surface-solid)',
                  color: filter === f.val ? '#000' : 'var(--text-muted)',
                  fontWeight: filter === f.val ? 700 : 400, cursor: 'pointer', fontSize: '0.85rem',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
              <Loader2 size={32} color="var(--accent)" className="spin" />
            </div>
          ) : intakes.length === 0 ? (
            <div style={{
              background: 'var(--surface-solid)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '3rem 2rem', textAlign: 'center',
            }}>
              <Inbox size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p style={{ color: 'var(--text-muted)' }}>
                {filter === 'pending' ? 'No pending intake requests.' : 'No intakes found.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {intakes.map(intake => (
                <div
                  key={intake.id}
                  onClick={() => openDetail(intake)}
                  style={{
                    background: 'var(--surface-solid)',
                    border: `1px solid ${selected?.id === intake.id ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)', padding: '1.25rem 1.5rem',
                    cursor: 'pointer', transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>{intake.subject}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <User size={13} color="var(--text-muted)" />
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{intake.client_name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>·</span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {CASE_TYPE_LABELS[intake.case_type] ?? intake.case_type}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <StatusBadge status={intake.status} />
                      <ChevronRight size={16} color="var(--text-muted)" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {['family', 'labor', 'probate'].includes(intake.case_type) ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--info, #60a5fa)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <CheckCircle2 size={12} /> Acknowledged
                      </span>
                    ) : intake.barangay_cert_status === 'verified' ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <CheckCircle2 size={12} /> Barangay cert verified
                      </span>
                    ) : intake.barangay_cert_status === 'failed' ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={12} /> Barangay cert failed
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={12} /> No barangay cert
                      </span>
                    )}
                    {intake.attachment_count > 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <FileText size={12} /> {intake.attachment_count} attachment{intake.attachment_count !== 1 ? 's' : ''}
                      </span>
                    )}
                    {intake.claim_amount && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>
                        ₱{Number(intake.claim_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {fmtDate(intake.submitted_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: detail */}
        {selected && (
          <div style={{
            background: 'var(--surface-solid)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '1.75rem',
            height: 'fit-content', position: 'sticky', top: '80px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 700, color: 'var(--text)' }}>Intake Detail</h3>
              <button onClick={() => { setSelected(null); setDetail(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {loadingD ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Loader2 size={24} color="var(--accent)" className="spin" />
              </div>
            ) : detail && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <StatusBadge status={detail.status} />
                  {['family', 'labor', 'probate'].includes(detail.case_type)
                    ? <span style={{ fontSize: '0.75rem', color: 'var(--info, #60a5fa)' }}>✓ Pre-filing requirement acknowledged</span>
                    : detail.barangay_cert_status === 'verified'
                    ? <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>✓ Barangay cert verified</span>
                    : detail.barangay_cert_status === 'failed'
                    ? <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>✗ Barangay cert not verified</span>
                    : <span style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>⚠ No barangay certificate submitted</span>
                  }
                </div>

                <DetailRow label="Client"        value={`${detail.client_name} (${detail.client_email})`} />
                <DetailRow label="Case Type"     value={CASE_TYPE_LABELS[detail.case_type] ?? detail.case_type} />
                {detail.civil_case_type && (
                  <DetailRow label="Civil Case Type" value={detail.civil_case_type.replace(/_/g, ' ')} />
                )}
                {detail.tort_case_type && (
                  <DetailRow label="Tort Sub-type" value={detail.tort_case_type.replace(/_/g, ' ')} />
                )}
                {detail.contract_case_type && (
                  <DetailRow label="Contract Dispute Type" value={detail.contract_case_type.replace(/_/g, ' ')} />
                )}
                {detail.property_case_type && (
                  <DetailRow label="Property Dispute Type" value={detail.property_case_type.replace(/_/g, ' ')} />
                )}
                {detail.property_address && (
                  <DetailRow label="Property Address" value={detail.property_address} multiline />
                )}
                {detail.family_case_type && (
                  <DetailRow label="Family Matter Type" value={detail.family_case_type.replace(/_/g, ' ')} />
                )}
                {detail.case_type === 'family' && (
                  <DetailRow label="Mediation Acknowledged" value={detail.mediation_acknowledged ? 'Yes — client acknowledged court-annexed mediation requirement' : 'No'} />
                )}
                {detail.labor_case_type && (
                  <DetailRow label="Labor Complaint Type" value={detail.labor_case_type.replace(/_/g, ' ')} />
                )}
                {detail.date_hired && (
                  <DetailRow label="Date Hired" value={fmtDate(detail.date_hired)} />
                )}
                {detail.date_dismissed && (
                  <DetailRow label="Date Dismissed / Last Day" value={fmtDate(detail.date_dismissed)} />
                )}
                {detail.monthly_salary && (
                  <DetailRow label="Monthly Salary" value={`₱${Number(detail.monthly_salary).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} />
                )}
                {detail.case_type === 'labor' && (
                  <DetailRow label="SEnA Acknowledged" value={detail.sena_acknowledged ? 'Yes — client acknowledged SEnA pre-filing requirement' : 'No'} />
                )}
                {detail.probate_case_type && (
                  <DetailRow label="Probate / Estate Type" value={detail.probate_case_type.replace(/_/g, ' ')} />
                )}
                {detail.deceased_name && (
                  <DetailRow label="Deceased Name" value={detail.deceased_name} />
                )}
                {detail.date_of_death && (
                  <DetailRow label="Date of Death" value={fmtDate(detail.date_of_death)} />
                )}
                {detail.estate_value && (
                  <DetailRow label="Estimated Estate Value" value={`₱${Number(detail.estate_value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} />
                )}
                {detail.case_type === 'probate' && (
                  <DetailRow label="Special Proceedings Acknowledged" value={detail.probate_acknowledged ? 'Yes — client acknowledged court publication requirement' : 'No'} />
                )}
                {detail.claim_amount && (
                  <DetailRow
                    label="Amount Claimed"
                    value={`₱${Number(detail.claim_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                  />
                )}
                <DetailRow label="Subject"       value={detail.subject} />
                <DetailRow label="Narration"     value={detail.narration} multiline />
                {detail.legal_basis   && <DetailRow label="Legal Basis"   value={detail.legal_basis} multiline />}
                {detail.relief_sought && <DetailRow label="Relief Sought" value={detail.relief_sought} multiline />}
                {detail.opposing_party && <DetailRow label="Opposing Party" value={detail.opposing_party} />}
                {detail.incident_date  && <DetailRow label="Date of Incident" value={fmtDate(detail.incident_date)} />}
                <DetailRow label="Submitted" value={fmtDate(detail.submitted_at)} />
                {detail.preferred_attorney_name && <DetailRow label="Preferred Attorney" value={detail.preferred_attorney_name} />}
                {detail.rejection_reason && (
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger)', marginBottom: '0.3rem' }}>Rejection Reason</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{detail.rejection_reason}</p>
                  </div>
                )}

                {detail.attachments?.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Attachments</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {detail.attachments.map((a: any) => (
                        <div key={a.id} style={{ fontSize: '0.82rem', color: 'var(--text)', padding: '0.35rem 0.6rem', background: 'var(--surface-2)', borderRadius: 5 }}>
                          {a.original_name}
                          <span style={{ color: 'var(--text-muted)' }}> · {(a.file_size / 1024).toFixed(0)} KB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {actionError && (
                  <div style={{ display: 'flex', gap: '0.5rem', padding: '0.65rem 0.9rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, color: 'var(--danger)', fontSize: '0.85rem' }}>
                    <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {actionError}
                  </div>
                )}

                {/* Action buttons */}
                {detail.status === 'pending' && !showRejectForm && (
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={handleAccept}
                      disabled={accepting}
                      style={{
                        flex: 1, padding: '0.65rem', background: 'var(--success)',
                        border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                      }}
                    >
                      {accepting ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
                      Accept
                    </button>
                    <button
                      onClick={() => setShowRejectForm(true)}
                      style={{
                        flex: 1, padding: '0.65rem', background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
                        color: 'var(--danger)', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                      }}
                    >
                      <XCircle size={15} /> Reject
                    </button>
                  </div>
                )}

                {showRejectForm && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '0.4rem' }}>
                      Rejection Reason <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Explain why the intake cannot be accepted at this time…"
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      style={{
                        width: '100%', padding: '0.6rem 0.8rem', background: 'var(--surface-2)',
                        border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
                        fontFamily: 'inherit', resize: 'vertical', marginBottom: '0.6rem',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      <button
                        onClick={handleReject}
                        disabled={rejecting}
                        style={{
                          flex: 1, padding: '0.6rem', background: 'var(--danger)',
                          border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        {rejecting ? 'Sending…' : 'Confirm Reject'}
                      </button>
                      <button
                        onClick={() => { setShowRejectForm(false); setActionError('') }}
                        style={{
                          padding: '0.6rem 1rem', background: 'var(--surface-2)',
                          border: '1px solid var(--border)', borderRadius: 8,
                          color: 'var(--text)', cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {detail.status === 'accepted' && detail.attorney_id === user?.id && (
                  <button
                    onClick={handleConvert}
                    disabled={converting}
                    style={{
                      padding: '0.7rem', background: 'var(--accent)', border: 'none',
                      borderRadius: 8, color: '#000', fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      marginTop: '0.5rem',
                    }}
                  >
                    {converting ? <Loader2 size={16} className="spin" /> : <Scale size={16} />}
                    {converting ? 'Opening Case…' : 'Convert to Case'}
                  </button>
                )}

                {detail.status === 'converted' && detail.converted_case_id && (
                  <button
                    onClick={() => navigate(`/cases/${detail.converted_case_id}`)}
                    style={{
                      padding: '0.65rem', background: 'rgba(167,139,250,0.15)',
                      border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8,
                      color: '#a78bfa', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem',
                    }}
                  >
                    Open Case →
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      </main>
    </div>
  )
}

function DetailRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{label}</p>
      <p style={{ fontSize: '0.88rem', color: 'var(--text)', whiteSpace: multiline ? 'pre-wrap' : 'normal', lineHeight: 1.65 }}>{value}</p>
    </div>
  )
}
