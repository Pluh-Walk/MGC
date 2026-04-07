import { useEffect, useState, FormEvent } from 'react'
import {
  Users, Search, Plus, AlertCircle, CheckCircle2, X,
  Eye, Ban, RotateCcw, Trash2, ChevronLeft, ChevronRight,
  Download, ShieldOff, UserCheck,
} from 'lucide-react'
import { adminApi } from '../services/api'

interface UserRow {
  id: number
  fullname: string
  username: string
  email: string
  role: string
  status: string
  ibp_verified: number
  created_at: string
  last_login: string | null
}

const AVATAR_COLORS: Record<string, string> = {
  attorney: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
  client: 'linear-gradient(135deg,#22c55e,#15803d)',
  secretary: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
  admin: 'linear-gradient(135deg,#f43f5e,#be123c)',
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Create user modal
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ fullname: '', username: '', email: '', password: '', role: 'client' })
  const [creating, setCreating] = useState(false)

  // Suspend modal
  const [suspendTarget, setSuspendTarget] = useState<UserRow | null>(null)
  const [suspendReason, setSuspendReason] = useState('')

  // DSAR / Erase modal
  const [eraseTarget, setEraseTarget] = useState<UserRow | null>(null)
  const [eraseConfirmText, setEraseConfirmText] = useState('')
  const [erasing, setErasing] = useState(false)
  const [dsarLoading, setDsarLoading] = useState<number | null>(null)

  // Detail panel
  const [detailUser, setDetailUser] = useState<any>(null)

  const fetchUsers = () => {
    setLoading(true)
    const params: any = { page, limit: 25 }
    if (search) params.search = search
    if (roleFilter) params.role = roleFilter
    if (statusFilter) params.status = statusFilter

    adminApi.listUsers(params)
      .then(res => { setUsers(res.data.data); setTotal(res.data.total) })
      .catch(err => setError(err.response?.data?.message || 'Failed to load users.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchUsers() }, [page, roleFilter, statusFilter])

  const handleSearch = (e: FormEvent) => { e.preventDefault(); setPage(1); fetchUsers() }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await adminApi.createUser(createForm)
      setSuccess('User created successfully.')
      setShowCreate(false)
      setCreateForm({ fullname: '', username: '', email: '', password: '', role: 'client' })
      fetchUsers()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user.')
    } finally { setCreating(false) }
  }

  const handleDsarExport = async (u: UserRow) => {
    setDsarLoading(u.id)
    try {
      const res = await adminApi.dsarExport(u.id)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `dsar-${u.username}-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      setSuccess(`DSAR export downloaded for ${u.fullname}.`)
    } catch {
      setError('DSAR export failed.')
    } finally {
      setDsarLoading(null)
    }
  }

  const handleErase = async () => {
    if (!eraseTarget || eraseConfirmText !== 'ERASE') return
    setErasing(true)
    try {
      await adminApi.eraseUser(eraseTarget.id)
      setSuccess(`Data for ${eraseTarget.fullname} has been anonymised.`)
      setEraseTarget(null)
      setEraseConfirmText('')
      fetchUsers()
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erasure failed.')
    } finally {
      setErasing(false)
    }
  }

  const handleSuspend = async () => {
    if (!suspendTarget || !suspendReason.trim()) return
    try {
      await adminApi.suspendUser(suspendTarget.id, suspendReason)
      setSuccess(`${suspendTarget.fullname} suspended.`)
      setSuspendTarget(null)
      setSuspendReason('')
      fetchUsers()
    } catch (err: any) { setError(err.response?.data?.message || 'Failed.') }
  }

  const handleReactivate = async (u: UserRow) => {
    try {
      await adminApi.reactivateUser(u.id)
      setSuccess(`${u.fullname} reactivated.`)
      fetchUsers()
    } catch (err: any) { setError(err.response?.data?.message || 'Failed.') }
  }

  const handleImpersonate = async (u: UserRow) => {
    if (!confirm(`Impersonate ${u.fullname} (${u.role})? You will be logged in as this user in read-only mode.`)) return
    try {
      const res = await adminApi.impersonateUser(u.id)
      const { token, impersonation_log_id, target } = res.data
      // Save admin session
      localStorage.setItem('admin_token', localStorage.getItem('token') || '')
      localStorage.setItem('admin_user', localStorage.getItem('user') || '')
      localStorage.setItem('impersonation_log_id', String(impersonation_log_id))
      localStorage.setItem('impersonation_target_name', target.fullname)
      // Set impersonation token
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(target))
      // Redirect to appropriate dashboard
      const dash = target.role === 'attorney' ? '/dashboard/attorney'
        : target.role === 'secretary' ? '/dashboard/secretary'
        : '/dashboard/client'
      window.location.href = dash
    } catch (err: any) { setError(err.response?.data?.message || 'Impersonation failed.') }
  }

  const handleDelete = async (u: UserRow) => {
    if (!confirm(`Permanently delete ${u.fullname} (${u.email})? This cannot be undone.`)) return
    try {
      await adminApi.deleteUser(u.id)
      setSuccess(`${u.fullname} deleted.`)
      fetchUsers()
    } catch (err: any) { setError(err.response?.data?.message || 'Failed.') }
  }

  const viewDetail = async (id: number) => {
    try {
      const res = await adminApi.getUser(id)
      setDetailUser(res.data.data)
    } catch { /* ignore */ }
  }

  const totalPages = Math.ceil(total / 25)

  const profileFields = (p: Record<string, any>) =>
    Object.entries(p).filter(([k, v]) => v != null && !['user_id', 'id'].includes(k))

  return (
    <div className="admin-users">
      {/* ── Header ───────────────────────────────── */}
      <div className="admin-users-header">
        <h1>
          <Users size={24} /> User Management
          {!loading && <span className="user-count">({total})</span>}
        </h1>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Create User
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <CheckCircle2 size={16} /> {success}
          <button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────── */}
      <div className="admin-users-toolbar">
        <form onSubmit={handleSearch} className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search name, email, username…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </form>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }}>
          <option value="">All Roles</option>
          <option value="attorney">Attorney</option>
          <option value="client">Client</option>
          <option value="secretary">Secretary</option>
          <option value="admin">Admin</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* ── Table ────────────────────────────────── */}
      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : (
        <div className="admin-users-table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Verified</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No users found.
                    </td>
                  </tr>
                )}
                {users.map(u => (
                  <tr key={u.id} className="table-row-link" onClick={() => viewDetail(u.id)}>
                    <td>
                      <div className="user-cell">
                        <div
                          className="user-avatar-sm"
                          style={{ background: AVATAR_COLORS[u.role] || AVATAR_COLORS.client }}
                        >
                          {u.fullname.charAt(0)}
                        </div>
                        <div className="user-meta">
                          <span className="name">{u.fullname}</span>
                          <span className="uname">@{u.username}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{u.email}</td>
                    <td><span className={`pill pill-${u.role}`}>{u.role}</span></td>
                    <td><span className={`pill pill-${u.status}`}>{u.status}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`verified-dot ${u.ibp_verified ? 'yes' : 'no'}`} title={u.ibp_verified ? 'Verified' : 'Unverified'} />
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {u.last_login ? new Date(u.last_login).toLocaleDateString() : '—'}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="action-group">
                        <button className="action-icon-btn" title="View" onClick={() => viewDetail(u.id)}>
                          <Eye size={15} />
                        </button>
                        <button
                          className="action-icon-btn"
                          title="Export Personal Data (DSAR)"
                          onClick={() => handleDsarExport(u)}
                          disabled={dsarLoading === u.id}
                        >
                          <Download size={15} />
                        </button>
                        {u.status !== 'suspended' && (
                          <button className="action-icon-btn danger" title="Suspend" onClick={() => setSuspendTarget(u)}>
                            <Ban size={15} />
                          </button>
                        )}
                        {(u.status === 'suspended' || u.status === 'inactive') && (
                          <button className="action-icon-btn success" title="Reactivate" onClick={() => handleReactivate(u)}>
                            <RotateCcw size={15} />
                          </button>
                        )}
                        {u.status === 'active' && u.role !== 'admin' && (
                          <button className="action-icon-btn" title="Impersonate User" onClick={() => handleImpersonate(u)}>
                            <UserCheck size={15} />
                          </button>
                        )}
                        <button className="action-icon-btn danger" title="Erase Personal Data" onClick={() => { setEraseTarget(u); setEraseConfirmText('') }}>
                          <ShieldOff size={15} />
                        </button>
                        <button className="action-icon-btn danger" title="Delete" onClick={() => handleDelete(u)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="admin-pagination">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} style={{ verticalAlign: '-2px' }} /> Prev
              </button>
              <span className="page-info">Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight size={14} style={{ verticalAlign: '-2px' }} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Create User Modal ────────────────────── */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="admin-create-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-top">
              <h3>Create User</h3>
              <button className="action-icon-btn" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-row-2">
                <div className="field-group">
                  <label>Full Name</label>
                  <input type="text" placeholder="John Doe" required value={createForm.fullname} onChange={e => setCreateForm({ ...createForm, fullname: e.target.value })} />
                </div>
                <div className="field-group">
                  <label>Username</label>
                  <input type="text" placeholder="johndoe" required value={createForm.username} onChange={e => setCreateForm({ ...createForm, username: e.target.value })} />
                </div>
              </div>
              <div className="field-group">
                <label>Email</label>
                <input type="email" placeholder="john@example.com" required value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} />
              </div>
              <div className="form-row-2">
                <div className="field-group">
                  <label>Password</label>
                  <input type="password" placeholder="Min 8 characters" required minLength={8} value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} />
                </div>
                <div className="field-group">
                  <label>Role</label>
                  <select value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })}>
                    <option value="client">Client</option>
                    <option value="attorney">Attorney</option>
                    <option value="secretary">Secretary</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Erase Data Modal ──────────────────────── */}
      {eraseTarget && (
        <div className="modal-overlay" onClick={() => setEraseTarget(null)}>
          <div className="admin-suspend-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-top">
              <h3><ShieldOff size={18} /> Erase Personal Data</h3>
              <button className="action-icon-btn" onClick={() => setEraseTarget(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: '0.5rem' }}>⚠️ This action is irreversible.</p>
              <p style={{ fontSize: '0.88rem', marginBottom: '0.75rem' }}>
                All personal data for <strong>{eraseTarget.fullname}</strong> will be anonymised in compliance with RA 10173 (Data Privacy Act). Case records and audit logs are preserved but PII is scrubbed.
              </p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Type <strong>ERASE</strong> to confirm:</p>
              <input
                type="text"
                className="field-input"
                placeholder="ERASE"
                value={eraseConfirmText}
                onChange={e => setEraseConfirmText(e.target.value)}
                style={{ marginBottom: '1rem' }}
              />
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setEraseTarget(null)}>Cancel</button>
                <button
                  className="btn-primary"
                  style={{ background: 'var(--danger)' }}
                  onClick={handleErase}
                  disabled={eraseConfirmText !== 'ERASE' || erasing}
                >
                  {erasing ? 'Erasing…' : 'Erase Personal Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Suspend Modal ────────────────────────── */}
      {suspendTarget && (
        <div className="modal-overlay" onClick={() => setSuspendTarget(null)}>
          <div className="admin-suspend-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-top">
              <h3><Ban size={18} /> Suspend User</h3>
              <button className="action-icon-btn" onClick={() => setSuspendTarget(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p>
                You are about to suspend <strong style={{ color: 'var(--text)' }}>{suspendTarget.fullname}</strong>.
                They will be unable to log in until reactivated.
              </p>
              <textarea
                rows={3}
                placeholder="Reason for suspension…"
                value={suspendReason}
                onChange={e => setSuspendReason(e.target.value)}
              />
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setSuspendTarget(null)}>Cancel</button>
                <button
                  className="btn-primary"
                  style={{ background: 'var(--danger)' }}
                  onClick={handleSuspend}
                  disabled={!suspendReason.trim()}
                >
                  Suspend User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Panel ─────────────────────────── */}
      {detailUser && (
        <div className="modal-overlay" onClick={() => setDetailUser(null)}>
          <div className="admin-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <h3>
                <div
                  className="user-avatar-sm"
                  style={{ background: AVATAR_COLORS[detailUser.role] || AVATAR_COLORS.client, width: 30, height: 30, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}
                >
                  {detailUser.fullname?.charAt(0)}
                </div>
                {detailUser.fullname}
              </h3>
              <button className="action-icon-btn" onClick={() => setDetailUser(null)}><X size={18} /></button>
            </div>
            <div className="detail-body">
              {/* Core info */}
              <div className="detail-field-grid">
                <div className="detail-field">
                  <span className="field-label">Email</span>
                  <span className="field-value">{detailUser.email}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Username</span>
                  <span className="field-value">@{detailUser.username}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Role</span>
                  <span className="field-value"><span className={`pill pill-${detailUser.role}`}>{detailUser.role}</span></span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Status</span>
                  <span className="field-value"><span className={`pill pill-${detailUser.status}`}>{detailUser.status}</span></span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Verified</span>
                  <span className="field-value">{detailUser.ibp_verified ? 'Yes' : 'No'}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Joined</span>
                  <span className="field-value">{new Date(detailUser.created_at).toLocaleDateString()}</span>
                </div>
                <div className="detail-field">
                  <span className="field-label">Last Login</span>
                  <span className="field-value">{detailUser.last_login ? new Date(detailUser.last_login).toLocaleString() : 'Never'}</span>
                </div>
              </div>

              {/* Profile data */}
              {detailUser.profile && profileFields(detailUser.profile).length > 0 && (
                <>
                  <p className="detail-section-title">Profile Details</p>
                  <div className="detail-profile-grid">
                    {profileFields(detailUser.profile).map(([k, v]) => (
                      <div className="pf" key={k}>
                        <strong>{k.replace(/_/g, ' ')}</strong>
                        {String(v)}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Recent Audit */}
              {detailUser.recent_audit?.length > 0 && (
                <>
                  <p className="detail-section-title">Recent Audit</p>
                  <div className="detail-audit-list">
                    {detailUser.recent_audit.map((a: any, i: number) => (
                      <div className="detail-audit-item" key={i}>
                        <span className="audit-action">{a.action}</span>
                        <span className="audit-detail">{a.details || '—'}</span>
                        <span className="audit-time">{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
