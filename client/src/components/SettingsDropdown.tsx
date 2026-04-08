import { useState, useRef, useEffect } from 'react'
import { Settings, UserCircle, LogOut, Sun, Moon, Keyboard } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import UserAvatar from './UserAvatar'
import { toggleTheme } from '../App'

export default function SettingsDropdown() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [isLight, setIsLight] = useState(() =>
    document.documentElement.classList.contains('light-mode')
  )
  const ref = useRef<HTMLDivElement>(null)

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleThemeToggle = () => {
    toggleTheme()
    setIsLight(document.documentElement.classList.contains('light-mode'))
  }

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

          <button
            className="settings-dropdown-item"
            onClick={handleThemeToggle}
          >
            {isLight ? <Moon size={15} /> : <Sun size={15} />}
            {isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          </button>

          <button
            className="settings-dropdown-item"
            onClick={() => {
              setOpen(false)
              // Dispatch '?' keydown to show shortcut help
              window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
            }}
          >
            <Keyboard size={15} />
            Keyboard Shortcuts
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

