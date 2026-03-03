import { Scale, FileText, Users, Calendar, MessageSquare, Briefcase, Megaphone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'

export default function AttorneyDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const initials = user?.fullname
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? 'AT'

  return (
    <div className="dashboard">
      {/* Nav */}
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
        {/* User Info */}
        <div className="user-info-row">
          <div className="user-avatar">{initials}</div>
          <div className="user-meta">
            <strong>{user?.fullname}</strong>
            <span>@{user?.username} · {user?.email}</span>
          </div>
        </div>

        {/* Hero */}
        <div className="dash-hero">
          <h2>Attorney Dashboard</h2>
          <p>Manage your cases, clients, and calendar from one place.</p>
        </div>

        {/* Cards */}
        <div className="dash-grid">
          <div className="dash-card" onClick={() => navigate('/cases')} style={{ cursor: 'pointer' }}>
            <div className="dash-card-icon icon-gold"><Briefcase size={20}/></div>
            <h3>My Cases</h3>
            <p>View and manage all active and archived legal cases assigned to you.</p>
          </div>
          <div className="dash-card" onClick={() => navigate('/clients')} style={{ cursor: 'pointer' }}>
            <div className="dash-card-icon icon-blue"><Users size={20}/></div>
            <h3>Clients</h3>
            <p>Access your client roster, contact details, and case history.</p>
          </div>
          <div className="dash-card" onClick={() => navigate('/hearings')} style={{ cursor: 'pointer' }}>
            <div className="dash-card-icon icon-green"><Calendar size={20}/></div>
            <h3>Calendar &amp; Hearings</h3>
            <p>Schedule and track court hearings, meetings, and deadlines.</p>
          </div>
          <div className="dash-card" onClick={() => navigate('/cases')} style={{ cursor: 'pointer' }}>
            <div className="dash-card-icon icon-blue"><FileText size={20}/></div>
            <h3>Documents</h3>
            <p>Upload, review, and manage legal documents and filings.</p>
          </div>
          <div className="dash-card" onClick={() => navigate('/messages')} style={{ cursor: 'pointer' }}>
            <div className="dash-card-icon icon-purple"><MessageSquare size={20}/></div>
            <h3>Messages</h3>
            <p>Communicate securely with clients and colleagues.</p>
          </div>
          <div className="dash-card" onClick={() => navigate('/announcements')} style={{ cursor: 'pointer' }}>
            <div className="dash-card-icon icon-gold"><Megaphone size={20}/></div>
            <h3>Announcements</h3>
            <p>Post firm-wide or case-specific notices for your clients.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
