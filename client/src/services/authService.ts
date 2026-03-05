import api from './api'

export interface RegisterData {
  fullname: string
  username: string
  email: string
  password: string
  confirmPassword: string
  role: 'attorney' | 'client'
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
  role: 'attorney' | 'client'
}

export const authService = {
  register: (data: RegisterData) => api.post('/auth/register', data),

  verifyIBP: (userId: number, file: File) => {
    const fd = new FormData()
    fd.append('userId', String(userId))
    fd.append('ibp_card', file)
    return api.post('/auth/verify-ibp', fd, { headers: { 'Content-Type': undefined } })
  },

  login: async (data: LoginData) => {
    const res = await api.post('/auth/login', data)
    if (res.data.success) {
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
    }
    return res
  },

  logout: () => {
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
}
