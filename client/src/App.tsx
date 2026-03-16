import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import AdminUsers from './pages/AdminUsers'
import AdminCases from './pages/AdminCases'
import AdminVerificationQueue from './pages/AdminVerificationQueue'
import AdminAuditLogs from './pages/AdminAuditLogs'
import AdminSettings from './pages/AdminSettings'
import AdminReports from './pages/AdminReports'
import AdminAnnouncements from './pages/AdminAnnouncements'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

