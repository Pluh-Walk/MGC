import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Scale, ArrowLeft, UserCircle, Mail, AtSign, Phone, MapPin,
  Briefcase, BadgeCheck, CheckCircle2,
  Clock, Users, Calendar, MessageSquare,
  CreditCard, Heart, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { profileApi } from '../services/api'

type ViewTab = 'info' | 'cases'

interface ClientProfile {
  id: number
  fullname: string
  username: string
  email: string
  created_at: string
  id_verified: number
  phone: string | null
  address: string | null
  date_of_birth: string | null
  occupation: string | null
  notes: string | null
  id_type: string | null
  id_number: string | null
  emergency_contact: string | null
  attorney_id: number | null
  attorney_name: string | null
  attorney_photo: string | null
  assigned_attorney_id: number | null
}

interface ClientCase {
  id: number
  case_number: string
  title: string
  case_type: string
  status: string
  filing_date: string | null
  attorney_name: string | null
}

const STATUS_COLORS: Record<string, string> = {
  active:    '#22c55e',
  pending:   '#f59e0b',
  closed:    '#6b7280',
  dismissed: '#ef4444',
  settled:   '#3b82f6',
}

function mkInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
    .toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function ClientView() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ClientProfile | null>(null)
  const [cases,   setCases]   = useState<ClientCase[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<ViewTab>('info')

  const [imgError,   setImgError]   = useState(false)
  const [attyImgErr, setAttyImgErr] = useState(false)

  useEffect(() => {
    if (!id) return
    const numId = Number(id)
    Promise.all([
      profileApi.getClient(numId),
      profileApi.getClientCases(numId),
    ])
      .then(([profRes, casesRes]) => {
        const p = profRes.data.data as ClientProfile
        setProfile(p)
        setCases(casesRes.data.data as ClientCase[])
      })
      .catch(() => navigate('/clients'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="dashboard">
        <nav className="dash-nav">
          <div className="dash-nav-brand"><Scale size={22} className="nav-icon" />MGC Law System</div>
        </nav>
        <main className="dash-content">
          <div className="loading-state">Loading client profile…</div>
        </main>
      </div>
    )
  }

  if (!profile) return null

  const activeCases  = cases.filter((c) => c.status === 'active').length
  const closedCases  = cases.filter((c) => ['closed', 'settled', 'dismissed'].includes(c.status)).length
  const pendingCases = cases.filter((c) => c.status === 'pending').length

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
        <button className="btn-back" onClick={() => navigate('/clients')}>
          <ArrowLeft size={16} />Back to Clients
        </button>

        <div className="atty-profile-layout">

          {/* ════ SIDEBAR ════ */}
          <aside className="atty-sidebar">

            {/* Hero Card */}
            <div className="atty-hero-card">
              <div className="atty-avatar-wrap">
                <div className="atty-avatar">
                  {imgError
                    ? <span className="atty-avatar-initials">{mkInitials(profile.fullname)}</span>
                    : <img
                        src={profileApi.photoUrl(profile.id)}
                        alt={profile.fullname}
                        className="atty-avatar-img"
                        onError={() => setImgError(true)}
                      />}
                </div>
              </div>
              <h2 className="atty-hero-name">{profile.fullname}</h2>
              <div className="atty-hero-badges">
                <span className="role-badge client">Client</span>
                {profile.id_verified === 1 && (
                  <span className="atty-verified-badge"><BadgeCheck size={12} /> Verified</span>
                )}
              </div>
              {profile.occupation && <p className="atty-hero-firm">{profile.occupation}</p>}
              <div className="client-consult-status">
                <span className="avail-dot" style={{ background: '#22c55e' }} />
                Active Client
              </div>
            </div>

            {/* Assigned Attorney */}
            <div className={`client-attorney-card${profile.attorney_name ? '' : ' unassigned'}`}>
              <p className="client-attorney-label"><Users size={13} /> Assigned Attorney</p>
              {profile.attorney_name ? (
                <>
                  <div className="client-attorney-info">
                    <div className="client-attorney-avatar">
                      {profile.attorney_id && !attyImgErr ? (
                        <img
                          src={profileApi.photoUrl(profile.attorney_id)}
                          alt={profile.attorney_name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                          onError={() => setAttyImgErr(true)}
                        />
                      ) : (
                        mkInitials(profile.attorney_name)
                      )}
                    </div>
                    <div className="client-attorney-details">
                      <strong>{profile.attorney_name}</strong>
                    </div>
                  </div>
                  <button
                    className="quick-action-btn"
                    style={{ marginTop: '0.5rem', width: '100%' }}
                    onClick={() => navigate('/messages')}
                  >
                    <MessageSquare size={13} /> Message Client
                  </button>
                </>
              ) : (
                <p className="client-attorney-none">No attorney assigned yet.</p>
              )}
            </div>

          </aside>

          {/* ════ MAIN CONTENT ════ */}
          <div className="atty-main">

            {/* Tabs */}
            <div className="atty-tabs">
              {([
                { id: 'info',  icon: <UserCircle size={15} />, label: 'Personal Info' },
                { id: 'cases', icon: <Briefcase  size={15} />, label: 'Cases'         },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  className={`atty-tab${tab === t.id ? ' active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* ── PERSONAL INFO TAB ── */}
            {tab === 'info' && (
              <div className="atty-section">
                <div className="atty-section-header">
                  <h3><UserCircle size={18} /> Personal &amp; Legal Information</h3>
                </div>

                <div className="atty-form-grid">
                  <div className="atty-field">
                    <label><UserCircle size={14} /> Full Name</label>
                    <span>{profile.fullname}</span>
                  </div>
                  <div className="atty-field">
                    <label><Phone size={14} /> Contact Number</label>
                    <span>{profile.phone || '—'}</span>
                  </div>
                  <div className="atty-field">
                    <label><Calendar size={14} /> Date of Birth</label>
                    <span>{fmtDate(profile.date_of_birth)}</span>
                  </div>
                  <div className="atty-field">
                    <label><Briefcase size={14} /> Occupation</label>
                    <span>{profile.occupation || '—'}</span>
                  </div>
                  <div className="atty-field">
                    <label><CreditCard size={14} /> Government ID Type</label>
                    <span>{profile.id_type || '—'}</span>
                  </div>
                  <div className="atty-field">
                    <label><BadgeCheck size={14} /> ID Number</label>
                    <span>{profile.id_number || '—'}</span>
                  </div>
                  <div className="atty-field full-width">
                    <label><Heart size={14} /> Emergency Contact</label>
                    <span>{profile.emergency_contact || '—'}</span>
                  </div>
                  <div className="atty-field full-width">
                    <label><MapPin size={14} /> Address</label>
                    <span>{profile.address || '—'}</span>
                  </div>
                </div>

                <div className="atty-identity-row">
                  <div><AtSign size={13} /> <strong>@{profile.username}</strong></div>
                  <div><Mail size={13} /> {profile.email}</div>
                  <div><Clock size={13} /> Member since {new Date(profile.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            )}

            {/* ── CASES TAB ── */}
            {tab === 'cases' && (
              <>
                <div className="atty-section">
                  <div className="atty-section-header">
                    <h3><Briefcase size={18} /> Legal Cases</h3>
                  </div>
                  <div className="client-case-stats-grid">
                    <div className="client-stat-card">
                      <Briefcase size={20} className="stat-icon gold" />
                      <strong>{activeCases}</strong>
                      <span>Active Cases</span>
                    </div>
                    <div className="client-stat-card">
                      <CheckCircle2 size={20} className="stat-icon green" />
                      <strong>{closedCases}</strong>
                      <span>Completed</span>
                    </div>
                    <div className="client-stat-card">
                      <Clock size={20} className="stat-icon purple" />
                      <strong>{pendingCases}</strong>
                      <span>Pending Review</span>
                    </div>
                  </div>
                </div>

                <div className="atty-section">
                  {cases.length === 0 ? (
                    <p className="empty-state-sm">No cases on record for this client.</p>
                  ) : (
                    <div className="cases-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Case No.</th>
                            <th>Title</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Filed</th>
                            <th>Attorney</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {cases.map((c) => (
                            <tr
                              key={c.id}
                              className="table-row-link"
                              onClick={() => navigate(`/cases/${c.id}`)}
                            >
                              <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{c.case_number}</td>
                              <td><strong>{c.title}</strong></td>
                              <td>{c.case_type}</td>
                              <td>
                                <span style={{
                                  color: STATUS_COLORS[c.status] ?? 'var(--text-muted)',
                                  fontWeight: 600,
                                  fontSize: '0.83rem',
                                }}>
                                  {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                                </span>
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{fmtDate(c.filing_date)}</td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{c.attorney_name || '—'}</td>
                              <td style={{ textAlign: 'right' }}>
                                <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>{/* end atty-main */}
        </div>{/* end atty-profile-layout */}
      </main>
    </div>
  )
}
