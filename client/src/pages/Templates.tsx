import { useState, useEffect, useRef } from 'react'
import { FileText, Download, Trash2, Upload, Plus, X, Loader2, FolderOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { templatesApi } from '../services/api'

const CATEGORIES = ['all','contract','pleading','motion','letter','affidavit','retainer','other'] as const
type Category = typeof CATEGORIES[number]

interface Template {
  id: number
  title: string
  category: string
  description: string | null
  original_name: string
  file_size: number
  mime_type: string
  is_system: number
  created_at: string
  created_by_name: string | null
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function categoryLabel(cat: string) {
  return cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ')
}

export default function Templates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    title: '', category: 'other', description: '', is_system: false,
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const canManage = user?.role === 'attorney' || user?.role === 'admin'

  const load = async () => {
    setLoading(true)
    try {
      const r = await templatesApi.list()
      setTemplates(r.data.data ?? [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = activeCategory === 'all'
    ? templates
    : templates.filter(t => t.category === activeCategory)

  const grouped = CATEGORIES.slice(1).reduce<Record<string, Template[]>>((acc, cat) => {
    const items = filtered.filter(t => t.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})
  if (activeCategory !== 'all' && filtered.length) {
    Object.assign(grouped, { [activeCategory]: filtered })
  }

  const handleUpload = async () => {
    setUploadError('')
    if (!selectedFile) { setUploadError('Please select a file.'); return }
    if (!uploadForm.title.trim()) { setUploadError('Title is required.'); return }

    setUploading(true)
    const fd = new FormData()
    fd.append('file', selectedFile)
    fd.append('title', uploadForm.title.trim())
    fd.append('category', uploadForm.category)
    fd.append('description', uploadForm.description)
    fd.append('is_system', String(uploadForm.is_system))

    try {
      await templatesApi.upload(fd)
      setShowUploadModal(false)
      setUploadForm({ title: '', category: 'other', description: '', is_system: false })
      setSelectedFile(null)
      await load()
    } catch (e: any) {
      setUploadError(e?.response?.data?.message ?? 'Upload failed.')
    }
    setUploading(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this template?')) return
    try {
      await templatesApi.delete(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch {}
  }

  return (
    <>
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderOpen size={22} style={{ color: 'var(--accent)' }} /> Document Templates
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
              Reusable legal document templates for your practice
            </p>
          </div>
          {canManage && (
            <button className="btn-primary" onClick={() => { setShowUploadModal(true); setUploadError('') }}>
              <Upload size={15} /> Upload Template
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="tab-bar" style={{ marginBottom: '1.25rem' }}>
          {CATEGORIES.map(cat => (
            <button key={cat} className={`tab-btn${activeCategory === cat ? ' active' : ''}`}
              onClick={() => setActiveCategory(cat)}>
              {categoryLabel(cat)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <FileText size={40} className="empty-icon" />
            <p>No templates found{activeCategory !== 'all' ? ` in category "${categoryLabel(activeCategory)}"` : ''}.</p>
            {canManage && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Click "Upload Template" to add one.</p>}
          </div>
        ) : (
          <div>
            {(activeCategory === 'all' ? Object.entries(grouped) : [[activeCategory, filtered]] as any).map(([cat, items]: [string, Template[]]) => (
              <div key={cat} style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
                  {categoryLabel(cat)}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                  {items.map((tpl) => (
                    <div key={tpl.id} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                          <FileText size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpl.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tpl.original_name}</div>
                          </div>
                        </div>
                        {tpl.is_system === 1 && (
                          <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: 999, background: 'var(--accent)', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>System</span>
                        )}
                      </div>
                      {tpl.description && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{tpl.description}</p>
                      )}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                        {fmtSize(tpl.file_size)} • {tpl.created_by_name ?? 'System'} • {new Date(tpl.created_at).toLocaleDateString('en-PH')}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: '0.5rem' }}>
                        <a
                          href={templatesApi.downloadUrl(tpl.id)}
                          download={tpl.original_name}
                          className="btn-primary"
                          style={{ fontSize: '0.78rem', flex: 1, justifyContent: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '0.35rem 0.6rem', borderRadius: 6 }}
                        >
                          <Download size={13} /> Download
                        </a>
                        {canManage && (tpl.is_system === 0 || user?.role === 'admin') && (
                          <button className="btn-small btn-danger" onClick={() => handleDelete(tpl.id)} title="Delete template">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3><Upload size={16} style={{ marginRight: 6 }} /> Upload Template</h3>
              <button className="modal-close" onClick={() => setShowUploadModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-form">
              {uploadError && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{uploadError}</div>
              )}
              <div className="form-group">
                <label>Title *</label>
                <input value={uploadForm.title} onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Retainer Agreement Template" />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={uploadForm.category} onChange={e => setUploadForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.slice(1).map(c => (
                    <option key={c} value={c}>{categoryLabel(c)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional: describe what this template is for" style={{ resize: 'vertical' }} />
              </div>
              {user?.role === 'admin' && (
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
                  <input type="checkbox" id="is_system" checked={uploadForm.is_system} onChange={e => setUploadForm(f => ({ ...f, is_system: e.target.checked }))} style={{ width: 'auto' }} />
                  <label htmlFor="is_system" style={{ margin: 0 }}>System template (visible to all attorneys)</label>
                </div>
              )}
              <div className="form-group">
                <label>File *</label>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx" style={{ display: 'none' }}
                  onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
                <button type="button" className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => fileRef.current?.click()}>
                  <Plus size={14} /> {selectedFile ? selectedFile.name : 'Choose File'}
                </button>
                {selectedFile && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtSize(selectedFile.size)}</p>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn-secondary" onClick={() => setShowUploadModal(false)} disabled={uploading}><X size={13} /> Cancel</button>
                <button className="btn-primary" onClick={handleUpload} disabled={uploading || !selectedFile || !uploadForm.title.trim()}>
                  {uploading ? <><Loader2 size={14} className="spin" /> Uploading…</> : <><Upload size={14} /> Upload</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
