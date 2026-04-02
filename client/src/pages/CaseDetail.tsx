import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Scale, ArrowLeft, FileText, Clock, StickyNote, Upload,
  CheckCircle, AlertCircle, Paperclip, Lock, Globe, Trash2,
  Pencil, CheckCircle2, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import { casesApi, documentsApi } from '../services/api'

type Tab = 'info' | 'timeline' | 'notes' | 'documents'

const STATUS_COLORS: Record<string, string> = {
  draft:    '#a78bfa',
  active:   '#22c55e',
  pending:  '#b8962e',
  closed:   '#3b82f6',
  archived: '#6b7280',
}

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [docs, setDocs] = useState<any[]>([])
  const [noteContent, setNoteContent] = useState('')
  const [notePrivate, setNotePrivate] = useState(true)
  const [noteSubmitting, setNoteSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [docVisible, setDocVisible] = useState(false)
  const [editStatus, setEditStatus] = useState('')

  // Inline edit state (Phases 3+4)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', case_type: '', court_name: '', judge_name: '', filing_date: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [approving, setApproving] = useState(false)

  const fetchCase = async () => {
    try {
      const res = await casesApi.get(Number(id))
      setData(res.data.data)
      setEditStatus(res.data.data.status)
    } catch {
      navigate(-1)
    } finally {
      setLoading(false)
    }
  }

  const fetchDocs = async () => {
    try {
      const res = await documentsApi.list(Number(id))
      setDocs(res.data.data)
    } catch {}
  }

  useEffect(() => { fetchCase() }, [id])
  useEffect(() => { if (activeTab === 'documents') fetchDocs() }, [activeTab])

  const openEdit = () => {
    setEditForm({
      title:       data.title,
      case_type:   data.case_type,
      court_name:  data.court_name || '',
      judge_name:  data.judge_name || '',
      filing_date: data.filing_date ? data.filing_date.slice(0, 10) : '',
    })
    setShowEdit(true)
  }

  const handleEditSave = async () => {
    setEditSaving(true)
    try {
      await casesApi.update(Number(id), editForm)
      setShowEdit(false)
      fetchCase()
    } catch {} finally {
      setEditSaving(false)
    }
  }

  const handleApprove = async () => {
    if (!confirm('Approve this draft and make it active? The client will be notified.')) return
    setApproving(true)
    try {
      await casesApi.approveDraft(Number(id))
      fetchCase()
    } catch {} finally {
      setApproving(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      await casesApi.update(Number(id), { status: newStatus })
      setEditStatus(newStatus)
      fetchCase()
    } catch {}
  }

  const handleAddNote = async () => {
    if (!noteContent.trim()) return
    setNoteSubmitting(true)
    try {
      await casesApi.addNote(Number(id), { content: noteContent, is_private: notePrivate })
      setNoteContent('')
      fetchCase()
    } catch {} finally {
      setNoteSubmitting(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('category', 'other')
    fd.append('is_client_visible', docVisible ? 'true' : 'false')
    try {
      await documentsApi.upload(Number(id), fd)
      fetchDocs()
    } catch {} finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteDoc = async (docId: number) => {
    if (!confirm('Remove this document?')) return
    try {
      await documentsApi.delete(docId)
      fetchDocs()
    } catch {}
  }

  if (loading) return <div className="dashboard"><main className="dash-content"><div className="loading-state">Loading case…</div></main></div>
  if (!data) return null

  return (
    <div className="dashboard">
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className={`role-badge ${user?.role}`}>
            {user?.role === 'attorney' ? 'Attorney' : user?.role === 'secretary' ? 'Secretary' : 'Client'}
          </span>
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        <button className="btn-back" onClick={() => navigate('/cases')}>
          <ArrowLeft size={16} />
          Back to Cases
        </button>

        {/* Case Header */}
        <div className="case-header-card">
          <div className="case-header-left">
            <span className="mono case-number">{data.case_number}</span>
            <h2>{data.title}</h2>
            <div className="case-meta-row">
              <span style={{ textTransform: 'capitalize' }}>{data.case_type}</span>
              <span>·</span>
              <span>Client: <strong>{data.client_name}</strong></span>
              <span>·</span>
              <span>Attorney: <strong>{data.attorney_name}</strong></span>
            </div>
          </div>
          <div className="case-header-right">
            {user?.role === 'attorney' && data.status !== 'draft' ? (
              <select
                value={editStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="status-select"
                style={{ borderColor: STATUS_COLORS[editStatus] }}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            ) : user?.role === 'attorney' && data.status === 'draft' ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className="status-badge-lg" style={{ background: STATUS_COLORS.draft }}>Draft — Pending Review</span>
                <button className="btn-primary" onClick={handleApprove} disabled={approving} style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}>
                  <CheckCircle2 size={14} /> {approving ? 'Approving…' : 'Approve'}
                </button>
              </div>
            ) : data.status === 'draft' ? (
              <span className="status-badge-lg" style={{ background: STATUS_COLORS.draft }}>Draft — Pending Approval</span>
            ) : (
              <span className="status-badge-lg" style={{ background: STATUS_COLORS[data.status] }}>{data.status}</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          {(['info', 'timeline', 'notes', 'documents'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`tab-btn${activeTab === t ? ' active' : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t === 'info' && <FileText size={14} />}
              {t === 'timeline' && <Clock size={14} />}
              {t === 'notes' && <StickyNote size={14} />}
              {t === 'documents' && <Paperclip size={14} />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab: Info */}
        {activeTab === 'info' && (
          <div className="tab-content">
            {(user?.role === 'attorney' || user?.role === 'secretary') && !showEdit && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <button className="btn-secondary" style={{ fontSize: '0.82rem' }} onClick={openEdit}>
                  <Pencil size={13} /> Edit Details
                </button>
              </div>
            )}

            {showEdit ? (
              <div className="inline-edit-form">
                <div className="field-group">
                  <label>Title</label>
                  <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="field-group">
                    <label>Case Type</label>
                    <select value={editForm.case_type} onChange={e => setEditForm(f => ({ ...f, case_type: e.target.value }))}>
                      {['civil','criminal','family','corporate','other'].map(t => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  {user?.role === 'attorney' && (
                    <div className="field-group">
                      <label>Filing Date</label>
                      <input type="date" value={editForm.filing_date} onChange={e => setEditForm(f => ({ ...f, filing_date: e.target.value }))} />
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="field-group">
                    <label>Court Name</label>
                    <input value={editForm.court_name} onChange={e => setEditForm(f => ({ ...f, court_name: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <label>Judge Name</label>
                    <input value={editForm.judge_name} onChange={e => setEditForm(f => ({ ...f, judge_name: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button className="btn-secondary" onClick={() => setShowEdit(false)} disabled={editSaving}>
                    <X size={13} /> Cancel
                  </button>
                  <button className="btn-primary" onClick={handleEditSave} disabled={editSaving}>
                    <CheckCircle2 size={13} /> {editSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="info-grid">
                <div className="info-item"><label>Court</label><span>{data.court_name || '—'}</span></div>
                <div className="info-item"><label>Judge</label><span>{data.judge_name || '—'}</span></div>
                <div className="info-item"><label>Filing Date</label><span>{data.filing_date ? new Date(data.filing_date).toLocaleDateString() : '—'}</span></div>
                <div className="info-item"><label>Opened On</label><span>{new Date(data.created_at).toLocaleDateString()}</span></div>
                <div className="info-item"><label>Client Email</label><span>{data.client_email}</span></div>
                <div className="info-item"><label>Attorney Email</label><span>{data.attorney_email}</span></div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Timeline */}
        {activeTab === 'timeline' && (
          <div className="tab-content">
            {data.timeline.length === 0 ? (
              <div className="empty-state"><Clock size={36} className="empty-icon" /><p>No timeline events yet.</p></div>
            ) : (
              <div className="timeline">
                {data.timeline.map((e: any) => (
                  <div key={e.id} className="timeline-item">
                    <div className="timeline-dot">
                      {e.event_type === 'status_change' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    </div>
                    <div className="timeline-body">
                      <p className="timeline-desc">{e.description}</p>
                      <span className="timeline-meta">
                        {new Date(e.event_date).toLocaleDateString()} · {e.created_by_name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Notes */}
        {activeTab === 'notes' && (
          <div className="tab-content">
            {(user?.role === 'attorney' || user?.role === 'secretary') && (
              <div className="note-composer">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Write a note…"
                  rows={4}
                  className="note-textarea"
                />
                <div className="note-footer">
                  {user?.role === 'attorney' ? (
                    <label className="toggle-row">
                      {notePrivate ? <Lock size={14} /> : <Globe size={14} />}
                      <input
                        type="checkbox"
                        checked={notePrivate}
                        onChange={(e) => setNotePrivate(e.target.checked)}
                      />
                      {notePrivate ? 'Private (attorney only)' : 'Visible to client'}
                    </label>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <Globe size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
                      Notes are visible to attorney and client
                    </span>
                  )}
                  <button
                    className="btn-primary"
                    onClick={handleAddNote}
                    disabled={noteSubmitting || !noteContent.trim()}
                  >
                    {noteSubmitting ? 'Saving…' : 'Add Note'}
                  </button>
                </div>
              </div>
            )}
            {data.notes.length === 0 ? (
              <div className="empty-state"><StickyNote size={36} className="empty-icon" /><p>No notes yet.</p></div>
            ) : (
              <div className="notes-list">
                {data.notes.map((n: any) => (
                  <div key={n.id} className="note-card">
                    <div className="note-card-header">
                      <span className="note-author">{n.author_name}</span>
                      {n.is_private && (
                        <span className="note-private-badge"><Lock size={11} /> Private</span>
                      )}
                      <span className="note-date">{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className="note-content">{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Documents */}
        {activeTab === 'documents' && (
          <div className="tab-content">
            {(user?.role === 'attorney' || user?.role === 'secretary') && (
              <div className="upload-row">
                <label className="btn-secondary upload-label">
                  <Upload size={15} />
                  {uploading ? 'Uploading…' : 'Upload Document'}
                  <input type="file" hidden onChange={handleUpload} disabled={uploading} />
                </label>
                <label className="toggle-row" style={{ fontSize: '0.83rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={docVisible}
                    onChange={e => setDocVisible(e.target.checked)}
                    style={{ marginRight: '0.35rem' }}
                  />
                  {docVisible ? <Globe size={13} /> : <Lock size={13} />}
                  {docVisible ? 'Visible to client' : 'Hidden from client'}
                </label>
              </div>
            )}
            {docs.length === 0 ? (
              <div className="empty-state"><Paperclip size={36} className="empty-icon" /><p>No documents uploaded.</p></div>
            ) : (
              <div className="doc-list">
                {docs.map((d: any) => (
                  <div key={d.id} className="doc-item">
                    <div className="doc-icon"><FileText size={18} /></div>
                    <div className="doc-info">
                      <span className="doc-name">{d.original_name}</span>
                      <span className="doc-meta">
                        {d.category} · {(d.file_size / 1024).toFixed(1)} KB · {new Date(d.uploaded_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="doc-actions">
                      <a
                        href={documentsApi.downloadUrl(d.id)}
                        className="btn-small"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download
                      </a>
                      {user?.role === 'attorney' && (
                        <button
                          className="btn-small btn-danger"
                          onClick={() => handleDeleteDoc(d.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
