import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, Users, Search, Award, Star, Loader2,
} from 'lucide-react'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { profileApi } from '../services/api'

interface Attorney {
  id: number
  fullname: string
  law_firm: string | null
  specializations: string | null
  years_experience: number | null
  availability: string | null
  photo_path: string | null
}

const AVAIL_COLOR: Record<string, string> = {
  available: '#22c55e',
  in_court:  '#f59e0b',
  offline:   '#ef4444',
}
const AVAIL_LABEL: Record<string, string> = {
  available: 'Available',
  in_court:  'In Court',
  offline:   'Offline',
}

export default function Attorneys() {
  const navigate = useNavigate()
  const [attorneys, setAttorneys] = useState<Attorney[]>([])
  const [filtered,  setFiltered]  = useState<Attorney[]>([])
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({})

  useEffect(() => {
    profileApi.listAttorneys()
      .then(r => { setAttorneys(r.data.data); setFiltered(r.data.data) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      attorneys.filter(a =>
        !q
        || a.fullname.toLowerCase().includes(q)
        || (a.specializations ?? '').toLowerCase().includes(q)
        || (a.law_firm ?? '').toLowerCase().includes(q)
      )
    )
  }, [search, attorneys])

  return (
    <div className="dashboard">
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className="role-badge client">Client</span>
          <NotificationBell />
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        <button className="btn-back" onClick={() => navigate('/dashboard/client')}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div className="page-header-row">
          <div>
            <h2>Attorney Directory</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {filtered.length} verified attorney{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="filter-row">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              placeholder="Search by name, specialization, or law firm…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <Loader2 size={32} className="spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Users size={48} className="empty-icon" />
            <p>No attorneys found.</p>
          </div>
        ) : (
          <div className="atty-dir-page-grid">
            {filtered.map(a => {
              const initials = a.fullname.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
              const avail = a.availability ?? 'offline'
              const specs = a.specializations
                ? a.specializations.split(',').map(s => s.trim()).filter(Boolean)
                : []
              return (
                <div key={a.id} className="atty-dir-card">
                  <div className="atty-dir-avatar">
                    {!imgErrors[a.id] ? (
                      <img
                        src={profileApi.photoUrl(a.id)}
                        alt={a.fullname}
                        onError={() => setImgErrors(prev => ({ ...prev, [a.id]: true }))}
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                    <span
                      className="atty-dir-avail-dot"
                      style={{ background: AVAIL_COLOR[avail] ?? '#ef4444' }}
                      title={AVAIL_LABEL[avail] ?? 'Offline'}
                    />
                  </div>

                  <div className="atty-dir-info">
                    <div className="atty-dir-name">{a.fullname}</div>
                    {a.law_firm && (
                      <div className="atty-dir-firm">
                        <Award size={12} /> {a.law_firm}
                      </div>
                    )}
                    {a.years_experience != null && (
                      <div className="atty-dir-exp">
                        <Star size={12} /> {a.years_experience} yr{a.years_experience !== 1 ? 's' : ''} of experience
                      </div>
                    )}
                    {specs.length > 0 && (
                      <div className="atty-dir-specs">
                        {specs.map(s => (
                          <span key={s} className="atty-dir-spec-chip">{s}</span>
                        ))}
                      </div>
                    )}
                    <div className="atty-dir-avail-label" style={{ color: AVAIL_COLOR[avail] ?? '#ef4444' }}>
                      <span className="avail-dot" style={{ background: AVAIL_COLOR[avail] ?? '#ef4444' }} />
                      {AVAIL_LABEL[avail] ?? 'Offline'}
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
