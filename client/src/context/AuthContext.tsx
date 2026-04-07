import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { authService, User } from '../services/authService'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  setUser: (user: User | null) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const stored = authService.getCurrentUser()
    if (stored && authService.isAuthenticated()) {
      setUser(stored)
    }
    setLoading(false)
  }, [])

  const logout = async () => {
    await authService.logout()
    setUser(null)
  }

  // ── Idle session timeout ──────────────────────────────────
  useEffect(() => {
    if (!user) return // Only track when logged in

    const resetTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => {
        logout()
      }, IDLE_TIMEOUT_MS)
    }

    const EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'] as const
    EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer() // Start the timer immediately on mount/user change

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      EVENTS.forEach(e => window.removeEventListener(e, resetTimer))
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, loading, setUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
