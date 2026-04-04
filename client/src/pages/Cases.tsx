import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, Plus, Search, Briefcase, X, ChevronDown, AlertTriangle,
} from 'lucide-react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import { casesApi } from '../services/api'

// ─── Types ────────────────────────────────────────────────
interface Case {
  id: number
  case_number: string
  title: string
  case_type: string
  status: string
  priority: string
  filing_date: string | null
  created_at: string
  client_name: string
  attorney_name: string
  outcome: string | null
  overdue_deadlines: number
  next_deadline: string | null
}

interface Client { id: number; fullname: string; email: string }

// ─── Validation Schema ────────────────────────────────────
const CASE_TYPES = [
  'civil','criminal','family','corporate','administrative','labor',
  'property','immigration','intellectual_property','tax',
  'constitutional','probate','tort','contract','other',
] as const

const caseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  case_type: z.enum(CASE_TYPES),
  client_id: z.string().min(1, 'Please select a client'),
  description: z.string().optional(),
  court_name: z.string().optional(),
  docket_number: z.string().optional(),
  judge_name: z.string().optional(),
  filing_date: z.string().optional(),
  priority: z.enum(['urgent','high','normal','low']),
  opposing_party: z.string().optional(),
  opposing_counsel: z.string().optional(),
  retainer_amount: z.string().optional(),
})
type CaseForm = z.infer<typeof caseSchema>

// ─── Status Badge ─────────────────────────────────────────
const statusColor: Record<string, string> = {
  draft:    'icon-purple',
  active:   'icon-green',
  pending:  'icon-gold',
  closed:   'icon-blue',
  archived: '',
}

// ─── Priority Badge ───────────────────────────────────────
const priorityColors: Record<string, { bg: string; text: string }> = {
  urgent: { bg: '#fef2f2', text: '#dc2626' },
  high:   { bg: '#fff7ed', text: '#ea580c' },
  normal: { bg: '#f0fdf4', text: '#16a34a' },
  low:    { bg: '#f8fafc', text: '#64748b' },
}

export default function Cases() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [cases, setCases] = useState<Case[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [caseTypeFilter, setCaseTypeFilter] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [conflictWarning, setConflictWarning] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CaseForm>({
    resolver: zodResolver(caseSchema),
    defaultValues: { priority: 'normal' },
  })

  // ── Fetch cases
  const fetchCases = async () => {
    setLoading(true)
    try {
      const res = await casesApi.list({
        search,
        status: statusFilter,
        priority: priorityFilter || undefined,
        case_type: caseTypeFilter || undefined,
        overdue_only: overdueOnly || undefined,
      })
      setCases(res.data.data)
      setTotal(res.data.total)
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCases() }, [search, statusFilter, priorityFilter, caseTypeFilter, overdueOnly])

  // ── Open create modal
  const openCreate = async () => {
    if (!clients.length) {
      const res = await casesApi.clientList()
      setClients(res.data.data)
    }
    reset()
    setServerError('')
    setShowModal(true)
  }

  // ── Submit new case
  const onSubmit: SubmitHandler<CaseForm> = async (data) => {
    setSubmitting(true)
    setServerError('')
    setConflictWarning('')
    try {
      const res = await casesApi.create({ ...data, client_id: Number(data.client_id) })
      if (res.data.conflict_warning) setConflictWarning(res.data.conflict_warning)
      setShowModal(false)
      fetchCases()
    } catch (err: any) {
      setServerError(err.response?.data?.message || 'Failed to create case.')
    } finally {
      setSubmitting(false)
    }
  }

  const dashPath = user?.role === 'attorney' ? '/dashboard/attorney'
    : user?.role === 'secretary' ? '/dashboard/secretary'
    : '/dashboard/client'

  const canCreate = user?.role === 'attorney' || user?.role === 'secretary'

  return (
    <div className="dashboard">
      {/* Nav */}
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className={`role-badge ${user?.role}`}>
            {user?.role === 'attorney' ? 'Attorney' : user?.role === 'secretary' ? 'Secretary' : 'Client'}
          </span>
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        <button className="btn-back" onClick={() => navigate(dashPath)}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        {/* Conflict of interest warning */}
        {conflictWarning && (
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#9a3412', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{conflictWarning}</span>
            <button onClick={() => setConflictWarning('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9a3412' }}><X size={14} /></button>
          </div>
        )}

        {/* Header row */}
        <div className="page-header-row">
          <div>
            <h2>Cases</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {total} total case{total !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {canCreate && (
              <button className="btn-secondary" onClick={() => window.open(casesApi.exportUrl({ status: statusFilter || undefined, priority: priorityFilter || undefined, case_type: caseTypeFilter || undefined }), '_blank')} title="Export as CSV">
                Export CSV
              </button>
            )}
            {canCreate && (
              <button className="btn-primary" onClick={openCreate}>
                <Plus size={16} />
                {user?.role === 'secretary' ? 'Submit Draft' : 'New Case'}
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="filter-row">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              placeholder="Search by title or case number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="select-wrapper">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
            <ChevronDown size={14} className="select-chevron" />
          </div>
          <div className="select-wrapper">
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="filter-select">
              <option value="">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            <ChevronDown size={14} className="select-chevron" />
          </div>
          <div className="select-wrapper">
            <select value={caseTypeFilter} onChange={(e) => setCaseTypeFilter(e.target.value)} className="filter-select">
              <option value="">All types</option>
              {CASE_TYPES.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
              ))}
            </select>
            <ChevronDown size={14} className="select-chevron" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', color: overdueOnly ? '#dc2626' : 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
            <AlertTriangle size={13} /> Overdue only
          </label>
        </div>

        {/* Cases Table */}
        {loading ? (
          <div className="loading-state">Loading cases…</div>
        ) : cases.length === 0 ? (
          <div className="empty-state">
            <Briefcase size={48} className="empty-icon" />
            <p>No cases found.</p>
          </div>
        ) : (
          <div className="cases-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case No.</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>{user?.role === 'attorney' ? 'Client' : 'Attorney'}</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Filed</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    className="table-row-link"
                    onClick={() => navigate(`/cases/${c.id}`)}
                  >
                    <td>
                      <span className="mono">{c.case_number}</span>
                      {c.overdue_deadlines > 0 && (
                        <span title={`${c.overdue_deadlines} overdue deadline(s)`} style={{ marginLeft: '0.4rem', color: '#dc2626', verticalAlign: 'middle' }}>
                          <AlertTriangle size={13} />
                        </span>
                      )}
                    </td>
                    <td>
                      <div>{c.title}</div>
                      {c.next_deadline && (
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Next deadline: {new Date(c.next_deadline).toLocaleDateString()}
                        </div>
                      )}
                      {c.outcome && (
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          Outcome: {c.outcome}
                        </div>
                      )}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {c.case_type.replace('_', ' ')}
                    </td>
                    <td>{user?.role === 'attorney' ? c.client_name : c.attorney_name}</td>
                    <td>
                      {c.priority && priorityColors[c.priority] ? (
                        <span className="status-badge" style={{
                          background: priorityColors[c.priority].bg,
                          color: priorityColors[c.priority].text,
                          fontWeight: 600,
                          textTransform: 'capitalize',
                        }}>
                          {c.priority === 'urgent' && <AlertTriangle size={11} style={{ marginRight: 3 }} />}
                          {c.priority}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`status-badge ${statusColor[c.status] || ''}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>{c.filing_date ? new Date(c.filing_date).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create Case Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Case</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
              <div className="form-group">
                <label>Case Title *</label>
                <input {...register('title')} placeholder="Enter case title" />
                {errors.title && <span className="field-error">{errors.title.message}</span>}
              </div>

              <div className="form-group">
                <label>Case Description</label>
                <textarea {...register('description')} placeholder="Brief facts and legal basis…" rows={3} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Case Type *</label>
                  <select {...register('case_type')}>
                    <option value="">Select type</option>
                    {CASE_TYPES.map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                    ))}
                  </select>
                  {errors.case_type && <span className="field-error">{errors.case_type.message}</span>}
                </div>

                <div className="form-group">
                  <label>Assign Client *</label>
                  <select {...register('client_id')}>
                    <option value="">Select client</option>
                    {clients.map((cl) => (
                      <option key={cl.id} value={cl.id}>
                        {cl.fullname} ({cl.email})
                      </option>
                    ))}
                  </select>
                  {errors.client_id && <span className="field-error">{errors.client_id.message}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Priority</label>
                  <select {...register('priority')}>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Filing Date</label>
                  <input type="date" {...register('filing_date')} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Court Name</label>
                  <input {...register('court_name')} placeholder="e.g. RTC Branch 1" />
                </div>
                <div className="form-group">
                  <label>Docket Number</label>
                  <input {...register('docket_number')} placeholder="Court-assigned docket no." />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Judge Name</label>
                  <input {...register('judge_name')} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label>Retainer Amount (₱)</label>
                  <input type="number" {...register('retainer_amount')} placeholder="Optional" min="0" step="0.01" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Opposing Party</label>
                  <input {...register('opposing_party')} placeholder="Name of opposing party" />
                </div>
                <div className="form-group">
                  <label>Opposing Counsel</label>
                  <input {...register('opposing_counsel')} placeholder="Opposing lawyer name" />
                </div>
              </div>

              {serverError && <p className="form-error">{serverError}</p>}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
