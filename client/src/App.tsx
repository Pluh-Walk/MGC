import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import AttorneyDashboard from './pages/AttorneyDashboard'
import ClientDashboard from './pages/ClientDashboard'
import Profile from './pages/Profile'
import Cases from './pages/Cases'
import CaseDetail from './pages/CaseDetail'
import Clients from './pages/Clients'
import ClientView from './pages/ClientView'
import Attorneys from './pages/Attorneys'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Hearings from './pages/Hearings'
import Announcements from './pages/Announcements'
import Messages from './pages/Messages'

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
              <ProtectedRoute allowedRoles={['attorney']}>
                <Clients />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients/:id"
            element={
              <ProtectedRoute allowedRoles={['attorney']}>
                <ClientView />
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

          {/* Protected — Both roles */}
          <Route
            path="/cases"
            element={
              <ProtectedRoute>
                <Cases />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:id"
            element={
              <ProtectedRoute>
                <CaseDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hearings"
            element={
              <ProtectedRoute>
                <Hearings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/announcements"
            element={
              <ProtectedRoute>
                <Announcements />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
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

