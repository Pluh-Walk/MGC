import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Calendar, MessageSquare, Clock, AlertCircle } from 'lucide-react'
import { profileApi, hearingsApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function SecretaryDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<any>(null)
  const [hearings, setHearings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      profileApi.stats().catch(() => ({ data: { data: null } })),
      hearingsApi.list().catch(() => ({ data: { data: [] } })),
    ])
      .then(([statsRes, hearingsRes]) => {
        setStats(statsRes.data.data)
        setHearings(hearingsRes.data.data?.slice(0, 5) || [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-loading"><div className="spinner" /></div>

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Secretary Dashboard</h1>
          <p className="text-muted">
            Welcome, {user?.fullname}
            {user?.attorney_name && <> — assisting <strong>{user.attorney_name}</strong></>}
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={16} /> {error}</div>}

      {/* Quick Stats */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-icon"><Briefcase size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.active_cases ?? 0}</span>
            <span className="stat-label">Active Cases</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Calendar size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.upcoming_hearings ?? 0}</span>
            <span className="stat-label">Upcoming Hearings</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><MessageSquare size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.clients ?? 0}</span>
            <span className="stat-label">Clients</span>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <Link to="/cases" className="stat-card" style={{ textDecoration: 'none' }}>
          <Briefcase size={18} /> <span>Cases</span>
        </Link>
        <Link to="/hearings" className="stat-card" style={{ textDecoration: 'none' }}>
          <Calendar size={18} /> <span>Hearings</span>
        </Link>
        <Link to="/messages" className="stat-card" style={{ textDecoration: 'none' }}>
          <MessageSquare size={18} /> <span>Messages</span>
        </Link>
        <Link to="/announcements" className="stat-card" style={{ textDecoration: 'none' }}>
          <Clock size={18} /> <span>Announcements</span>
        </Link>
      </div>

      {/* Upcoming Hearings */}
      {hearings.length > 0 && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}><Calendar size={18} /> Upcoming Hearings</h3>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr><th>Title</th><th>Case</th><th>Date</th><th>Location</th></tr>
            </thead>
            <tbody>
              {hearings.map((h: any) => (
                <tr key={h.id}>
                  <td>{h.title}</td>
                  <td>{h.case_number}</td>
                  <td>{new Date(h.scheduled_at).toLocaleString()}</td>
                  <td>{h.location || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
