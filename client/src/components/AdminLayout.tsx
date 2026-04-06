import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileCheck,
  Activity,
  Settings,
  BarChart3,
  Megaphone,
  Scale,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'
import UserAvatar from './UserAvatar'
import GlobalSearch from './GlobalSearch'

const navItems = [
  { to: '/dashboard/admin',      icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users',          icon: Users,           label: 'Users' },
  { to: '/admin/verifications',  icon: FileCheck,       label: 'Verifications' },
  { to: '/admin/cases',          icon: Briefcase,       label: 'Cases' },
  { to: '/admin/audit',          icon: Activity,        label: 'Audit Logs' },
  { to: '/admin/settings',       icon: Settings,        label: 'Settings' },
  { to: '/admin/reports',        icon: BarChart3,       label: 'Reports' },
  { to: '/admin/announcements',  icon: Megaphone,       label: 'Announcements' },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="admin-layout">
      {/* Top nav bar */}
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className="role-badge admin">Admin</span>
          <GlobalSearch />
          <NotificationBell />
          <button className="icon-btn" onClick={handleLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <div className="admin-body">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div className="sidebar-user">
            <UserAvatar
              userId={user!.id}
              fullname={user!.fullname}
              className="user-avatar"
            />
            <div className="user-meta">
              <strong>{user?.fullname}</strong>
              <span>Administrator</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard/admin'}
                className={({ isActive }) =>
                  `sidebar-btn${isActive ? ' active' : ''}`
                }
              >
                <item.icon size={17} />
                <span className="sidebar-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
          </div>
        </aside>

        {/* Page content */}
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
