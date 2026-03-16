import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield,
  Users,
  Briefcase,
  FileCheck,
  Activity,
  Settings,
  BarChart3,
  Megaphone,
  AlertCircle,
  TrendingUp,
  Clock,
  UserCheck,
  UserPlus,
  CheckCircle,
  XCircle,
  ChevronRight,
  User,
} from 'lucide-react'
import { adminApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface DashboardData {
  users: {
    by_role: Array<{ role: string; cnt: number }>
    by_status: Array<{ status: string; cnt: number }>
    active_last_7_days: number
    pending_verifications: number
  }
  cases: {
    by_status: Array<{ status: string; cnt: number }>
    total: number
  }
  recent_activity: Array<{
    action: string
    target_type: string
    details: string
    created_at: string
    user_name: string
    user_role: string
  }>
  login_stats_24h: {
    total_attempts: number
    successful: number
    failed: number
  }
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    adminApi.dashboard()
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load dashboard.'))
      .finally(() => setLoading(false))
  }, [])

  const getRoleCount = (role: string) =>
    data?.users.by_role.find(r => r.role === role)?.cnt || 0

  const getCaseCount = (status: string) =>
    data?.cases.by_status.find(c => c.status === status)?.cnt || 0

  const totalUsers = data?.users.by_role.reduce((s, r) => s + r.cnt, 0) || 0

  if (loading) return <div className="page-loading"><div className="spinner" /></div>

  return (
    <div className="admin-dash">
      {/* ── Header ───────────────────────────────────── */}
      <div className="admin-dash-header">
        <div>
          <h1><Shield size={26} /> Admin Dashboard</h1>
          <p className="subtitle">Welcome back, {user?.fullname}</p>
        </div>
        <span className="admin-dash-date">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={16} /> {error}</div>}

      {data && (
        <>
          {/* ── KPI Cards ────────────────────────────── */}
          <div className="admin-kpi-grid">
            <div className="admin-kpi kpi-blue">
              <div className="kpi-top">
                <div className="kpi-icon"><Users size={20} /></div>
              </div>
              <span className="kpi-value">{totalUsers}</span>
              <span className="kpi-label">Total Users</span>
            </div>

            <div className="admin-kpi kpi-cyan">
              <div className="kpi-top">
                <div className="kpi-icon"><UserPlus size={20} /></div>
              </div>
              <span className="kpi-value">{getRoleCount('attorney')}</span>
              <span className="kpi-label">Attorneys</span>
            </div>

            <div className="admin-kpi kpi-green">
              <div className="kpi-top">
                <div className="kpi-icon"><UserCheck size={20} /></div>
              </div>
              <span className="kpi-value">{data.users.active_last_7_days}</span>
              <span className="kpi-label">Active (7 days)</span>
            </div>

            <div className="admin-kpi kpi-gold">
              <div className="kpi-top">
                <div className="kpi-icon"><FileCheck size={20} /></div>
              </div>
              <span className="kpi-value">{data.users.pending_verifications}</span>
              <span className="kpi-label">Pending Verifications</span>
            </div>

            <div className="admin-kpi kpi-purple">
              <div className="kpi-top">
                <div className="kpi-icon"><Briefcase size={20} /></div>
              </div>
              <span className="kpi-value">{data.cases.total}</span>
              <span className="kpi-label">Total Cases</span>
            </div>

            <div className="admin-kpi kpi-green">
              <div className="kpi-top">
                <div className="kpi-icon"><TrendingUp size={20} /></div>
              </div>
              <span className="kpi-value">{getCaseCount('active')}</span>
              <span className="kpi-label">Active Cases</span>
            </div>

            <div className="admin-kpi kpi-rose">
              <div className="kpi-top">
                <div className="kpi-icon"><User size={20} /></div>
              </div>
              <span className="kpi-value">{getRoleCount('client')}</span>
              <span className="kpi-label">Clients</span>
            </div>

            <div className="admin-kpi kpi-cyan">
              <div className="kpi-top">
                <div className="kpi-icon"><Users size={20} /></div>
              </div>
              <span className="kpi-value">{getRoleCount('secretary')}</span>
              <span className="kpi-label">Secretaries</span>
            </div>
          </div>

          {/* ── Nav Shortcuts + Login Stats ──────────── */}
          <div className="admin-dash-cols">
            {/* Quick Navigation */}
            <div>
              <div className="admin-nav-grid">
                <Link to="/admin/users" className="admin-nav-card">
                  <span className="nav-icon"><Users size={18} /></span>
                  User Management
                  <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                </Link>
                <Link to="/admin/verifications" className="admin-nav-card">
                  <span className="nav-icon"><FileCheck size={18} /></span>
                  Verification Queue
                  {data.users.pending_verifications > 0 && (
                    <span className="status-badge icon-gold" style={{ marginLeft: 'auto', fontSize: '0.72rem' }}>
                      {data.users.pending_verifications}
                    </span>
                  )}
                </Link>
                <Link to="/admin/cases" className="admin-nav-card">
                  <span className="nav-icon"><Briefcase size={18} /></span>
                  All Cases
                  <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                </Link>
                <Link to="/admin/audit" className="admin-nav-card">
                  <span className="nav-icon"><Activity size={18} /></span>
                  Audit Logs
                  <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                </Link>
                <Link to="/admin/settings" className="admin-nav-card">
                  <span className="nav-icon"><Settings size={18} /></span>
                  System Settings
                  <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                </Link>
                <Link to="/admin/reports" className="admin-nav-card">
                  <span className="nav-icon"><BarChart3 size={18} /></span>
                  Reports
                  <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                </Link>
                <Link to="/admin/announcements" className="admin-nav-card">
                  <span className="nav-icon"><Megaphone size={18} /></span>
                  Announcements
                  <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                </Link>
                <Link to="/profile" className="admin-nav-card">
                  <span className="nav-icon"><User size={18} /></span>
                  My Profile
                  <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                </Link>
              </div>
            </div>

            {/* Login Stats Panel */}
            <div className="admin-login-panel">
              <h3><Clock size={18} /> Login Activity (Last 24h)</h3>
              <div className="login-stat-bars">
                <div className="login-stat-row">
                  <span className="stat-label">Total</span>
                  <div className="stat-bar">
                    <div
                      className="stat-bar-fill"
                      style={{
                        width: '100%',
                        background: 'var(--accent)',
                      }}
                    />
                  </div>
                  <span className="stat-num">{data.login_stats_24h.total_attempts}</span>
                </div>
                <div className="login-stat-row">
                  <span className="stat-label">Successful</span>
                  <div className="stat-bar">
                    <div
                      className="stat-bar-fill"
                      style={{
                        width: data.login_stats_24h.total_attempts
                          ? `${(data.login_stats_24h.successful / data.login_stats_24h.total_attempts) * 100}%`
                          : '0%',
                        background: '#22c55e',
                      }}
                    />
                  </div>
                  <span className="stat-num" style={{ color: '#22c55e' }}>
                    <CheckCircle size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 3 }} />
                    {data.login_stats_24h.successful}
                  </span>
                </div>
                <div className="login-stat-row">
                  <span className="stat-label">Failed</span>
                  <div className="stat-bar">
                    <div
                      className="stat-bar-fill"
                      style={{
                        width: data.login_stats_24h.total_attempts
                          ? `${(data.login_stats_24h.failed / data.login_stats_24h.total_attempts) * 100}%`
                          : '0%',
                        background: '#ef4444',
                      }}
                    />
                  </div>
                  <span className="stat-num" style={{ color: '#ef4444' }}>
                    <XCircle size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 3 }} />
                    {data.login_stats_24h.failed}
                  </span>
                </div>
              </div>

              {/* User status summary */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Users by Status
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {data.users.by_status.map(s => (
                    <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: s.status === 'active' ? '#22c55e' : s.status === 'suspended' ? '#ef4444' : '#f59e0b',
                      }} />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 600 }}>{s.cnt}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Recent Activity ──────────────────────── */}
          <div className="admin-activity-card">
            <div className="card-header">
              <h3><Activity size={18} /> Recent Activity</h3>
              <Link to="/admin/audit">View all <ChevronRight size={14} style={{ verticalAlign: '-2px' }} /></Link>
            </div>
            <div className="admin-activity-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Action</th>
                    <th>Details</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_activity.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No recent activity</td></tr>
                  )}
                  {data.recent_activity.slice(0, 20).map((a, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {a.user_name || '—'}
                        {' '}
                        <span className={`role-tag role-${a.user_role}`}>{a.user_role}</span>
                      </td>
                      <td><span className="action-badge">{a.action}</span></td>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.details || '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
