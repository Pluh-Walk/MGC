import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, Plus, Megaphone, Trash2, Loader2, X, Briefcase, CheckCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { announcementsApi, casesApi } from '../services/api'

interface Announcement {
  id: number
  title: string
  body: string
  case_id: number | null
  case_number: string | null
  case_title: string | null
  author_name: string
  created_at: string
  ack_required: number
  user_acknowledged: number
  ack_count?: number
}

interface CaseOption { id: number; case_number: string; title: string }

export default function Announcements() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [items,     setItems]     = useState<Announcement[]>([])
  const [cases,     setCases]     = useState<CaseOption[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form,      setForm]      = useState({ title: '', body: '', case_id: '', ack_required: false })
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const canManage = user?.role === 'attorney' || user?.role === 'secretary'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await announcementsApi.list()
      setItems(res.data.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!canManage) return
    casesApi.list().then(r =>
      setCases(r.data.data.map((c: any) => ({
        id: c.id, case_number: c.case_number, title: c.title,
      })))
    )
  }, [canManage])

  const openCreate = () => {
    setForm({ title: '', body: '', case_id: '', ack_required: false })
    setError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and body are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await announcementsApi.create({
        title: form.title,
        body: form.body,
        case_id: form.case_id ? Number(form.case_id) : undefined,
        ack_required: form.ack_required,
      })
      setModalOpen(false)
      await load()
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Failed to post.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this announcement?')) return
    await announcementsApi.delete(id)
    setItems(prev => prev.filter(a => a.id !== id))
  }

  const handleAcknowledge = async (id: number) => {
    try {
      await announcementsApi.acknowledge(id)
      setItems(prev => prev.map(a =>
        a.id === id ? { ...a, user_acknowledged: 1 } : a
      ))
    } catch { /* noop */ }
  }

  return (
    <div className="dashboard">
      {/* Nav */}
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <NotificationBell />
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        <div className="page-header">
          <button className="btn-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </button>
          <h2>
            <Megaphone size={20} style={{ marginRight: '0.5rem', color: 'var(--accent)' }} />
            Announcements
          </h2>
          {canManage && (
            <div className="page-header-actions">
              <button className="btn-primary" onClick={openCreate}>
                <Plus size={16} /> New Announcement
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="loading-state">
            <Loader2 size={28} className="spin" />
            <p>Loading announcementsâ€¦</p>
          </div>
        ) : items.length === 0 ? (
          <p className="empty-state">No announcements yet.</p>
        ) : (
          <div className="announcements-list">
            {items.map(a => (
              <div
                key={a.id}
                className="announcement-card"
                style={a.ack_required && !a.user_acknowledged ? {
                  borderLeft: '3px solid var(--warning)',
                  borderLeftColor: 'var(--warning)',
                } : {}}
              >
                <div className="announcement-header">
                  <div className="announcement-meta">
                    {a.case_number ? (
                      <span className="announcement-case-tag">
                        <Briefcase size={12} /> {a.case_number}
                      </span>
                    ) : (
                      <span className="announcement-firm-tag">Firm-wide</span>
                    )}
                    {a.ack_required === 1 && (
                      <span style={{
                        fontSize: '0.72rem', padding: '2px 8px', borderRadius: 999,
                        background: 'rgba(245,158,11,0.15)', color: 'var(--warning)',
                        fontWeight: 600,
                      }}>
                        Acknowledgment Required
                      </span>
                    )}
                    <span className="announcement-author">By {a.author_name}</span>
                    <span className="announcement-date">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                    {user?.role === 'admin' && a.ack_required === 1 && a.ack_count !== undefined && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {a.ack_count} acknowledgment{a.ack_count === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  {(user?.role === 'attorney' || user?.role === 'admin') && (
                    <button
                      className="btn-icon danger"
                      onClick={() => handleDelete(a.id)}
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <h3 className="announcement-title">{a.title}</h3>
                <p className="announcement-body">{a.body}</p>

                {/* Acknowledge button */}
                {a.ack_required === 1 && (
                  <div style={{ marginTop: 10 }}>
                    {a.user_acknowledged ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: '0.82rem', color: 'var(--success)',
                      }}>
                        <CheckCircle size={14} /> Acknowledged
                      </span>
                    ) : (
                      <button
                        className="btn-primary"
                        style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                        onClick={() => handleAcknowledge(a.id)}
                      >
                        <CheckCircle size={14} /> I Acknowledge This
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Announcement</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {error && <p className="form-error">{error}</p>}

            <div className="form-group">
              <label>Case (optional â€” leave blank for firm-wide)</label>
              <select
                value={form.case_id}
                onChange={e => setForm({ ...form, case_id: e.target.value })}
              >
                <option value="">All clients (firm-wide)</option>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} â€” {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                placeholder="Announcement title"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Body *</label>
              <textarea
                rows={5}
                placeholder="Write your announcementâ€¦"
                value={form.body}
                onChange={e => setForm({ ...form, body: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id="ack-required"
                checked={form.ack_required}
                onChange={e => setForm({ ...form, ack_required: e.target.checked })}
              />
              <label htmlFor="ack-required" style={{ marginBottom: 0 }}>
                Require acknowledgment from recipients
              </label>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={15} className="spin" /> : null}
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
