import { useState, useEffect, FormEvent } from 'react'
import { Megaphone, Plus, Trash2, AlertCircle, CheckCircle2, X, Edit2, Calendar, User, Clock } from 'lucide-react'
import { announcementsApi } from '../services/api'

interface Announcement {
  id: number
  title: string
  body: string
  case_id: number | null
  case_number: string | null
  case_title: string | null
  author_name: string
  created_at: string
}

export default function AdminAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Create/Edit form
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchAnnouncements = () => {
    setLoading(true)
    announcementsApi.list()
      .then(res => setItems(res.data.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAnnouncements() }, [])

  const openCreate = () => { setEditId(null); setTitle(''); setBody(''); setShowForm(true) }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editId) {
        await announcementsApi.delete(editId)
        await announcementsApi.create({ title, body, case_id: null })
        setSuccess('Announcement updated.')
      } else {
        await announcementsApi.create({ title, body, case_id: null })
        setSuccess('Announcement created.')
      }
      setShowForm(false)
      fetchAnnouncements()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed.')
    } finally { setSaving(false) }
  }

  const handleDelete = async (a: Announcement) => {
    if (!confirm(`Delete announcement "${a.title}"?`)) return
    try {
      await announcementsApi.delete(a.id)
      setSuccess('Announcement deleted.')
      fetchAnnouncements()
    } catch (err: any) { setError(err.response?.data?.message || 'Failed.') }
  }

  const formatDate = (d: string) => {
    const date = new Date(d)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div className="admin-dash">
      <div className="admin-dash-header">
        <div>
          <h1><Megaphone size={24} /> Announcements</h1>
          <span className="subtitle">{items.length} announcement{items.length !== 1 ? 's' : ''}</span>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus size={16} /> New Announcement</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> {error} <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button></div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}><CheckCircle2 size={16} /> {success} <button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button></div>}

      {loading ? <div className="page-loading"><div className="spinner" /></div> : items.length === 0 ? (
        <div className="admin-empty-state">
          <Megaphone size={48} />
          <h3>No Announcements</h3>
          <p>Create your first announcement to notify users.</p>
          <button className="btn-primary" onClick={openCreate} style={{ marginTop: '0.75rem' }}><Plus size={16} /> Create Announcement</button>
        </div>
      ) : (
        <div className="announce-list">
          {items.map((a, i) => (
            <div key={a.id} className="announce-card" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="announce-card-left">
                <div className="announce-date-badge">
                  <Calendar size={13} />
                  <span>{formatDate(a.created_at)}</span>
                </div>
              </div>
              <div className="announce-card-body">
                <div className="announce-card-top">
                  <h3>{a.title}</h3>
                  <div className="action-group">
                    <button
                      className="action-icon-btn"
                      title="Edit"
                      onClick={() => { setEditId(a.id); setTitle(a.title); setBody(a.body); setShowForm(true) }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="action-icon-btn danger"
                      title="Delete"
                      onClick={() => handleDelete(a)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="announce-body">{a.body}</p>
                <div className="announce-meta">
                  <span><User size={12} /> {a.author_name}</span>
                  <span><Clock size={12} /> {timeAgo(a.created_at)}</span>
                  {a.case_number && <span className="pill pill-active" style={{ fontSize: '0.68rem' }}>Case: {a.case_number}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-create-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-top">
              <h3>{editId ? <><Edit2 size={18} /> Edit Announcement</> : <><Plus size={18} /> New Announcement</>}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="field-group">
                <label>Title</label>
                <input type="text" placeholder="Announcement title" required value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="field-group">
                <label>Body</label>
                <textarea
                  rows={6}
                  placeholder="Write your announcement…"
                  required
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.88rem', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
