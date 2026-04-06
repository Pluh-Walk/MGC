import api from './api'

export type UserRole = 'attorney' | 'client' | 'admin' | 'secretary'

export interface RegisterData {
  fullname: string
  username: string
  email: string
  password: string
  confirmPassword: string
  role: 'attorney' | 'client'
}

export interface SecretaryRegisterData {
  token: string
  fullname: string
  username: string
  password: string
  confirmPassword: string
  phone?: string
}

export interface LoginData {
  identifier: string
  password: string
}

export interface User {
  id: number
  fullname: string
  username: string
  email: string
  role: UserRole
  status?: string
  attorney_id?: number
  attorney_name?: string
}

export const authService = {
  register: (data: RegisterData) => api.post('/auth/register', data),

  verifyIBP: (userId: number, file: File) => {
    const fd = new FormData()
    fd.append('userId', String(userId))
    fd.append('ibp_card', file)
    return api.post('/auth/verify-ibp', fd, { headers: { 'Content-Type': undefined } })
  },

  verifyClientID: (userId: number, file: File) => {
    const fd = new FormData()
    fd.append('userId', String(userId))
    fd.append('id_image', file)
    return api.post('/auth/verify-client-id', fd, { headers: { 'Content-Type': undefined } })
  },

  login: async (data: LoginData) => {
    const res = await api.post('/auth/login', data)
    if (res.data.success) {
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
    }
    return res
  },

  logout: async () => {
    try {
      // Revoke the refresh token cookie server-side before clearing local state
      await api.post('/auth/logout')
    } catch { /* best-effort — clear local state regardless */ }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
  },

  getMe: () => api.get('/auth/me'),

  getCurrentUser: (): User | null => {
    const raw = localStorage.getItem('user')
    return raw ? (JSON.parse(raw) as User) : null
  },

  isAuthenticated: () => !!localStorage.getItem('token'),

  verify2FA: async (challengeToken: string, otp: string) => {
    const res = await api.post('/auth/verify-2fa', { challenge_token: challengeToken, otp })
    if (res.data.success) {
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
    }
    return res
  },

  // Secretary invitation-based registration
  validateInvitation: (token: string) =>
    api.get('/secretaries/invite/validate', { params: { token } }),

  registerSecretary: (data: SecretaryRegisterData) =>
    api.post('/secretaries/register', data),
}
