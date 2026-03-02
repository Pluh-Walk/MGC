import { useNavigate } from 'react-router-dom'
import {
  Scale,
  ArrowLeft,
  UserCircle,
  Mail,
  AtSign,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'

export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const initials = user?.fullname
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  const dashPath =
    user?.role === 'attorney' ? '/dashboard/attorney' : '/dashboard/client'

  return (
    <div className="dashboard">
      {/* Nav */}
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className={`role-badge ${user?.role}`}>
            {user?.role === 'attorney' ? 'Attorney' : 'Client'}
          </span>
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        {/* Back button */}
        <button className="btn-back" onClick={() => navigate(dashPath)}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <div className="profile-page">
          {/* Hero card */}
          <div className="profile-hero-card">
            <div className="profile-hero-avatar">{initials}</div>
            <h1 className="profile-hero-name">{user?.fullname}</h1>
            <span className={`role-badge ${user?.role}`} style={{ marginTop: '0.35rem' }}>
              {user?.role === 'attorney' ? 'Attorney' : 'Client'}
            </span>
          </div>

          {/* Info cards */}
          <div className="profile-info-grid">
            <div className="profile-info-card">
              <div className="profile-info-icon icon-gold">
                <UserCircle size={20} />
              </div>
              <div className="profile-info-body">
                <label>Full Name</label>
                <span>{user?.fullname}</span>
              </div>
            </div>

            <div className="profile-info-card">
              <div className="profile-info-icon icon-blue">
                <AtSign size={20} />
              </div>
              <div className="profile-info-body">
                <label>Username</label>
                <span>@{user?.username}</span>
              </div>
            </div>

            <div className="profile-info-card">
              <div className="profile-info-icon icon-green">
                <Mail size={20} />
              </div>
              <div className="profile-info-body">
                <label>Email Address</label>
                <span>{user?.email}</span>
              </div>
            </div>

            <div className="profile-info-card">
              <div className="profile-info-icon icon-purple">
                <ShieldCheck size={20} />
              </div>
              <div className="profile-info-body">
                <label>Role</label>
                <span style={{ textTransform: 'capitalize' }}>{user?.role}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
