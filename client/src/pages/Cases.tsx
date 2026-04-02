import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, Plus, Search, Briefcase, X, ChevronDown,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
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
  filing_date: string | null
  created_at: string
  client_name: string
  attorney_name: string
}

interface Client { id: number; fullname: string; email: string }

// ─── Validation Schema ────────────────────────────────────
const caseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  case_type: z.enum(['civil', 'criminal', 'family', 'corporate', 'other']),
  client_id: z.string().min(1, 'Please select a client'),
  court_name: z.string().optional(),
  judge_name: z.string().optional(),
  filing_date: z.string().optional(),
})
type CaseForm = z.infer<typeof caseSchema>

// ─── Status Badge ─────────────────────────────────────────
const statusColor: Record<string, string> = {
  active: 'icon-green',
  pending: 'icon-gold',
  closed: 'icon-blue',
  archived: '',
}

export default function Cases() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [cases, setCases] = useState<Case[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CaseForm>({ resolver: zodResolver(caseSchema) })

  // ── Fetch cases
  const fetchCases = async () => {
    setLoading(true)
    try {
      const res = await casesApi.list({ search, status: statusFilter })
      setCases(res.data.data)
      setTotal(res.data.total)
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCases() }, [search, statusFilter])

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
  const onSubmit = async (data: CaseForm) => {
    setSubmitting(true)
    setServerError('')
    try {
      await casesApi.create({ ...data, client_id: Number(data.client_id) })
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

        {/* Header row */}
        <div className="page-header-row">
          <div>
            <h2>Cases</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {total} total case{total !== 1 ? 's' : ''}
            </p>
          </div>
          {canCreate && (
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={16} />
              {user?.role === 'secretary' ? 'Submit Draft' : 'New Case'}
            </button>
          )}
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
            <ChevronDown size={14} className="select-chevron" />
          </div>
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
                    <td><span className="mono">{c.case_number}</span></td>
                    <td>{c.title}</td>
                    <td style={{ textTransform: 'capitalize' }}>{c.case_type}</td>
                    <td>{user?.role === 'attorney' ? c.client_name : c.attorney_name}</td>
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

              <div className="form-row">
                <div className="form-group">
                  <label>Case Type *</label>
                  <select {...register('case_type')}>
                    <option value="">Select type</option>
                    <option value="civil">Civil</option>
                    <option value="criminal">Criminal</option>
                    <option value="family">Family</option>
                    <option value="corporate">Corporate</option>
                    <option value="other">Other</option>
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
                  <label>Court Name</label>
                  <input {...register('court_name')} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label>Judge Name</label>
                  <input {...register('judge_name')} placeholder="Optional" />
                </div>
              </div>

              <div className="form-group">
                <label>Filing Date</label>
                <input type="date" {...register('filing_date')} />
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
