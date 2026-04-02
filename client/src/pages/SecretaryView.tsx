import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Scale, ArrowLeft, Mail, Phone, AtSign, Link2,
  UserCircle, AlertCircle,
} from 'lucide-react'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { secretaryApi, profileApi } from '../services/api'

interface SecretaryProfile {
  id: number
  fullname: string
  username: string
  email: string
  phone: string | null
  hired_at: string
  photo_path: string | null
}

function mkInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export default function SecretaryView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<SecretaryProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (!id) return
    secretaryApi.getById(Number(id))
      .then(res => setProfile(res.data.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load profile.'))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <div className="dashboard">
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className="role-badge attorney">Attorney</span>
          <NotificationBell />
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        <button className="btn-back" onClick={() => navigate('/secretary-management')}>
          <ArrowLeft size={16} /> Back to Secretary Management
        </button>

        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : error ? (
          <div className="alert alert-error" style={{ marginTop: '1rem' }}>
            <AlertCircle size={16} /> {error}
          </div>
        ) : profile ? (
          <div style={{ maxWidth: 560, margin: '1.5rem auto 0' }}>
            {/* Profile header card */}
            <div className="admin-activity-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' }}>
              {/* Avatar */}
              <div className="client-profile-avatar" style={{ width: 88, height: 88, fontSize: '2rem' }}>
                {profile.photo_path && !imgError ? (
                  <img
                    src={profileApi.photoUrl(profile.id)}
                    alt={profile.fullname}
                    className="atty-avatar-img"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  mkInitials(profile.fullname)
                )}
              </div>

              {/* Name & username */}
              <div>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>{profile.fullname}</h2>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>@{profile.username}</span>
                <div style={{ marginTop: '0.4rem' }}>
                  <span className="pill pill-active" style={{ fontSize: '0.72rem' }}>Secretary</span>
                </div>
              </div>
            </div>

            {/* Details card */}
            <div className="admin-activity-card" style={{ marginTop: '1rem' }}>
              <div className="card-header" style={{ paddingBottom: '0.5rem' }}>
                <h3><UserCircle size={15} /> Contact & Details</h3>
              </div>
              <div style={{ padding: '0.25rem 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="sec-detail-row" style={{ fontSize: '0.9rem', color: 'var(--text-base)' }}>
                  <Mail size={15} style={{ opacity: 0.6, flexShrink: 0 }} />
                  <span>{profile.email}</span>
                </div>
                {profile.phone && (
                  <div className="sec-detail-row" style={{ fontSize: '0.9rem', color: 'var(--text-base)' }}>
                    <Phone size={15} style={{ opacity: 0.6, flexShrink: 0 }} />
                    <span>{profile.phone}</span>
                  </div>
                )}
                <div className="sec-detail-row" style={{ fontSize: '0.9rem', color: 'var(--text-base)' }}>
                  <AtSign size={15} style={{ opacity: 0.6, flexShrink: 0 }} />
                  <span>{profile.username}</span>
                </div>
                <div className="sec-detail-row" style={{ fontSize: '0.9rem', color: 'var(--text-base)' }}>
                  <Link2 size={15} style={{ opacity: 0.6, flexShrink: 0 }} />
                  <span>Linked on {new Date(profile.hired_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
