import { Scale, FileText, Clock, MessageSquare, HelpCircle, FolderOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'

export default function ClientDashboard() {
  const { user } = useAuth()

  const initials = user?.fullname
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? 'CL'

  return (
    <div className="dashboard">
      {/* Nav */}
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className="role-badge client">Client</span>
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
          <h2>Client Dashboard</h2>
          <p>Track your cases, documents, and communicate with your attorney.</p>
        </div>

        {/* Cards */}
        <div className="dash-grid">
          <div className="dash-card">
            <div className="dash-card-icon icon-blue"><FolderOpen size={20}/></div>
            <h3>My Cases</h3>
            <p>View the status and progress of your active and past legal cases.</p>
          </div>
          <div className="dash-card">
            <div className="dash-card-icon icon-gold"><FileText size={20}/></div>
            <h3>Documents</h3>
            <p>Access legal documents and filings related to your cases.</p>
          </div>
          <div className="dash-card">
            <div className="dash-card-icon icon-green"><Clock size={20}/></div>
            <h3>Appointments</h3>
            <p>View and confirm upcoming meetings and court hearing schedules.</p>
          </div>
          <div className="dash-card">
            <div className="dash-card-icon icon-purple"><MessageSquare size={20}/></div>
            <h3>Messages</h3>
            <p>Send and receive messages from your assigned attorney.</p>
          </div>
          <div className="dash-card">
            <div className="dash-card-icon icon-blue"><HelpCircle size={20}/></div>
            <h3>Support</h3>
            <p>Get help and submit inquiries to the MGC support team.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
