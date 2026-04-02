import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, Users, Search, Loader2,
  Briefcase, MapPin, Mail, BadgeCheck,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { casesApi, profileApi } from '../services/api'

interface Client {
  id: number
  fullname: string
  username: string
  email: string
  phone: string | null
  address: string | null
  occupation: string | null
  id_verified: number
}

export default function Clients() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [clients,  setClients]  = useState<Client[]>([])
  const [filtered, setFiltered] = useState<Client[]>([])
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({})

  useEffect(() => {
    casesApi.clientList()
      .then(res => { setClients(res.data.data); setFiltered(res.data.data) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      clients.filter(c =>
        c.fullname.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        (c.occupation ?? '').toLowerCase().includes(q)
      )
    )
  }, [search, clients])

  return (
    <div className="dashboard">
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className={`role-badge ${user?.role}`}>{user?.role === 'secretary' ? 'Secretary' : 'Attorney'}</span>
          <NotificationBell />
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        <button className="btn-back" onClick={() => navigate(user?.role === 'secretary' ? '/dashboard/secretary' : '/dashboard/attorney')}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div className="page-header-row">
          <div>
            <h2>Clients</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {filtered.length} registered client{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="filter-row">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              placeholder="Search by name, email, username, or occupation…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-state"><Loader2 size={32} className="spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Users size={48} className="empty-icon" />
            <p>No clients found.</p>
          </div>
        ) : (
          <div className="atty-dir-page-grid">
            {filtered.map(c => {
              const initials = c.fullname.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
              return (
                <div
                  key={c.id}
                  className="atty-dir-card client-dir-card"
                  onClick={() => navigate(`/clients/${c.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="atty-dir-avatar" style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5a9e)' }}>
                    {imgErrors[c.id]
                      ? <span>{initials}</span>
                      : <img
                          src={profileApi.photoUrl(c.id)}
                          alt={c.fullname}
                          onError={() => setImgErrors(prev => ({ ...prev, [c.id]: true }))}
                        />}
                    {c.id_verified === 1 && (
                      <span className="atty-dir-avail-dot" style={{ background: '#22c55e' }} title="ID Verified" />
                    )}
                  </div>

                  <div className="atty-dir-info">
                    <div className="atty-dir-name">
                      {c.fullname}
                      {c.id_verified === 1 && (
                        <BadgeCheck size={14} style={{ color: '#22c55e', marginLeft: '0.3rem', verticalAlign: 'middle' }} />
                      )}
                    </div>
                    <div className="atty-dir-firm">
                      <Mail size={12} />
                      {c.email}
                    </div>
                    {c.occupation && (
                      <div className="atty-dir-exp">
                        <Briefcase size={12} /> {c.occupation}
                      </div>
                    )}
                    {c.address && (
                      <div className="atty-dir-exp">
                        <MapPin size={12} /> {c.address}
                      </div>
                    )}
                    <div className="atty-dir-specs" style={{ marginTop: '0.45rem' }}>
                      <span className="atty-dir-spec-chip">@{c.username}</span>
                      {c.phone && <span className="atty-dir-spec-chip">{c.phone}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

