import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send httpOnly refresh token cookie on every request
})

// Read a cookie by name (works without cookie libraries)
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

// Attach JWT access token + CSRF token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  // Double-submit CSRF cookie pattern — token set by server on login/refresh
  const csrf = getCookie('XSRF-TOKEN')
  if (csrf) config.headers['X-CSRF-Token'] = csrf

  return config
})

// ─── Flag to prevent multiple simultaneous refresh attempts ──
let isRefreshing = false
let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => (token ? p.resolve(token) : p.reject(error)))
  failedQueue = []
}

// Handle 401 (expired access token) with auto-refresh
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    // Auto-refresh on 401 — but not for the refresh endpoint itself (avoids infinite loop)
    if (
      err.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        // Queue the request until the refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        const newToken: string = data.token
        localStorage.setItem('token', newToken)
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`
        original.headers.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)
        return api(original)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        // Refresh failed — session is truly expired
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    if (err.response?.status === 503 && err.response?.data?.maintenance) {
      // Server is in maintenance mode — broadcast so every page can react
      window.dispatchEvent(new CustomEvent('maintenance-mode', { detail: { active: true, message: err.response.data.message } }))
      return Promise.reject(err)
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
  list: (params?: { status?: string; search?: string; page?: number; priority?: string; case_type?: string; overdue_only?: boolean }) =>
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
  exportUrl: (params?: { status?: string; priority?: string; case_type?: string }) => {
    const token = localStorage.getItem('token') ?? ''
    const q = new URLSearchParams({ format: 'csv', token, ...params as any }).toString()
    return `/api/cases/export?${q}`
  },
  exportCase: (id: number) => {
    window.open(`/api/cases/${id}/export?token=${encodeURIComponent(localStorage.getItem('token') ?? '')}`, '_blank')
  },
  placeLegalHold: (id: number, note?: string) => api.post(`/cases/${id}/legal-hold`, { note }),
  liftLegalHold:  (id: number) => api.delete(`/cases/${id}/legal-hold`),
}

// ─── Case Parties ─────────────────────────────────────────
export const partiesApi = {
  list:   (caseId: number) => api.get(`/cases/${caseId}/parties`),
  add:    (caseId: number, data: object) => api.post(`/cases/${caseId}/parties`, data),
  update: (caseId: number, partyId: number, data: object) =>
    api.put(`/cases/${caseId}/parties/${partyId}`, data),
  delete: (caseId: number, partyId: number) =>
    api.delete(`/cases/${caseId}/parties/${partyId}`),
}

// ─── Case Deadlines ───────────────────────────────────────
export const deadlinesApi = {
  list:     (caseId: number) => api.get(`/cases/${caseId}/deadlines`),
  create:   (caseId: number, data: object) => api.post(`/cases/${caseId}/deadlines`, data),
  update:   (caseId: number, deadlineId: number, data: object) =>
    api.put(`/cases/${caseId}/deadlines/${deadlineId}`, data),
  complete: (caseId: number, deadlineId: number) =>
    api.put(`/cases/${caseId}/deadlines/${deadlineId}/complete`, {}),
  delete:   (caseId: number, deadlineId: number) =>
    api.delete(`/cases/${caseId}/deadlines/${deadlineId}`),
  summary:  () => api.get('/cases/deadlines/summary'),
}

// ─── Case Billing ─────────────────────────────────────────
export const billingApi = {
  list:              (caseId: number) => api.get(`/cases/${caseId}/billing`),
  add:               (caseId: number, data: object) => api.post(`/cases/${caseId}/billing`, data),
  update:            (caseId: number, entryId: number, data: object) =>
    api.patch(`/cases/${caseId}/billing/${entryId}`, data),
  delete:            (caseId: number, entryId: number) =>
    api.delete(`/cases/${caseId}/billing/${entryId}`),
  retainerSummary:   (caseId: number) => api.get(`/cases/${caseId}/billing/retainer`),
  retainerStatement: (caseId: number) =>
    api.get(`/cases/${caseId}/billing/retainer/statement`, { responseType: 'blob' }),
  uploadReceipt:     (caseId: number, entryId: number, file: File) => {
    const form = new FormData(); form.append('receipt', file)
    return api.put(`/cases/${caseId}/billing/${entryId}/receipt`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

// ─── Invoices ─────────────────────────────────────────────
export const invoiceApi = {
  list:    (caseId: number) => api.get(`/cases/${caseId}/invoices`),
  get:     (caseId: number, invoiceId: number) => api.get(`/cases/${caseId}/invoices/${invoiceId}`),
  create:  (caseId: number, data: { entry_ids: number[]; due_date?: string; notes?: string; tax_rate?: number }) =>
    api.post(`/cases/${caseId}/invoices`, data),
  pdfUrl:  (caseId: number, invoiceId: number) => `/api/cases/${caseId}/invoices/${invoiceId}/pdf`,
  downloadPdf: (caseId: number, invoiceId: number) =>
    api.get(`/cases/${caseId}/invoices/${invoiceId}/pdf`, { responseType: 'blob' }),
  receiptUrl: (caseId: number, invoiceId: number) =>
    `/api/cases/${caseId}/invoices/${invoiceId}/receipt?token=${encodeURIComponent(localStorage.getItem('token') ?? '')}`,
  send:    (caseId: number, invoiceId: number) => api.post(`/cases/${caseId}/invoices/${invoiceId}/send`),
  pay:     (caseId: number, invoiceId: number, data: { paid_reference?: string }) =>
    api.post(`/cases/${caseId}/invoices/${invoiceId}/pay`, data),
  void_:   (caseId: number, invoiceId: number) => api.put(`/cases/${caseId}/invoices/${invoiceId}/void`),
}

// ─── Time Tracking ─────────────────────────────────────────
export const timeTrackingApi = {
  list:    (caseId: number) => api.get(`/cases/${caseId}/time`),
  summary: (caseId: number) => api.get(`/cases/${caseId}/time/summary`),
  start:   (caseId: number, data: { description?: string; is_billable?: boolean }) =>
    api.post(`/cases/${caseId}/time`, { ...data, action: 'start' }),
  create:  (caseId: number, data: { description?: string; duration_sec: number; is_billable?: boolean; started_at?: string }) =>
    api.post(`/cases/${caseId}/time`, data),
  stop:    (caseId: number, entryId: number, endedAt?: string) =>
    api.patch(`/cases/${caseId}/time/${entryId}`, { ended_at: endedAt ?? new Date().toISOString() }),
  update:  (caseId: number, entryId: number, data: object) =>
    api.patch(`/cases/${caseId}/time/${entryId}`, data),
  delete_: (caseId: number, entryId: number) =>
    api.delete(`/cases/${caseId}/time/${entryId}`),
  bill:    (caseId: number, entryId: number, data: { rate: number; description?: string }) =>
    api.post(`/cases/${caseId}/time/${entryId}/bill`, data),
}

// ─── Case Relations ───────────────────────────────────────
export const relationsApi = {
  list:   (caseId: number) => api.get(`/cases/${caseId}/relations`),
  add:    (caseId: number, data: { related_case_id: number; relation_type?: string; notes?: string }) =>
    api.post(`/cases/${caseId}/relations`, data),
  delete: (caseId: number, relationId: number) =>
    api.delete(`/cases/${caseId}/relations/${relationId}`),
}

// ─── Co-counsel ────────────────────────────────────────────
export const cocounselApi = {
  list:   (caseId: number) => api.get(`/cases/${caseId}/cocounsel`),
  add:    (caseId: number, data: { attorney_id: number; role?: string }) =>
    api.post(`/cases/${caseId}/cocounsel`, data),
  remove: (caseId: number, entryId: number) =>
    api.delete(`/cases/${caseId}/cocounsel/${entryId}`),
}

// ─── Tags ──────────────────────────────────────────────────
export const tagsApi = {
  listAll:    () => api.get('/cases/tags'),
  create:     (data: { name: string; color?: string }) => api.post('/cases/tags', data),
  deleteTag:  (tagId: number) => api.delete(`/cases/tags/${tagId}`),
  getCaseTags:   (caseId: number) => api.get(`/cases/${caseId}/tags`),
  assign:        (caseId: number, tag_id: number) => api.post(`/cases/${caseId}/tags`, { tag_id }),
  remove:        (caseId: number, tagId: number) => api.delete(`/cases/${caseId}/tags/${tagId}`),
}

// ─── Tasks ────────────────────────────────────────────────
export const tasksApi = {
  list:     (caseId: number) => api.get(`/cases/${caseId}/tasks`),
  create:   (caseId: number, data: object) => api.post(`/cases/${caseId}/tasks`, data),
  update:   (caseId: number, taskId: number, data: object) => api.put(`/cases/${caseId}/tasks/${taskId}`, data),
  complete: (caseId: number, taskId: number) => api.post(`/cases/${caseId}/tasks/${taskId}/complete`, {}),
  delete:   (caseId: number, taskId: number) => api.delete(`/cases/${caseId}/tasks/${taskId}`),
  mine:     () => api.get('/cases/tasks/mine'),
}

export const stagesApi = {
  templates: () => api.get('/cases/stages/templates'),
  list:      (caseId: number) => api.get(`/cases/${caseId}/stages`),
  init:      (caseId: number, case_type: string) => api.post(`/cases/${caseId}/stages/init`, { case_type }),
  advance:   (caseId: number, stageId: number, notes?: string) => api.put(`/cases/${caseId}/stages/${stageId}/advance`, { notes }),
  update:    (caseId: number, stageId: number, data: object) => api.put(`/cases/${caseId}/stages/${stageId}`, data),
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
  stats:          () => api.get('/profile/attorney/stats'),
  activity:       () => api.get('/profile/attorney/activity'),
  getPerformance: () => api.get('/profile/attorney/performance'),
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
  getNotificationPrefs: () => api.get('/profile/notification-prefs'),
  updateNotificationPrefs: (data: Record<string, string>) => api.put('/profile/notification-prefs', data),
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
  list: (caseId: number, search?: string) =>
    api.get(`/cases/${caseId}/documents`, { params: search ? { search } : undefined }),
  upload: (caseId: number, formData: FormData) =>
    api.post(`/cases/${caseId}/documents`, formData, {
      headers: { 'Content-Type': undefined },
    }),
  downloadUrl: (id: number) => `/api/documents/${id}/download`,
  download: (id: number) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  delete: (id: number) => api.delete(`/documents/${id}`),
  privilegeLog: (caseId: number) =>
    api.get(`/cases/${caseId}/documents/privilege-log`, { responseType: 'blob' }),
  bulkDownload: (caseId: number, ids: number[]) =>
    api.get(`/cases/${caseId}/documents/bulk-download`, { params: { ids: ids.join(',') }, responseType: 'blob' }),
  bulkDelete: (caseId: number, ids: number[]) =>
    api.delete(`/cases/${caseId}/documents/bulk`, { data: { ids } }),
  // ─── Versioning ──────────────────────────────────────────
  listVersions:    (caseId: number, docId: number) =>
    api.get(`/cases/${caseId}/documents/${docId}/versions`),
  uploadVersion:   (caseId: number, docId: number, formData: FormData) =>
    api.post(`/cases/${caseId}/documents/${docId}/versions`, formData, {
      headers: { 'Content-Type': undefined },
    }),
  downloadVersion: (caseId: number, docId: number, versionId: number) =>
    api.get(`/cases/${caseId}/documents/${docId}/versions/${versionId}`, { responseType: 'blob' }),
}

// ─── Notifications ──────────────────────────────────────────────
export const notificationsApi = {
  list:         () => api.get('/notifications'),
  markAllRead:  () => api.put('/notifications/read-all'),
  markOneRead:  (id: number) => api.put(`/notifications/${id}/read`),
}

// ─── Document Templates ────────────────────────────────────────
export const templatesApi = {
  list:     (category?: string) => api.get('/templates', { params: category ? { category } : {} }),
  upload:   (formData: FormData) => api.post('/templates', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update:   (id: number, data: object) => api.put(`/templates/${id}`, data),
  delete:   (id: number) => api.delete(`/templates/${id}`),
  downloadUrl: (id: number) => `/api/templates/${id}/download?token=${encodeURIComponent(localStorage.getItem('token') ?? '')}`,
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
  financialReport: () => api.get('/admin/reports/financial'),
  workloadReport:  () => api.get('/admin/reports/workload'),

  // Impersonation
  impersonateUser: (userId: number) => api.post(`/admin/users/${userId}/impersonate`),
  endImpersonation: (logId: number) => api.post(`/admin/impersonation/${logId}/end`),

  // Data Privacy (RA 10173 / DSAR)
  dsarExport: (userId: number) =>
    api.get(`/admin/privacy/dsar/${userId}`, { responseType: 'blob' }),
  eraseUser: (userId: number) =>
    api.post(`/admin/privacy/erase/${userId}`),
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

