import { useEffect, useState } from 'react'
import { BarChart3, Download, Users, Briefcase, AlertCircle, X, TrendingUp, Activity, DollarSign, ClipboardList, Star } from 'lucide-react'
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

interface FinancialReport {
  summary: { total_billed: number; collected: number; outstanding: number; voided: number; total_invoices: number; paid_count: number; overdue_count: number }
  by_month: Array<{ month: string; billed: number; collected: number }>
  aging: { bucket_0_30: number; bucket_31_60: number; bucket_61_90: number; bucket_90plus: number }
  top_clients: Array<{ fullname: string; email: string; total_billed: number; total_paid: number }>
  by_attorney: Array<{ fullname: string; total_billed: number; collected: number }>
}

interface WorkloadReport {
  attorney_workload: Array<{ id: number; fullname: string; active_cases: number; overdue_deadlines: number; open_tasks: number }>
  case_types: Array<{ case_type: string; total: number; active: number; closed: number }>
  outcomes: Array<{ outcome: string; total: number }>
  overdue_deadlines: Array<{ id: number; title: string; due_date: string; deadline_type: string; case_id: number; case_title: string; case_number: string; attorney_name: string; days_overdue: number }>
}

interface SurveyRow {
  id: number
  case_number: string
  case_title: string
  client_name: string
  attorney_name: string
  satisfaction_rating: number | null
  communication_rating: number | null
  outcome_rating: number | null
  nps_score: number | null
  comments: string | null
  responded_at: string | null
  sent_at: string
}

export default function AdminReports() {
  const [tab, setTab] = useState<'users' | 'cases' | 'financial' | 'workload' | 'surveys'>('users')
  const [userReport, setUserReport] = useState<UserReport | null>(null)
  const [caseReport, setCaseReport] = useState<CaseReport | null>(null)
  const [financialReport, setFinancialReport] = useState<FinancialReport | null>(null)
  const [workloadReport, setWorkloadReport] = useState<WorkloadReport | null>(null)
  const [surveyRows, setSurveyRows] = useState<SurveyRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchReport = () => {
    setLoading(true)
    setError('')

    const apiFn = tab === 'users'     ? adminApi.userReport()
                : tab === 'cases'     ? adminApi.caseReport()
                : tab === 'financial' ? adminApi.financialReport()
                : tab === 'surveys'   ? adminApi.surveyReport()
                : adminApi.workloadReport()

    apiFn
      .then((res: any) => {
        if (tab === 'users') setUserReport(res.data.data)
        else if (tab === 'cases') setCaseReport(res.data.data)
        else if (tab === 'financial') setFinancialReport(res.data.data)
        else if (tab === 'surveys') setSurveyRows(res.data.data)
        else setWorkloadReport(res.data.data)
      })
      .catch((err: any) => setError(err.response?.data?.message || 'Failed to load.'))
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
    } else if (tab === 'financial' && financialReport) {
      exportCSV(financialReport.by_month, 'financial_report')
    } else if (tab === 'workload' && workloadReport) {
      exportCSV(workloadReport.attorney_workload, 'workload_report')
    } else if (tab === 'surveys' && surveyRows) {
      exportCSV(surveyRows, 'survey_report')
    }
  }

  const Stars = ({ val }: { val: number | null }) => (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1,2,3,4,5].map(n => (
        <Star key={n} size={12} fill={val && n <= val ? '#f59e0b' : 'none'} color={val && n <= val ? '#f59e0b' : 'var(--text-muted)'} />
      ))}
    </span>
  )

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
        {(['users', 'cases', 'financial', 'workload', 'surveys'] as const).map(t => (
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
            {t === 'users' ? <Users size={16} /> : t === 'cases' ? <Briefcase size={16} /> : t === 'financial' ? <DollarSign size={16} /> : t === 'workload' ? <ClipboardList size={16} /> : <Star size={16} />}
            {t === 'users' ? 'User Report' : t === 'cases' ? 'Case Report' : t === 'financial' ? 'Financial' : t === 'workload' ? 'Workload' : 'Surveys'}
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
      ) : tab === 'financial' && financialReport ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Total Billed',  val: financialReport.summary.total_billed,  color: '#3b82f6' },
              { label: 'Collected',     val: financialReport.summary.collected,     color: '#22c55e' },
              { label: 'Outstanding',   val: financialReport.summary.outstanding,   color: '#f59e0b' },
              { label: 'Overdue Invs',  val: financialReport.summary.overdue_count, color: '#dc2626', isCnt: true },
            ].map(item => (
              <div key={item.label} className="admin-stat-card" style={{ padding: '1rem', borderLeft: `3px solid ${item.color}` }}>
                <div className="stat-label">{item.label}</div>
                <div className="stat-value" style={{ color: item.color }}>
                  {item.isCnt
                    ? item.val
                    : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(Number(item.val))}
                </div>
              </div>
            ))}
          </div>

          {/* Revenue by Month */}
          <div className="admin-activity-card">
            <div className="card-header"><h3><TrendingUp size={16} /> Revenue by Month</h3></div>
            <div style={{ padding: '1rem 1.25rem' }}>
              {financialReport.by_month.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No invoice data.</p>
              ) : (() => {
                const maxM = Math.max(...financialReport.by_month.map(m => Math.max(m.billed, m.collected)), 1)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {financialReport.by_month.map(row => (
                      <div key={row.month}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 3 }}>
                          <span>{row.month}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 60, fontSize: '0.7rem', color: '#3b82f6' }}>Billed</span>
                            <Bar value={row.billed} max={maxM} color="#3b82f6" />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 60, fontSize: '0.7rem', color: '#22c55e' }}>Collected</span>
                            <Bar value={row.collected} max={maxM} color="#22c55e" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Invoice Aging */}
          <div className="admin-activity-card">
            <div className="card-header"><h3><DollarSign size={16} /> Invoice Aging (Unpaid)</h3></div>
            <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { label: '0–30 days',  key: 'bucket_0_30',  color: '#22c55e' },
                { label: '31–60 days', key: 'bucket_31_60', color: '#f59e0b' },
                { label: '61–90 days', key: 'bucket_61_90', color: '#f97316' },
                { label: '90+ days',   key: 'bucket_90plus', color: '#dc2626' },
              ].map(({ label, key, color }) => {
                const val = Number((financialReport.aging as any)[key] ?? 0)
                const total = ['bucket_0_30','bucket_31_60','bucket_61_90','bucket_90plus'].reduce(
                  (s, k) => s + Number((financialReport.aging as any)[k] ?? 0), 0)
                const pct = total > 0 ? Math.round((val / total) * 100) : 0
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                      <span>{label}</span>
                      <span style={{ fontWeight: 600 }}>{new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(val)} ({pct}%)</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Revenue by Attorney */}
          {financialReport.by_attorney.length > 0 && (
            <div className="admin-activity-card">
              <div className="card-header"><h3><Users size={16} /> Revenue by Attorney</h3></div>
              <div style={{ padding: 0, overflowX: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>Attorney</th><th>Billed</th><th>Collected</th></tr></thead>
                  <tbody>
                    {financialReport.by_attorney.map((a, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{a.fullname}</td>
                        <td>{new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(Number(a.total_billed))}</td>
                        <td style={{ color: '#22c55e', fontWeight: 600 }}>{new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(Number(a.collected))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : tab === 'workload' && workloadReport ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Attorney Workload */}
          <div className="admin-activity-card">
            <div className="card-header"><h3><Users size={16} /> Attorney Workload</h3></div>
            <div style={{ padding: 0, overflowX: 'auto' }}>
              {workloadReport.attorney_workload.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No active attorneys.</p>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Attorney</th><th>Active Cases</th><th>Overdue Deadlines</th><th>Open Tasks</th></tr></thead>
                  <tbody>
                    {workloadReport.attorney_workload.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600 }}>{a.fullname}</td>
                        <td style={{ fontWeight: 700 }}>{a.active_cases}</td>
                        <td style={{ color: Number(a.overdue_deadlines) > 0 ? '#dc2626' : 'inherit', fontWeight: Number(a.overdue_deadlines) > 0 ? 700 : 400 }}>{a.overdue_deadlines}</td>
                        <td>{a.open_tasks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Case Type Distribution */}
          <div className="admin-activity-card">
            <div className="card-header"><h3><Briefcase size={16} /> Case Type Distribution</h3></div>
            <div style={{ padding: 0, overflowX: 'auto' }}>
              {workloadReport.case_types.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No cases.</p>
              ) : (() => {
                const maxT = Math.max(...workloadReport.case_types.map(c => c.total), 1)
                return (
                  <table className="data-table">
                    <thead><tr><th>Type</th><th>Total</th><th>Active</th><th>Closed</th><th style={{ width: '35%' }}></th></tr></thead>
                    <tbody>
                      {workloadReport.case_types.map((c, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{c.case_type}</td>
                          <td style={{ fontWeight: 700 }}>{c.total}</td>
                          <td><span className="pill pill-active">{c.active}</span></td>
                          <td><span className="pill pill-inactive">{c.closed}</span></td>
                          <td><Bar value={c.total} max={maxT} color="var(--accent)" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              })()}
            </div>
          </div>

          {/* Case Outcomes */}
          {workloadReport.outcomes.length > 0 && (
            <div className="admin-activity-card">
              <div className="card-header"><h3><Activity size={16} /> Case Outcomes (Closed)</h3></div>
              <div style={{ padding: '1rem 1.25rem' }}>
                {(() => {
                  const maxO = Math.max(...workloadReport.outcomes.map(o => o.total), 1)
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {workloadReport.outcomes.map((o, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ width: 120, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'capitalize', flexShrink: 0 }}>{o.outcome.replace(/_/g, ' ')}</span>
                          <Bar value={o.total} max={maxO} color="#8b5cf6" />
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', width: 32, textAlign: 'right' }}>{o.total}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Overdue Deadlines */}
          <div className="admin-activity-card">
            <div className="card-header"><h3><ClipboardList size={16} /> Overdue Deadlines</h3></div>
            <div style={{ padding: 0, overflowX: 'auto' }}>
              {workloadReport.overdue_deadlines.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No overdue deadlines.</p>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Deadline</th><th>Type</th><th>Case</th><th>Attorney</th><th>Due Date</th><th>Days Overdue</th></tr></thead>
                  <tbody>
                    {workloadReport.overdue_deadlines.map(d => (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 600 }}>{d.title}</td>
                        <td style={{ textTransform: 'capitalize', fontSize: '0.82rem' }}>{d.deadline_type?.replace(/_/g, ' ') || '—'}</td>
                        <td style={{ fontSize: '0.82rem' }}>{d.case_number} — {d.case_title}</td>
                        <td style={{ fontSize: '0.82rem' }}>{d.attorney_name}</td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{new Date(d.due_date).toLocaleDateString()}</td>
                        <td><span style={{ color: '#dc2626', fontWeight: 700 }}>{d.days_overdue}d</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : tab === 'surveys' && surveyRows ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="admin-activity-card">
            <div className="card-header"><h3><Star size={16} /> Client Satisfaction Surveys</h3></div>
            <div style={{ padding: 0, overflowX: 'auto' }}>
              {surveyRows.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No survey responses yet.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Case</th>
                      <th>Client</th>
                      <th>Attorney</th>
                      <th>Satisfaction</th>
                      <th>Communication</th>
                      <th>Outcome</th>
                      <th>NPS</th>
                      <th>Comments</th>
                      <th>Responded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surveyRows.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{s.case_number}</td>
                        <td style={{ fontWeight: 600 }}>{s.client_name}</td>
                        <td style={{ fontSize: '0.82rem' }}>{s.attorney_name}</td>
                        <td><Stars val={s.satisfaction_rating} /></td>
                        <td><Stars val={s.communication_rating} /></td>
                        <td><Stars val={s.outcome_rating} /></td>
                        <td style={{ fontWeight: 700, color: s.nps_score && s.nps_score >= 4 ? '#22c55e' : s.nps_score && s.nps_score <= 2 ? '#dc2626' : 'var(--text)' }}>
                          {s.nps_score ?? '—'}
                        </td>
                        <td style={{ maxWidth: 200, fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.comments ?? ''}>
                          {s.comments || '—'}
                        </td>
                        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                          {s.responded_at ? new Date(s.responded_at).toLocaleDateString() : <span style={{ fontStyle: 'italic' }}>Pending</span>}
                        </td>
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
