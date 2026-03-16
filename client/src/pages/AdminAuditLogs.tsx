import { useEffect, useState, FormEvent } from 'react'
import { FileText, Search, Download, AlertCircle, X, BarChart3, ChevronLeft, ChevronRight, Filter, Clock, User, Hash } from 'lucide-react'
import { auditApi } from '../services/api'

interface AuditEntry {
  id: number
  user_id: number
  user_fullname: string
  action: string
  entity_type: string
  entity_id: number | null
  details: string | null
  ip_address: string | null
  created_at: string
}

interface AuditStats {
  total_entries: number
  actions_breakdown: { action: string; count: number }[]
  top_users: { user_id: number; fullname: string; count: number }[]
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Stats
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [showStats, setShowStats] = useState(false)

  // Expanded row
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchLogs = () => {
    setLoading(true)
    const params: any = { page, limit: 50 }
    if (userId) params.userId = userId
    if (action) params.action = action
    if (entityType) params.entityType = entityType
    if (dateFrom) params.dateFrom = dateFrom
    if (dateTo) params.dateTo = dateTo

    auditApi.list(params)
      .then(res => { setLogs(res.data.data); setTotal(res.data.total) })
      .catch(err => setError(err.response?.data?.message || 'Failed to load.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchLogs() }, [page])

  const handleSearch = (e: FormEvent) => { e.preventDefault(); setPage(1); fetchLogs() }

  const handleExport = () => {
    const params: any = {}
    if (userId) params.userId = userId
    if (action) params.action = action
    if (entityType) params.entityType = entityType
    if (dateFrom) params.dateFrom = dateFrom
    if (dateTo) params.dateTo = dateTo

    auditApi.export(params)
      .then(res => {
        const blob = new Blob([res.data], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
      })
      .catch(() => setError('Export failed.'))
  }

  const loadStats = () => {
    auditApi.stats()
      .then(res => { setStats(res.data.data); setShowStats(true) })
      .catch(() => setError('Failed to load stats.'))
  }

  const totalPages = Math.ceil(total / 50)
  const activeFilters = [userId, action, entityType, dateFrom, dateTo].filter(Boolean).length

  return (
    <div className="admin-dash">
      <div className="admin-dash-header">
        <div>
          <h1><FileText size={24} /> Audit Logs</h1>
          <span className="subtitle">{total} total entries</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={loadStats}><BarChart3 size={16} /> Stats</button>
          <button className="btn-primary" onClick={handleExport}><Download size={16} /> Export</button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> {error} <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button></div>}

      {/* Filters */}
      <form onSubmit={handleSearch} className="audit-filter-bar">
        <div className="audit-filter-group">
          <User size={14} />
          <input type="number" placeholder="User ID" value={userId} onChange={e => setUserId(e.target.value)} />
        </div>
        <div className="audit-filter-group">
          <Hash size={14} />
          <input type="text" placeholder="Action" value={action} onChange={e => setAction(e.target.value)} />
        </div>
        <div className="audit-filter-group">
          <Filter size={14} />
          <input type="text" placeholder="Entity type" value={entityType} onChange={e => setEntityType(e.target.value)} />
        </div>
        <div className="audit-filter-group">
          <Clock size={14} />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
        </div>
        <div className="audit-filter-group">
          <Clock size={14} />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
        </div>
        <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Search size={15} /> Filter {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
        </button>
      </form>

      {loading ? <div className="page-loading"><div className="spinner" /></div> : (
        <div className="admin-users-table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th><th>IP</th><th>Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>No log entries found.</td></tr>
                ) : logs.map(l => (
                  <tr key={l.id} onClick={() => setExpandedId(expandedId === l.id ? null : l.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{l.id}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{l.user_fullname}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {l.user_id}</div>
                    </td>
                    <td><span className="action-badge">{l.action}</span></td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {l.entity_type}
                      {l.entity_id ? <span style={{ color: 'var(--text-muted)' }}> #{l.entity_id}</span> : ''}
                    </td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: expandedId === l.id ? 'normal' : 'nowrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {l.details || '—'}
                    </td>
                    <td><code style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '0.1rem 0.35rem', borderRadius: 4 }}>{l.ip_address || '—'}</code></td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(l.created_at).toLocaleString()}</td>
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

      {/* Stats Modal */}
      {showStats && stats && (
        <div className="modal-overlay" onClick={() => setShowStats(false)}>
          <div className="admin-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <h3><BarChart3 size={18} /> Audit Statistics</h3>
              <button onClick={() => setShowStats(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="detail-body">
              <div className="audit-stats-total">
                <span className="stats-number">{stats.total_entries.toLocaleString()}</span>
                <span className="stats-label">Total Entries</span>
              </div>

              <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Hash size={14} /> Actions Breakdown
              </h4>
              <div className="audit-stats-grid">
                {stats.actions_breakdown.map((a, i) => {
                  const max = Math.max(...stats.actions_breakdown.map(x => x.count))
                  return (
                    <div key={i} className="audit-stat-item">
                      <div className="audit-stat-bar-label">
                        <span className="action-badge">{a.action}</span>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{a.count}</span>
                      </div>
                      <div className="audit-stat-bar">
                        <div style={{ width: max ? `${(a.count / max) * 100}%` : '0%', height: '100%', borderRadius: 4, background: 'var(--accent)', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              <h4 style={{ fontSize: '0.88rem', fontWeight: 600, margin: '1.5rem 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <User size={14} /> Top Users
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {stats.top_users.map((u, i) => (
                  <div key={i} className="audit-top-user">
                    <span className="audit-top-rank">{i + 1}</span>
                    <span className="audit-top-name">{u.fullname}</span>
                    <span className="audit-top-count">{u.count} actions</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
