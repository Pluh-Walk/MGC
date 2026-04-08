import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import AttorneyDashboard from './pages/AttorneyDashboard'
import ClientDashboard from './pages/ClientDashboard'
import AdminDashboard from './pages/AdminDashboard'
import SecretaryDashboard from './pages/SecretaryDashboard'
import Profile from './pages/Profile'
import Cases from './pages/Cases'
import CaseDetail from './pages/CaseDetail'
import Clients from './pages/Clients'
import ClientView from './pages/ClientView'
import Attorneys from './pages/Attorneys'
import AttorneyView from './pages/AttorneyView'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Hearings from './pages/Hearings'
import Announcements from './pages/Announcements'
import Messages from './pages/Messages'
import SecretaryRegister from './pages/SecretaryRegister'
import SecretaryManagement from './pages/SecretaryManagement'
import SecretaryView from './pages/SecretaryView'
import AdminUsers from './pages/AdminUsers'
import AdminCases from './pages/AdminCases'
import AdminVerificationQueue from './pages/AdminVerificationQueue'
import AdminAuditLogs from './pages/AdminAuditLogs'
import AdminSettings from './pages/AdminSettings'
import AdminReports from './pages/AdminReports'
import AdminAnnouncements from './pages/AdminAnnouncements'
import Templates from './pages/Templates'
import AttorneyReports from './pages/AttorneyReports'
import SurveyPage from './pages/SurveyPage'
import MaintenanceBanner from './components/MaintenanceBanner'
import GlobalSearch from './components/GlobalSearch'
import ImpersonationBanner from './components/ImpersonationBanner'

// ── Dark/Light mode bootstrap ──────────────────────────────────────
function applyTheme(light: boolean) {
  if (light) { document.documentElement.classList.add('light-mode') }
  else        { document.documentElement.classList.remove('light-mode') }
}

export function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light-mode')
  localStorage.setItem('theme', isLight ? 'light' : 'dark')
}

// ── Keyboard Shortcuts (must be inside BrowserRouter) ─────────────
const SHORTCUTS = [
  { key: 'N',   description: 'New case' },
  { key: 'M',   description: 'Go to Messages' },
  { key: 'H',   description: 'Go to Hearings' },
  { key: '/',   description: 'Focus global search' },
  { key: '?',   description: 'Show this help' },
  { key: 'Esc', description: 'Close modal / go back' },
]

function KeyboardShortcuts() {
  const navigate = useNavigate()
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement).isContentEditable) return

      if (e.key === '?') { setShowHelp(h => !h); return }
      if (e.key === 'Escape') { setShowHelp(false); return }
      if (e.key === '/') {
        e.preventDefault()
        const searchBtn = document.querySelector('[data-global-search-trigger]') as HTMLElement | null
        if (searchBtn) searchBtn.click()
        return
      }
      if (e.key.toLowerCase() === 'n') {
        // Navigate to cases with new=1 param to auto-open create modal
        navigate('/cases?new=1')
        return
      }
      if (e.key.toLowerCase() === 'm') { navigate('/messages'); return }
      if (e.key.toLowerCase() === 'h') { navigate('/hearings');  return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  if (!showHelp) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.6)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
      onClick={() => setShowHelp(false)}
    >
      <div
        style={{
          background: 'var(--surface-solid)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '28px 32px', minWidth: 320,
          boxShadow: 'var(--shadow)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 18, color: 'var(--text)' }}>
          Keyboard Shortcuts
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {SHORTCUTS.map(s => (
              <tr key={s.key}>
                <td style={{ padding: '6px 12px 6px 0' }}>
                  <kbd style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 4, padding: '2px 8px', fontFamily: 'monospace',
                    fontSize: '0.85rem', color: 'var(--accent)',
                  }}>{s.key}</kbd>
                </td>
                <td style={{ padding: '6px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {s.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 16, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Press <kbd style={{ fontFamily: 'monospace', padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 3 }}>Esc</kbd> or click outside to close
        </div>
      </div>
    </div>
  )
}

function App() {
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light') {
      applyTheme(true)
    } else if (!saved) {
      // Respect system preference if no saved preference
      applyTheme(window.matchMedia('(prefers-color-scheme: light)').matches)
    }
    // Listen for system preference changes
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) applyTheme(e.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <ImpersonationBanner />
        <MaintenanceBanner />
        <GlobalSearch globalOnly />
        <KeyboardShortcuts />
        <Routes>
          {/* Landing */}
          <Route path="/" element={<Landing />} />

          {/* Public */}
          <Route path="/login"            element={<Login />} />
          <Route path="/register"         element={<Register />} />
          <Route path="/forgot-password"  element={<ForgotPassword />} />
          <Route path="/reset-password"   element={<ResetPassword />} />
          <Route path="/secretary/register" element={<SecretaryRegister />} />

          {/* Protected — Attorney only */}
          <Route
            path="/dashboard/attorney"
            element={
              <ProtectedRoute allowedRoles={['attorney']}>
                <AttorneyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute allowedRoles={['attorney', 'secretary']}>
                <Clients />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients/:id"
            element={
              <ProtectedRoute allowedRoles={['attorney', 'secretary']}>
                <ClientView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/secretary-management"
            element={
              <ProtectedRoute allowedRoles={['attorney']}>
                <SecretaryManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/secretaries/:id"
            element={
              <ProtectedRoute allowedRoles={['attorney']}>
                <SecretaryView />
              </ProtectedRoute>
            }
          />

          {/* Protected — Client only */}
          <Route
            path="/dashboard/client"
            element={
              <ProtectedRoute allowedRoles={['client']}>
                <ClientDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attorneys"
            element={
              <ProtectedRoute allowedRoles={['client']}>
                <Attorneys />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attorneys/:id"
            element={
              <ProtectedRoute allowedRoles={['client']}>
                <AttorneyView />
              </ProtectedRoute>
            }
          />

          {/* Protected — Admin (nested layout with sidebar) */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/cases" element={<AdminCases />} />
            <Route path="/admin/verifications" element={<AdminVerificationQueue />} />
            <Route path="/admin/audit" element={<AdminAuditLogs />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/announcements" element={<AdminAnnouncements />} />
          </Route>

          {/* Protected — Secretary only */}
          <Route
            path="/dashboard/secretary"
            element={
              <ProtectedRoute allowedRoles={['secretary']}>
                <SecretaryDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected — Multiple roles */}
          <Route
            path="/cases"
            element={
              <ProtectedRoute allowedRoles={['attorney', 'client', 'secretary']}>
                <Cases />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:id"
            element={
              <ProtectedRoute allowedRoles={['attorney', 'client', 'secretary']}>
                <CaseDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hearings"
            element={
              <ProtectedRoute allowedRoles={['attorney', 'client', 'secretary']}>
                <Hearings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/announcements"
            element={
              <ProtectedRoute allowedRoles={['attorney', 'client', 'secretary', 'admin']}>
                <Announcements />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute allowedRoles={['attorney', 'client', 'secretary']}>
                <Messages />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={['attorney']}>
                <AttorneyReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates"
            element={
              <ProtectedRoute allowedRoles={['attorney', 'secretary', 'admin']}>
                <Templates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* Public survey (no auth required) */}
          <Route path="/survey/:token" element={<SurveyPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

