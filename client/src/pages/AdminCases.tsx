import { useEffect, useState, FormEvent } from 'react'
import { Briefcase, Search, AlertCircle, CheckCircle2, X, Eye, UserPlus, Archive, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { adminApi } from '../services/api'
import { useNavigate } from 'react-router-dom'

interface CaseRow {
  id: number
  case_number: string
  title: string
  status: string
  case_type: string
  attorney_name: string
  attorney_id: number
  client_name: string
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e', pending: '#f59e0b', closed: '#94a3b8', archived: '#6366f1',
}

export default function AdminCases() {
  const navigate = useNavigate()
  const [cases, setCases] = useState<CaseRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Reassign modal
  const [reassignCase, setReassignCase] = useState<CaseRow | null>(null)
  const [newAttorneyId, setNewAttorneyId] = useState('')
  const [reassignReason, setReassignReason] = useState('')

  const fetchCases = () => {
    setLoading(true)
    const params: any = { page, limit: 25 }
    if (search) params.search = search
    if (statusFilter) params.status = statusFilter

    adminApi.listCases(params)
      .then(res => { setCases(res.data.data); setTotal(res.data.total) })
      .catch(err => setError(err.response?.data?.message || 'Failed to load cases.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCases() }, [page, statusFilter])

  const handleSearch = (e: FormEvent) => { e.preventDefault(); setPage(1); fetchCases() }

  const handleReassign = async () => {
    if (!reassignCase || !newAttorneyId || !reassignReason.trim()) return
    try {
      await adminApi.reassignCase(reassignCase.id, Number(newAttorneyId))
      setSuccess(`Case ${reassignCase.case_number} reassigned.`)
      setReassignCase(null)
      setNewAttorneyId('')
      setReassignReason('')
      fetchCases()
    } catch (err: any) { setError(err.response?.data?.message || 'Failed.') }
  }

  const handleArchive = async (c: CaseRow) => {
    if (!confirm(`Force archive case ${c.case_number}? This will mark it as archived.`)) return
    try {
      await adminApi.archiveCase(c.id)
      setSuccess(`Case ${c.case_number} archived.`)
      fetchCases()
    } catch (err: any) { setError(err.response?.data?.message || 'Failed.') }
  }

  const totalPages = Math.ceil(total / 25)

  return (
    <div className="admin-dash">
      <div className="admin-dash-header">
        <div>
          <h1><Briefcase size={24} /> Case Oversight</h1>
          <span className="subtitle">{total} total case{total !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> {error} <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button></div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}><CheckCircle2 size={16} /> {success} <button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button></div>}

      {/* Toolbar */}
      <div className="admin-users-toolbar">
        <form onSubmit={handleSearch} className="search-box">
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Search case #, title, attorney, client…" value={search} onChange={e => setSearch(e.target.value)} />
        </form>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {loading ? <div className="page-loading"><div className="spinner" /></div> : (
        <div className="admin-users-table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case #</th><th>Title</th><th>Type</th><th>Status</th><th>Attorney</th><th>Client</th><th>Filed</th><th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>No cases found.</td></tr>
                ) : cases.map(c => (
                  <tr key={c.id}>
                    <td><code style={{ fontSize: '0.82rem', color: 'var(--accent)', background: 'rgba(201,168,76,0.1)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>{c.case_number}</code></td>
                    <td style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</td>
                    <td style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>{c.case_type}</td>
                    <td>
                      <span className={`pill pill-${c.status}`} style={{ borderLeft: `3px solid ${STATUS_COLORS[c.status] || 'var(--text-muted)'}` }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{c.attorney_name}</td>
                    <td style={{ fontSize: '0.85rem' }}>{c.client_name}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="action-group">
                        <button className="action-icon-btn" title="View" onClick={() => navigate(`/cases/${c.id}`)}><Eye size={15} /></button>
                        <button className="action-icon-btn" title="Reassign" onClick={() => setReassignCase(c)}><UserPlus size={15} /></button>
                        {c.status !== 'archived' && (
                          <button className="action-icon-btn danger" title="Archive" onClick={() => handleArchive(c)}><Archive size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="admin-pagination">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /> Prev</button>
              <span className="page-info">Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      )}

      {/* Reassign Modal */}
      {reassignCase && (
        <div className="modal-overlay" onClick={() => setReassignCase(null)}>
          <div className="admin-create-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-top">
              <h3><UserPlus size={18} /> Reassign Case {reassignCase.case_number}</h3>
              <button onClick={() => setReassignCase(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleReassign() }}>
              <div className="field-group">
                <label>Current Attorney</label>
                <input type="text" value={`${reassignCase.attorney_name} (ID: ${reassignCase.attorney_id})`} disabled />
              </div>
              <div className="field-group">
                <label>New Attorney ID</label>
                <input type="number" placeholder="Enter attorney user ID" value={newAttorneyId} onChange={e => setNewAttorneyId(e.target.value)} required />
              </div>
              <div className="field-group">
                <label>Reason</label>
                <textarea rows={3} placeholder="Reason for reassignment…" value={reassignReason} onChange={e => setReassignReason(e.target.value)} required style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.88rem', resize: 'vertical' }} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setReassignCase(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={!newAttorneyId || !reassignReason.trim()}>Reassign Case</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
