import { useState, useRef, useEffect } from 'react'
import { Settings, UserCircle, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import UserAvatar from './UserAvatar'

export default function SettingsDropdown() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = user?.fullname
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  return (
    <div className="settings-wrapper" ref={ref}>
      <button
        className={`btn-settings${open ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
      >
        <Settings size={18} />
      </button>

      {open && (
        <div className="settings-dropdown">
          <div className="settings-dropdown-header">
            {user && (
              <UserAvatar
                userId={user.id}
                fullname={user.fullname}
                className="sd-avatar"
              />
            )}
            <div className="sd-user-info">
              <strong>{user?.fullname}</strong>
              <span>@{user?.username}</span>
            </div>
          </div>

          <div className="settings-dropdown-divider" />

          <button
            className="settings-dropdown-item"
            onClick={() => { navigate('/profile'); setOpen(false) }}
          >
            <UserCircle size={15} />
            View Profile
          </button>

          <div className="settings-dropdown-divider" />

          <button
            className="settings-dropdown-item danger"
            onClick={logout}
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      )}
    </div>
  )
}

