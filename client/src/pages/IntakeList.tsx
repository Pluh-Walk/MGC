import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, Plus, Clock, CheckCircle2, XCircle,
  FileText, Loader2, RefreshCw, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { intakeApi } from '../services/api'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending Review',  color: '#f59e0b', icon: <Clock size={14} /> },
  reviewing: { label: 'Under Review',    color: '#3b82f6', icon: <RefreshCw size={14} /> },
  accepted:  { label: 'Accepted',        color: '#22c55e', icon: <CheckCircle2 size={14} /> },
  rejected:  { label: 'Not Accepted',    color: '#ef4444', icon: <XCircle size={14} /> },
  converted: { label: 'Case Opened',     color: '#a78bfa', icon: <Scale size={14} /> },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: '#6b7280', icon: null }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.25rem 0.65rem', borderRadius: 20,
      background: `${cfg.color}1a`, color: cfg.color,
      fontSize: '0.78rem', fontWeight: 600,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

export default function IntakeList() {
  useAuth()
  const navigate  = useNavigate()
  const [intakes, setIntakes]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [detail,   setDetail]   = useState<any>(null)
  const [loadingD, setLoadingD] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await intakeApi.list()
      setIntakes(r.data.data ?? [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openDetail = async (intake: any) => {
    setSelected(intake)
    setLoadingD(true)
    try {
      const r = await intakeApi.get(intake.id)
      setDetail(r.data.data)
    } catch {}
    setLoadingD(false)
  }

  const handleWithdraw = async () => {
    if (!selected || !window.confirm('Withdraw this intake request?')) return
    setWithdrawing(true)
    try {
      await intakeApi.withdraw(selected.id)
      setSelected(null)
      setDetail(null)
      load()
    } catch {}
    setWithdrawing(false)
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
          <span className="role-badge client">Client</span>
          <NotificationBell />
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <button className="btn-back" style={{ margin: 0 }} onClick={() => navigate('/dashboard/client')}>
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <button className="btn-primary" style={{ width: 'auto' }} onClick={() => navigate('/intake/select-type')}>
            <Plus size={15} /> New Complaint
          </button>
        </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.3fr' : '1fr', gap: '1.5rem' }}>
        {/* List panel */}
        <div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
              <Loader2 size={32} color="var(--accent)" className="spin" />
            </div>
          ) : intakes.length === 0 ? (
            <div style={{
              background: 'var(--surface-solid)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '3rem 2rem', textAlign: 'center',
            }}>
              <FileText size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                You have not filed any complaints yet.
              </p>
              <button
                onClick={() => navigate('/intake/select-type')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.6rem 1.25rem', background: 'var(--accent)', border: 'none',
                  borderRadius: 'var(--radius-sm)', fontWeight: 700, color: '#000', cursor: 'pointer',
                }}
              >
                <Plus size={16} /> File a Complaint
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {intakes.map(intake => (
                <div
                  key={intake.id}
                  onClick={() => openDetail(intake)}
                  style={{
                    background: 'var(--surface-solid)', border: `1px solid ${selected?.id === intake.id ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)', padding: '1.25rem 1.5rem',
                    cursor: 'pointer', transition: 'border-color 0.2s',
                    display: 'flex', flexDirection: 'column', gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>{intake.subject}</span>
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <StatusBadge status={intake.status} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {intake.case_type.replace(/_/g, ' ')}
                    </span>
                    {intake.civil_case_type && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        · {intake.civil_case_type.replace(/_/g, ' ')}
                      </span>
                    )}
                    {intake.tort_case_type && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        · {intake.tort_case_type.replace(/_/g, ' ')}
                      </span>
                    )}
                    {intake.contract_case_type && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        · {intake.contract_case_type.replace(/_/g, ' ')}
                      </span>
                    )}
                    {intake.property_case_type && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        · {intake.property_case_type.replace(/_/g, ' ')}
                      </span>
                    )}
                    {intake.family_case_type && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        · {intake.family_case_type.replace(/_/g, ' ')}
                      </span>
                    )}
                    {intake.labor_case_type && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        · {intake.labor_case_type.replace(/_/g, ' ')}
                      </span>
                    )}
                    {intake.probate_case_type && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        · {intake.probate_case_type.replace(/_/g, ' ')}
                      </span>
                    )}
                    {intake.claim_amount && (
                      <span style={{
                        fontSize: '0.8rem', fontWeight: 600,
                        color: 'var(--accent)', background: 'rgba(201,168,76,0.1)',
                        padding: '0.15rem 0.5rem', borderRadius: 4,
                      }}>
                        ₱{Number(intake.claim_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    {intake.attachment_count > 0 && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {intake.attachment_count} file{intake.attachment_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Submitted {fmtDate(intake.submitted_at)}
                    {intake.attorney_name && ` · Assigned to ${intake.attorney_name}`}
                  </div>
                  {intake.status === 'converted' && intake.converted_case_id && (
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/cases/${intake.converted_case_id}`) }}
                      style={{
                        alignSelf: 'flex-start', padding: '0.3rem 0.75rem',
                        background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
                        borderRadius: 6, color: '#a78bfa', fontSize: '0.8rem',
                        cursor: 'pointer', fontWeight: 600,
                      }}
                    >
                      View Case →
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{
            background: 'var(--surface-solid)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '1.75rem',
            height: 'fit-content', position: 'sticky', top: '80px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: 700, color: 'var(--text)', fontSize: '1rem' }}>Intake Detail</h3>
              <button
                onClick={() => { setSelected(null); setDetail(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {loadingD ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Loader2 size={24} color="var(--accent)" className="spin" />
              </div>
            ) : detail && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Status</p>
                  <StatusBadge status={detail.status} />
                </div>
                <Field label="Subject" value={detail.subject} />
                <Field label="Case Type" value={detail.case_type?.replace(/_/g, ' ')} />
                {detail.civil_case_type && (
                  <Field label="Civil Case Type" value={detail.civil_case_type.replace(/_/g, ' ')} />
                )}
                {detail.tort_case_type && (
                  <Field label="Tort Sub-type" value={detail.tort_case_type.replace(/_/g, ' ')} />
                )}
                {detail.contract_case_type && (
                  <Field label="Contract Dispute Type" value={detail.contract_case_type.replace(/_/g, ' ')} />
                )}
                {detail.property_case_type && (
                  <Field label="Property Dispute Type" value={detail.property_case_type.replace(/_/g, ' ')} />
                )}
                {detail.property_address && (
                  <Field label="Property Address" value={detail.property_address} multiline />
                )}
                {detail.family_case_type && (
                  <Field label="Family Matter Type" value={detail.family_case_type.replace(/_/g, ' ')} />
                )}
                {detail.case_type === 'family' && (
                  <Field label="Mediation Acknowledged" value={detail.mediation_acknowledged ? 'Yes — court-annexed mediation acknowledged' : 'No'} />
                )}
                {detail.labor_case_type && (
                  <Field label="Labor Complaint Type" value={detail.labor_case_type.replace(/_/g, ' ')} />
                )}
                {detail.date_hired && (
                  <Field label="Date Hired" value={fmtDate(detail.date_hired)} />
                )}
                {detail.date_dismissed && (
                  <Field label="Date Dismissed" value={fmtDate(detail.date_dismissed)} />
                )}
                {detail.monthly_salary && (
                  <Field label="Monthly Salary" value={`₱${Number(detail.monthly_salary).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} />
                )}
                {detail.case_type === 'labor' && (
                  <Field label="SEnA Acknowledged" value={detail.sena_acknowledged ? 'Yes — SEnA requirement acknowledged' : 'No'} />
                )}
                {detail.probate_case_type && (
                  <Field label="Probate / Estate Type" value={detail.probate_case_type.replace(/_/g, ' ')} />
                )}
                {detail.deceased_name && (
                  <Field label="Deceased Name" value={detail.deceased_name} />
                )}
                {detail.date_of_death && (
                  <Field label="Date of Death" value={fmtDate(detail.date_of_death)} />
                )}
                {detail.estate_value && (
                  <Field label="Estimated Estate Value" value={`₱${Number(detail.estate_value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} />
                )}
                {detail.case_type === 'probate' && (
                  <Field label="Special Proceedings Acknowledged" value={detail.probate_acknowledged ? 'Yes — court publication requirement acknowledged' : 'No'} />
                )}
                {detail.claim_amount && (
                  <Field
                    label="Amount Claimed"
                    value={`₱${Number(detail.claim_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                  />
                )}
                <Field label="Narration" value={detail.narration} multiline />
                {detail.legal_basis   && <Field label="Legal Basis"   value={detail.legal_basis} multiline />}
                {detail.relief_sought && <Field label="Relief Sought" value={detail.relief_sought} multiline />}
                {detail.opposing_party && <Field label="Opposing Party" value={detail.opposing_party} />}
                {detail.incident_date  && <Field label="Date of Incident" value={fmtDate(detail.incident_date)} />}
                {['family', 'labor', 'probate'].includes(detail.case_type)
                  ? <Field label="Pre-filing Requirement" value="✓ Acknowledged" />
                  : <Field label="Barangay Certificate"
                      value={
                        detail.barangay_cert_status === 'verified' ? '✓ Verified'
                        : detail.barangay_cert_status === 'failed'  ? '✗ Not verified'
                        : 'Not submitted'
                      }
                    />
                }
                {detail.attorney_name && <Field label="Assigned Attorney" value={detail.attorney_name} />}
                {detail.rejection_reason && (
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger)', marginBottom: '0.3rem' }}>Rejection Reason</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{detail.rejection_reason}</p>
                  </div>
                )}
                {detail.attachments?.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Attached Files</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {detail.attachments.map((a: any) => (
                        <div key={a.id} style={{ fontSize: '0.82rem', color: 'var(--text)', padding: '0.3rem 0.5rem', background: 'var(--surface-2)', borderRadius: 5 }}>
                          {a.original_name} <span style={{ color: 'var(--text-muted)' }}>({(a.file_size / 1024).toFixed(0)} KB)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detail.status === 'converted' && detail.converted_case_id && (
                  <button
                    onClick={() => navigate(`/cases/${detail.converted_case_id}`)}
                    style={{
                      padding: '0.6rem 1rem', background: 'rgba(167,139,250,0.15)',
                      border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8,
                      color: '#a78bfa', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
                    }}
                  >
                    View Case →
                  </button>
                )}

                {detail.status === 'pending' && (
                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawing}
                    style={{
                      padding: '0.55rem 1rem', background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
                      color: 'var(--danger)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
                    }}
                  >
                    {withdrawing ? 'Withdrawing…' : 'Withdraw Request'}
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

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      <p style={{ fontSize: '0.88rem', color: 'var(--text)', whiteSpace: multiline ? 'pre-wrap' : 'normal', lineHeight: 1.6 }}>{value}</p>
    </div>
  )
}
