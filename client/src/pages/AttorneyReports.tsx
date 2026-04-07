import { useEffect, useState } from 'react'
import { TrendingUp, Clock, DollarSign, AlertTriangle, BarChart3, Download, Loader2 } from 'lucide-react'
import { profileApi } from '../services/api'

interface PerformanceData {
  cases_by_month: Array<{ month: string; opened: number; closed: number }>
  avg_duration: Array<{ case_type: string; avg_days: number; count: number }>
  billable_hours: Array<{ month: string; hours: number }>
  revenue: { collected: number; outstanding: number; total_billed: number }
  overdue_tasks: number
  sol_approaching: number
}

const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => (
  <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
    <div style={{ height: '100%', borderRadius: 4, width: max ? `${(value / max) * 100}%` : '0%', background: color, transition: 'width 0.5s' }} />
  </div>
)

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n)
}

export default function AttorneyReports() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'cases' | 'hours' | 'revenue'>('cases')

  useEffect(() => {
    setLoading(true)
    profileApi.getPerformance()
      .then(r => setData(r.data.data))
      .catch(e => setError(e?.response?.data?.message ?? 'Failed to load report.'))
      .finally(() => setLoading(false))
  }, [])

  const exportCSV = (rows: any[], name: string) => {
    if (!rows.length) return
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${name}_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={22} style={{ color: 'var(--accent)' }} /> Performance Reports
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
              Your practice metrics for the past 12 months
            </p>
          </div>
          {data && (
            <button className="btn-secondary" onClick={() => {
              if (tab === 'cases') exportCSV(data.cases_by_month, 'cases_by_month')
              else if (tab === 'hours') exportCSV(data.billable_hours, 'billable_hours')
              else exportCSV([data.revenue], 'revenue')
            }}>
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}><Loader2 size={32} className="spin" /></div>
        ) : data && (
          <>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Billed</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: 4 }}>{fmtCurrency(Number(data.revenue.total_billed))}</div>
                  </div>
                  <DollarSign size={22} style={{ color: '#22c55e', opacity: 0.7 }} />
                </div>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Collected</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: 4, color: '#22c55e' }}>{fmtCurrency(Number(data.revenue.collected))}</div>
                  </div>
                  <TrendingUp size={22} style={{ color: '#22c55e', opacity: 0.7 }} />
                </div>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Outstanding</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: 4, color: '#f59e0b' }}>{fmtCurrency(Number(data.revenue.outstanding))}</div>
                  </div>
                  <AlertTriangle size={22} style={{ color: '#f59e0b', opacity: 0.7 }} />
                </div>
              </div>
              <div className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overdue Tasks</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: 4, color: data.overdue_tasks > 0 ? '#dc2626' : 'var(--text)' }}>{data.overdue_tasks}</div>
                    {data.sol_approaching > 0 && <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: 2 }}>{data.sol_approaching} SOL approaching</div>}
                  </div>
                  <Clock size={22} style={{ color: '#dc2626', opacity: 0.7 }} />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="tab-bar" style={{ marginBottom: '1.25rem' }}>
              {(['cases', 'hours', 'revenue'] as const).map(t => (
                <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                  {t === 'cases' ? 'Cases by Month' : t === 'hours' ? 'Billable Hours' : 'Revenue'}
                </button>
              ))}
            </div>

            {/* Cases by month */}
            {tab === 'cases' && (
              <div className="card" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '1rem', fontWeight: 600, fontSize: '0.95rem' }}>Cases by Month (last 12 months)</h3>
                {data.cases_by_month.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No case data yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {data.cases_by_month.map(row => {
                      const maxVal = Math.max(...data.cases_by_month.map(r => Math.max(r.opened, r.closed)), 1)
                      return (
                        <div key={row.month}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                            <span>{row.month}</span>
                            <span style={{ color: 'var(--text)' }}>Opened: <b>{row.opened}</b> · Closed: <b>{row.closed}</b></span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 52, fontSize: '0.72rem', color: '#3b82f6' }}>Opened</span>
                              <Bar value={row.opened} max={maxVal} color="#3b82f6" />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 52, fontSize: '0.72rem', color: '#22c55e' }}>Closed</span>
                              <Bar value={row.closed} max={maxVal} color="#22c55e" />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Average duration by type */}
                {data.avg_duration.length > 0 && (
                  <>
                    <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontWeight: 600, fontSize: '0.95rem' }}>Average Duration by Case Type (closed cases)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {data.avg_duration.map(row => {
                        const maxDays = Math.max(...data.avg_duration.map(r => r.avg_days), 1)
                        return (
                          <div key={row.case_type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ width: 130, fontSize: '0.8rem', textTransform: 'capitalize', flexShrink: 0 }}>{row.case_type.replace(/_/g,' ')}</span>
                            <Bar value={row.avg_days} max={maxDays} color="#8b5cf6" />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0 }}>{row.avg_days}d ({row.count})</span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Billable hours */}
            {tab === 'hours' && (
              <div className="card" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '1rem', fontWeight: 600, fontSize: '0.95rem' }}>Billable Hours by Month</h3>
                {data.billable_hours.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No time tracking data yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {data.billable_hours.map(row => {
                      const maxH = Math.max(...data.billable_hours.map(r => r.hours), 1)
                      return (
                        <div key={row.month} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ width: 70, fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0 }}>{row.month}</span>
                          <Bar value={row.hours} max={maxH} color="#f59e0b" />
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, flexShrink: 0 }}>{row.hours}h</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Revenue */}
            {tab === 'revenue' && (
              <div className="card" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '1.25rem', fontWeight: 600, fontSize: '0.95rem' }}>Revenue Summary</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {[
                    { label: 'Total Billed', val: data.revenue.total_billed, color: '#3b82f6' },
                    { label: 'Collected',    val: data.revenue.collected,    color: '#22c55e' },
                    { label: 'Outstanding',  val: data.revenue.outstanding,  color: '#f59e0b' },
                  ].map(item => {
                    const pct = data.revenue.total_billed > 0
                      ? Math.round((item.val / data.revenue.total_billed) * 100)
                      : 0
                    return (
                      <div key={item.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 600 }}>{item.label}</span>
                          <span>{fmtCurrency(Number(item.val))} ({pct}%)</span>
                        </div>
                        <div style={{ height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 6, width: `${pct}%`, background: item.color, transition: 'width 0.5s' }} />
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ marginTop: '0.5rem', padding: '0.75rem', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Collection Rate</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#22c55e', marginTop: 2 }}>
                      {data.revenue.total_billed > 0
                        ? `${Math.round((data.revenue.collected / data.revenue.total_billed) * 100)}%`
                        : '--'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
    </div>
  )
}
