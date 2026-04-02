import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401/403 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    if (err.response?.status === 403) {
      // Account suspended or inactive — clear session and redirect
      const msg = err.response?.data?.message || ''
      if (msg.includes('suspended') || msg.includes('inactive')) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ─── Cases ────────────────────────────────────────────────
export const casesApi = {
  list: (params?: { status?: string; search?: string; page?: number }) =>
    api.get('/cases', { params }),
  get: (id: number) => api.get(`/cases/${id}`),
  create: (data: object) => api.post('/cases', data),
  update: (id: number, data: object) => api.put(`/cases/${id}`, data),
  delete: (id: number) => api.delete(`/cases/${id}`),
  addNote: (id: number, data: { content: string; is_private: boolean }) =>
    api.post(`/cases/${id}/notes`, data),
  clientList: () => api.get('/cases/clients'),
  drafts: () => api.get('/cases/drafts'),
  approveDraft: (id: number) => api.put(`/cases/${id}/approve`, {}),
}

// ─── Profile ──────────────────────────────────────────────
export const profileApi = {
  me: () => api.get('/profile/me'),
  updateMe: (data: object) => api.put('/profile/me', data),
  getClient: (id: number) => api.get(`/profile/clients/${id}`),
  getClientCases: (id: number) => api.get(`/profile/clients/${id}/cases`),
  updateClient: (id: number, data: object) => api.put(`/profile/clients/${id}`, data),
  getAttorney: (id: number) => api.get(`/profile/attorneys/${id}`),
  getAttorneyPublicStats: (id: number) => api.get(`/profile/attorneys/${id}/stats`),
  listAttorneys: () => api.get('/profile/attorneys'),
  // Attorney-specific
  stats:      () => api.get('/profile/attorney/stats'),
  activity:   () => api.get('/profile/attorney/activity'),
  // Client-specific
  clientStats:     () => api.get('/profile/client/stats'),
  clientActivity:  () => api.get('/profile/client/activity'),
  clientDocuments: () => api.get('/profile/client/documents'),
  clientUploadDoc: (caseId: number, file: File) => {
    const fd = new FormData()
    fd.append('case_id', String(caseId))
    fd.append('file', file)
    return api.post('/profile/client/documents', fd, { headers: { 'Content-Type': undefined } })
  },
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/profile/password', data),
  uploadPhoto: (file: File) => {
    const fd = new FormData()
    fd.append('photo', file)
    return api.post('/profile/photo', fd, { headers: { 'Content-Type': undefined } })
  },
  photoUrl: (userId: number) => `/api/profile/photo/${userId}`,
}

// ─── Reviews ───────────────────────────────────
export const reviewsApi = {
  getAttorneyReviews: (attorneyId: number) => api.get(`/reviews/attorneys/${attorneyId}`),
  getMyReview:        (attorneyId: number) => api.get(`/reviews/attorneys/${attorneyId}/mine`),
  submitReview:       (attorneyId: number, data: { rating: number; comment: string }) =>
    api.post(`/reviews/attorneys/${attorneyId}`, data),
  deleteReview:       (attorneyId: number) => api.delete(`/reviews/attorneys/${attorneyId}`),
}

// ─── Documents ────────────────────────────────────────────
export const documentsApi = {
  list: (caseId: number) => api.get(`/cases/${caseId}/documents`),
  upload: (caseId: number, formData: FormData) =>
    api.post(`/cases/${caseId}/documents`, formData, {
      headers: { 'Content-Type': undefined },
    }),
  downloadUrl: (id: number) => `/api/documents/${id}/download`,
  download: (id: number) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  delete: (id: number) => api.delete(`/documents/${id}`),
}

// ─── Notifications ──────────────────────────────────────────────
export const notificationsApi = {
  list:         () => api.get('/notifications'),
  markAllRead:  () => api.put('/notifications/read-all'),
  markOneRead:  (id: number) => api.put(`/notifications/${id}/read`),
}

// ─── Hearings ──────────────────────────────────────────────────
export const hearingsApi = {
  list:   ()                       => api.get('/hearings'),
  create: (data: object)           => api.post('/hearings', data),
  update: (id: number, data: object) => api.put(`/hearings/${id}`, data),
  delete: (id: number)             => api.delete(`/hearings/${id}`),
}

// ─── Announcements ────────────────────────────────────────────
export const announcementsApi = {
  list:   ()                   => api.get('/announcements'),
  create: (data: object)       => api.post('/announcements', data),
  delete: (id: number)         => api.delete(`/announcements/${id}`),
}

// ─── Messages ───────────────────────────────────────────────────
export const messagesApi = {
  conversations: () => api.get('/messages'),
  thread:        (partnerId: number) => api.get(`/messages/${partnerId}`),

  send: (data: { receiver_id: number; content?: string; case_id?: number; attachment?: File | null }) => {
    if (data.attachment) {
      const fd = new FormData()
      fd.append('receiver_id', String(data.receiver_id))
      if (data.content)  fd.append('content', data.content)
      if (data.case_id)  fd.append('case_id', String(data.case_id))
      fd.append('attachment', data.attachment)
      // Set Content-Type to undefined so axios removes the instance-level
      // 'application/json' default and lets the browser set
      // 'multipart/form-data; boundary=...' automatically.
      return api.post('/messages', fd, { headers: { 'Content-Type': undefined } })
    }
    return api.post('/messages', data)
  },

  editMessage: (id: number, content: string) =>
    api.put(`/messages/${id}`, { content }),

  deleteMessage: (id: number, type: 'for_me' | 'for_everyone') =>
    api.delete(`/messages/${id}`, { data: { type } }),

  deleteConversation: (partnerId: number) =>
    api.delete(`/messages/conversation/${partnerId}`),

  contacts: () => api.get('/messages/contacts'),

  getAttachment: (id: number) =>
    api.get(`/messages/${id}/attachment`, { responseType: 'blob' }),

  attachmentUrl: (id: number) => {
    const token = localStorage.getItem('token') ?? ''
    return `/api/messages/${id}/attachment?token=${encodeURIComponent(token)}`
  },
}

// ─── Password Reset ───────────────────────────────────────
export const passwordResetApi = {
  request: (email: string) => api.post('/password-reset/request', { email }),
  reset: (token: string, password: string, confirmPassword: string) =>
    api.post('/password-reset/reset', { token, password, confirmPassword }),
}

// ─── Secretary Management (Attorney-side) ─────────────────
export const secretaryApi = {
  invite:  (email: string) => api.post('/secretaries/invite', { email }),
  list:    () => api.get('/secretaries'),
  getById: (id: number) => api.get(`/secretaries/${id}`),
  remove:  (id: number) => api.put(`/secretaries/${id}/remove`),
  revokeInvite: (id: number) => api.delete(`/secretaries/invite/${id}`),
  getAttorneyInfo: () => api.get('/secretaries/attorney-info'),
}

// ─── Admin: Dashboard & Users ─────────────────────────────
export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),

  // Users
  listUsers:       (params?: object) => api.get('/admin/users', { params }),
  getUser:         (id: number) => api.get(`/admin/users/${id}`),
  createUser:      (data: object) => api.post('/admin/users', data),
  updateUser:      (id: number, data: object) => api.put(`/admin/users/${id}`, data),
  suspendUser:     (id: number, reason: string) => api.put(`/admin/users/${id}/suspend`, { reason }),
  reactivateUser:  (id: number) => api.put(`/admin/users/${id}/reactivate`),
  resetPassword:   (id: number, newPassword: string) => api.put(`/admin/users/${id}/reset-password`, { newPassword }),
  deleteUser:      (id: number) => api.delete(`/admin/users/${id}`),
  suspensionHistory: (id: number) => api.get(`/admin/users/${id}/suspensions`),
  loginAttempts:   (id: number) => api.get(`/admin/users/${id}/login-attempts`),

  // Verification
  verificationQueue: (type?: string) => api.get('/admin/verifications', { params: type ? { type } : {} }),
  handleVerification: (id: number, action: 'approve' | 'reject', reason?: string) =>
    api.put(`/admin/verifications/${id}`, { action, reason }),

  // Cases
  listCases:       (params?: object) => api.get('/admin/cases', { params }),
  reassignCase:    (id: number, attorney_id: number) => api.put(`/admin/cases/${id}/reassign`, { attorney_id }),
  archiveCase:     (id: number) => api.put(`/admin/cases/${id}/archive`),

  // Reports
  userReport:      () => api.get('/admin/reports/users'),
  caseReport:      () => api.get('/admin/reports/cases'),
}

// ─── Admin: Settings ──────────────────────────────────────
export const settingsApi = {
  getAll:  () => api.get('/admin/settings'),
  get:     (key: string) => api.get(`/admin/settings/${key}`),
  update:  (key: string, value: string) => api.put(`/admin/settings/${key}`, { value }),
  bulkUpdate: (settings: Array<{ key: string; value: string }>) =>
    api.put('/admin/settings', { settings }),
}

// ─── Admin: Audit Logs ────────────────────────────────────
export const auditApi = {
  list:    (params?: object) => api.get('/admin/audit', { params }),
  export:  (params?: object) => api.get('/admin/audit/export', { params, responseType: 'blob' }),
  stats:   () => api.get('/admin/audit/stats'),
}

export default api

