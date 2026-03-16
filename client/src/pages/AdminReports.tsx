import { useEffect, useState } from 'react'
import { BarChart3, Download, Users, Briefcase, AlertCircle, X, TrendingUp, Activity } from 'lucide-react'
import { adminApi } from '../services/api'

interface UserReport {
  registrations: Array<{ date: string; role: string; cnt: number }>
  logins: Array<{ date: string; successful: number; failed: number }>
  top_active_users: Array<{ id: number; fullname: string; role: string; action_count: number }>
}

interface CaseReport {
  cases_by_month: Array<{ month: string; cnt: number }>
  cases_by_type: Array<{ case_type: string; cnt: number }>
  attorney_workload: Array<{ id: number; fullname: string; total_cases: number; active: number; closed: number }>
}

export default function AdminReports() {
  const [tab, setTab] = useState<'users' | 'cases'>('users')
  const [userReport, setUserReport] = useState<UserReport | null>(null)
  const [caseReport, setCaseReport] = useState<CaseReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchReport = () => {
    setLoading(true)
    setError('')

    const api = tab === 'users' ? adminApi.userReport() : adminApi.caseReport()

    api
      .then(res => {
        if (tab === 'users') setUserReport(res.data.data)
        else setCaseReport(res.data.data)
      })
      .catch(err => setError(err.response?.data?.message || 'Failed to load.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchReport() }, [tab])

  const exportCSV = (data: any[], filename: string) => {
    if (data.length === 0) return
    const headers = Object.keys(data[0])
    const csv = [headers.join(','), ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleExport = () => {
    if (tab === 'users' && userReport) {
      exportCSV(userReport.registrations.length ? userReport.registrations : userReport.top_active_users, 'user_report')
    } else if (tab === 'cases' && caseReport) {
      exportCSV(caseReport.attorney_workload.length ? caseReport.attorney_workload : caseReport.cases_by_type, 'case_report')
    }
  }

  /* Simple inline bar helper */
  const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => (
    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 4, width: max ? `${(value / max) * 100}%` : '0%', background: color, transition: 'width 0.5s ease' }} />
    </div>
  )

  return (
    <div className="admin-dash">
      {/* Header */}
      <div className="admin-dash-header">
        <h1><BarChart3 size={24} /> Reports</h1>
        <button className="btn-primary" onClick={handleExport}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={16} /> {error} <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button></div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
        {(['users', 'cases'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '0.7rem 1.5rem', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              fontWeight: tab === t ? 700 : 400, fontSize: '0.88rem',
              color: tab === t ? 'var(--text)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'color 0.2s',
            }}
          >
            {t === 'users' ? <Users size={16} /> : <Briefcase size={16} />}
            {t === 'users' ? 'User Report' : 'Case Report'}
          </button>
        ))}
      </div>

      {loading ? <div className="page-loading"><div className="spinner" /></div> : tab === 'users' && userReport ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Registration Trend */}
          <div className="admin-activity-card">
            <div className="card-header">
              <h3><TrendingUp size={16} /> Registrations (Last 30 Days)</h3>
            </div>
            <div style={{ padding: '1rem 1.25rem', overflowX: 'auto' }}>
              {userReport.registrations.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No registrations in the last 30 days.</p>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Role</th><th>Count</th></tr></thead>
                  <tbody>
                    {userReport.registrations.map((r, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{new Date(r.date).toLocaleDateString()}</td>
                        <td><span className={`pill pill-${r.role}`}>{r.role}</span></td>
                        <td style={{ fontWeight: 700 }}>{r.cnt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Login Trends */}
          <div className="admin-activity-card">
            <div className="card-header">
              <h3><Activity size={16} /> Login Trends (Last 30 Days)</h3>
            </div>
            <div style={{ padding: '1rem 1.25rem' }}>
              {userReport.logins.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No login data available.</p>
              ) : (() => {
                const maxLogins = Math.max(...userReport.logins.map(l => Number(l.successful) + Number(l.failed)))
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {userReport.logins.map((l, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ width: 80, fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {new Date(l.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <Bar value={Number(l.successful)} max={maxLogins} color="#22c55e" />
                        <span style={{ fontSize: '0.8rem', color: '#22c55e', width: 28, textAlign: 'right', fontWeight: 600 }}>{l.successful}</span>
                        <Bar value={Number(l.failed)} max={maxLogins} color="#ef4444" />
                        <span style={{ fontSize: '0.8rem', color: '#ef4444', width: 28, textAlign: 'right', fontWeight: 600 }}>{l.failed}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#22c55e', marginRight: 4, verticalAlign: '-1px' }} />Successful</span>
                      <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#ef4444', marginRight: 4, verticalAlign: '-1px' }} />Failed</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Top Active Users */}
          <div className="admin-activity-card">
            <div className="card-header"><h3><Users size={16} /> Top Active Users (30 Days)</h3></div>
            <div style={{ padding: 0, overflowX: 'auto' }}>
              {userReport.top_active_users.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No activity data.</p>
              ) : (() => {
                const maxActions = Math.max(...userReport.top_active_users.map(u => u.action_count))
                return (
                  <table className="data-table">
                    <thead><tr><th>#</th><th>User</th><th>Role</th><th>Actions</th><th style={{ width: '40%' }}></th></tr></thead>
                    <tbody>
                      {userReport.top_active_users.map((u, i) => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{i + 1}</td>
                          <td style={{ fontWeight: 600 }}>{u.fullname}</td>
                          <td><span className={`pill pill-${u.role}`}>{u.role}</span></td>
                          <td style={{ fontWeight: 700 }}>{u.action_count}</td>
                          <td><Bar value={u.action_count} max={maxActions} color="var(--accent)" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              })()}
            </div>
          </div>
        </div>
      ) : tab === 'cases' && caseReport ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Cases by Month */}
          <div className="admin-activity-card">
            <div className="card-header"><h3><TrendingUp size={16} /> Cases by Month</h3></div>
            <div style={{ padding: '1rem 1.25rem' }}>
              {caseReport.cases_by_month.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No case data.</p>
              ) : (() => {
                const maxMonth = Math.max(...caseReport.cases_by_month.map(m => m.cnt))
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {caseReport.cases_by_month.map((m, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ width: 80, fontSize: '0.82rem', color: 'var(--text-muted)', flexShrink: 0 }}>{m.month}</span>
                        <Bar value={m.cnt} max={maxMonth} color="var(--accent)" />
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', width: 32, textAlign: 'right' }}>{m.cnt}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Cases by Type */}
          <div className="admin-activity-card">
            <div className="card-header"><h3><Briefcase size={16} /> Cases by Type</h3></div>
            <div style={{ padding: 0, overflowX: 'auto' }}>
              {caseReport.cases_by_type.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No data.</p>
              ) : (() => {
                const maxType = Math.max(...caseReport.cases_by_type.map(t => t.cnt))
                return (
                  <table className="data-table">
                    <thead><tr><th>Case Type</th><th>Count</th><th style={{ width: '50%' }}></th></tr></thead>
                    <tbody>
                      {caseReport.cases_by_type.map((t, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{t.case_type}</td>
                          <td style={{ fontWeight: 700 }}>{t.cnt}</td>
                          <td><Bar value={t.cnt} max={maxType} color="#3b82f6" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              })()}
            </div>
          </div>

          {/* Attorney Workload */}
          <div className="admin-activity-card">
            <div className="card-header"><h3><Users size={16} /> Attorney Workload</h3></div>
            <div style={{ padding: 0, overflowX: 'auto' }}>
              {caseReport.attorney_workload.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No active attorneys.</p>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Attorney</th><th>Total</th><th>Active</th><th>Closed</th></tr></thead>
                  <tbody>
                    {caseReport.attorney_workload.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600 }}>{a.fullname}</td>
                        <td style={{ fontWeight: 700 }}>{a.total_cases}</td>
                        <td><span className="pill pill-active">{a.active ?? 0}</span></td>
                        <td><span className="pill pill-inactive">{a.closed ?? 0}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
