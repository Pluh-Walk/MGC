import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../services/authService'

interface Props {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

const dashboardMap: Record<UserRole, string> = {
  attorney:  '/dashboard/attorney',
  client:    '/dashboard/client',
  admin:     '/dashboard/admin',
  secretary: '/dashboard/secretary',
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to={dashboardMap[user.role] || '/login'} replace />
  }

  return <>{children}</>
}
