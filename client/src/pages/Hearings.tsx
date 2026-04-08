import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useState, useEffect, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, Plus, Calendar as CalIcon,
  List, MapPin, FileText, Loader2, X, Download,
  Video, CheckSquare, Square, Trash2, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import api, { hearingsApi, casesApi } from '../services/api'

const locales = { 'en-US': enUS }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })

interface Hearing {
  id: number
  case_id: number
  case_number: string
  case_title: string
  title: string
  hearing_type: string
  scheduled_at: string
  location: string | null
  notes: string | null
  status: 'scheduled' | 'completed' | 'postponed' | 'cancelled'
}

interface ChecklistItem {
  id: number
  hearing_id: number
  label: string
  is_done: number
  done_by_name: string | null
}

interface CaseOption { id: number; case_number: string; title: string }

const BLANK = {
  case_id: '',
  title: '',
  hearing_type: 'other',
  scheduled_at: '',
  location: '',
  notes: '',
}

const STATUS_COLOR: Record<string, string> = {
  scheduled:  '#c9a84c',
  completed:  '#22c55e',
  postponed:  '#f59e0b',
  cancelled:  '#ef4444',
}

export default function Hearings() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [hearings,  setHearings]  = useState<Hearing[]>([])
  const [cases,     setCases]     = useState<CaseOption[]>([])
  const [loading,   setLoading]   = useState(true)
  const [view,      setView]      = useState<'calendar' | 'list'>('calendar')
  const [calView,   setCalView]   = useState<View>('month')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<Hearing | null>(null)
  const [form,      setForm]      = useState({ ...BLANK })
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [exportingIcal, setExportingIcal] = useState(false)

  // ── Hearing detail panel ─────────────────────────────────────
  const [selectedHearing, setSelectedHearing] = useState<Hearing | null>(null)
  const [checklist,       setChecklist]       = useState<ChecklistItem[]>([])
  const [ckLoading,       setCkLoading]       = useState(false)
  const [newItem,         setNewItem]         = useState('')
  const [addingItem,      setAddingItem]      = useState(false)

  const openDetail = useCallback(async (h: Hearing) => {
    setSelectedHearing(h)
    setCkLoading(true)
    try {
      const res = await api.get(`/hearings/${h.id}/checklist`)
      setChecklist(res.data.data)
    } catch { setChecklist([]) }
    finally { setCkLoading(false) }
  }, [])

  const handleToggleItem = async (item: ChecklistItem) => {
    await api.patch(`/hearings/${selectedHearing!.id}/checklist/${item.id}/toggle`)
    setChecklist(cl => cl.map(c => c.id === item.id ? { ...c, is_done: c.is_done ? 0 : 1 } : c))
  }

  const handleAddItem = async () => {
    if (!newItem.trim()) return
    setAddingItem(true)
    try {
      const res = await api.post(`/hearings/${selectedHearing!.id}/checklist`, { label: newItem.trim() })
      setChecklist(cl => [...cl, res.data.data])
      setNewItem('')
    } catch { /* noop */ }
    finally { setAddingItem(false) }
  }

  const handleDeleteItem = async (itemId: number) => {
    await api.delete(`/hearings/${selectedHearing!.id}/checklist/${itemId}`)
    setChecklist(cl => cl.filter(c => c.id !== itemId))
  }

  const jitsiUrl = (h: Hearing) =>
    `https://meet.jit.si/mgc-${h.case_number.replace(/[^a-zA-Z0-9]/g, '-')}`

  const isAttorney = user?.role === 'attorney'
  const canManage = user?.role === 'attorney' || user?.role === 'secretary'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await hearingsApi.list()
      setHearings(res.data.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!canManage) return
    casesApi.list().then(r =>
      setCases(r.data.data.map((c: any) => ({
        id: c.id, case_number: c.case_number, title: c.title
      })))
    )
  }, [canManage])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...BLANK })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (h: Hearing) => {
    setEditing(h)
    setForm({
      case_id:      String(h.case_id),
      title:        h.title,
      hearing_type: h.hearing_type,
      scheduled_at: h.scheduled_at.slice(0, 16), // datetime-local format
      location:     h.location ?? '',
      notes:        h.notes ?? '',
    })
    setError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.case_id || !form.title || !form.scheduled_at) {
      setError('Case, title, and date/time are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await hearingsApi.update(editing.id, form)
      } else {
        await hearingsApi.create(form)
      }
      setModalOpen(false)
      await load()
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const handleExportIcal = async () => {
    setExportingIcal(true)
    try {
      const res = await api.get('/hearings/export/ical', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/calendar' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'mgc-hearings.ics'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to export calendar.')
    } finally {
      setExportingIcal(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Cancel this hearing?')) return
    await hearingsApi.delete(id)
    await load()
  }

  // react-big-calendar events
  const events = hearings
    .filter(h => h.status !== 'cancelled')
    .map(h => ({
      id:    h.id,
      title: `${h.case_number} — ${h.title}`,
      start: new Date(h.scheduled_at),
      end:   new Date(new Date(h.scheduled_at).getTime() + 60 * 60 * 1000),
      resource: h,
    }))

  const eventStyleGetter = (event: any) => ({
    style: {
      backgroundColor: STATUS_COLOR[event.resource.status] ?? '#4a90d9',
      border: 'none',
      borderRadius: '4px',
      color: '#0f172a',
      fontSize: '0.75rem',
      fontWeight: 600,
    },
  })

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
        {exportingIcal && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontSize: '0.85rem' }}>
            <Loader2 size={15} className="spin" /> Preparing calendar file…
          </div>
        )}
      </nav>

      <main className="dash-content">
        {/* Header */}
        <div className="page-header">
          <button className="btn-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </button>
          <h2>
            <CalIcon size={20} style={{ marginRight: '0.5rem', color: 'var(--accent)' }} />
            Hearings &amp; Calendar
          </h2>
          <div className="page-header-actions">
            <div className="view-toggle">
              <button
                className={`view-btn${view === 'calendar' ? ' active' : ''}`}
                onClick={() => setView('calendar')}
              >
                <CalIcon size={14} /> Calendar
              </button>
              <button
                className={`view-btn${view === 'list' ? ' active' : ''}`}
                onClick={() => setView('list')}
              >
                <List size={14} /> List
              </button>
            </div>
            <button
              className="btn-secondary"
              onClick={handleExportIcal}
              disabled={exportingIcal}
              title="Download .ics to import into Google Calendar, Outlook, etc."
            >
              {exportingIcal
                ? <><Loader2 size={14} className="spin" /> Exporting…</>
                : <><Download size={14} /> Export to Calendar</>}
            </button>
            {canManage && (
              <button className="btn-primary" onClick={openCreate}>
                <Plus size={16} /> Schedule Hearing
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <Loader2 size={28} className="spin" />
            <p>Loading hearings…</p>
          </div>
        ) : (
          <>
            {/* ── Calendar View ── */}
            {view === 'calendar' && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div className="rbc-wrap" style={{ flex: 1, minWidth: 0 }}>
                  <Calendar
                    localizer={localizer}
                    events={events}
                    view={calView}
                    onView={(v) => setCalView(v)}
                    style={{ height: 600 }}
                    eventPropGetter={eventStyleGetter}
                    onSelectEvent={(ev: any) => openDetail(ev.resource)}
                    popup
                  />
                </div>

                {/* Detail panel for calendar view */}
                {selectedHearing && (
                  <div style={{
                    width: 340, flexShrink: 0,
                    background: 'var(--surface-solid)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: 20,
                    position: 'sticky', top: 16,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
                          {selectedHearing.title}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {selectedHearing.case_number}
                        </div>
                      </div>
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                        onClick={() => setSelectedHearing(null)}
                      ><X size={16} /></button>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.7 }}>
                      <div><CalIcon size={12} style={{ marginRight: 4 }} />{new Date(selectedHearing.scheduled_at).toLocaleString()}</div>
                      {selectedHearing.location && <div><MapPin size={12} style={{ marginRight: 4 }} />{selectedHearing.location}</div>}
                    </div>

                    <a
                      href={jitsiUrl(selectedHearing)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', borderRadius: 8,
                        background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                        border: '1px solid rgba(34,197,94,0.2)',
                        textDecoration: 'none', fontSize: '0.83rem', fontWeight: 600,
                        marginBottom: 16,
                      }}
                    >
                      <Video size={14} /> Join Video Conference (Jitsi)
                    </a>

                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8, color: 'var(--text)' }}>
                      Preparation Checklist
                    </div>

                    {ckLoading ? (
                      <div style={{ textAlign: 'center', padding: 16 }}><Loader2 size={18} className="spin" /></div>
                    ) : (
                      <>
                        {checklist.length === 0 && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>No items yet.</p>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                          {checklist.map(item => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: item.is_done ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0 }}
                                onClick={() => handleToggleItem(item)}
                              >
                                {item.is_done ? <CheckSquare size={16} /> : <Square size={16} />}
                              </button>
                              <span style={{ flex: 1, fontSize: '0.83rem', color: item.is_done ? 'var(--text-muted)' : 'var(--text)', textDecoration: item.is_done ? 'line-through' : 'none' }}>
                                {item.label}
                              </span>
                              {canManage && (
                                <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }} onClick={() => handleDeleteItem(item.id)}>
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {canManage && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              style={{ flex: 1, fontSize: '0.82rem', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }}
                              placeholder="Add checklist item…"
                              value={newItem}
                              onChange={e => setNewItem(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                            />
                            <button className="btn-primary" style={{ padding: '5px 10px', fontSize: '0.8rem' }} onClick={handleAddItem} disabled={addingItem || !newItem.trim()}>
                              {addingItem ? <Loader2 size={12} className="spin" /> : '+'}
                            </button>
                          </div>
                        )}
                        {canManage && (
                          <button className="btn-sm" style={{ marginTop: 12, width: '100%' }} onClick={() => openEdit(selectedHearing)}>
                            Edit Hearing
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── List View ── */}
            {view === 'list' && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div className="hearings-list" style={{ flex: 1, minWidth: 0 }}>
                  {hearings.length === 0 && (
                    <p className="empty-state">No hearings scheduled.</p>
                  )}
                  {hearings.map(h => (
                    <div
                      key={h.id}
                      className={`hearing-row${selectedHearing?.id === h.id ? ' selected' : ''}`}
                      onClick={() => openDetail(h)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div
                        className="hearing-status-bar"
                        style={{ background: STATUS_COLOR[h.status] }}
                      />
                      <div className="hearing-info">
                        <div className="hearing-meta-top">
                          <span className="hearing-case-num">{h.case_number}</span>
                          <span className={`hearing-badge status-${h.status}`}>{h.status}</span>
                        </div>
                        <strong className="hearing-title">{h.title}</strong>
                        <div className="hearing-details">
                          <span>
                            <CalIcon size={13} />
                            {new Date(h.scheduled_at).toLocaleString()}
                          </span>
                          {h.location && (
                            <span><MapPin size={13} /> {h.location}</span>
                          )}
                          {h.notes && (
                            <span><FileText size={13} /> {h.notes}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {canManage && (
                          <div className="hearing-actions" onClick={e => e.stopPropagation()}>
                            <button className="btn-sm" onClick={() => openEdit(h)}>Edit</button>
                            {isAttorney && (
                              <button className="btn-sm danger" onClick={() => handleDelete(h.id)}>Cancel</button>
                            )}
                          </div>
                        )}
                        <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Detail Panel ─────────────────────────────────── */}
                {selectedHearing && (
                  <div style={{
                    width: 340, flexShrink: 0,
                    background: 'var(--surface-solid)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: 20,
                    position: 'sticky', top: 16,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
                          {selectedHearing.title}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {selectedHearing.case_number}
                        </div>
                      </div>
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                        onClick={() => setSelectedHearing(null)}
                      ><X size={16} /></button>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.7 }}>
                      <div><CalIcon size={12} style={{ marginRight: 4 }} />{new Date(selectedHearing.scheduled_at).toLocaleString()}</div>
                      {selectedHearing.location && <div><MapPin size={12} style={{ marginRight: 4 }} />{selectedHearing.location}</div>}
                    </div>

                    {/* Jitsi Meet Link */}
                    <a
                      href={jitsiUrl(selectedHearing)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', borderRadius: 8,
                        background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                        border: '1px solid rgba(34,197,94,0.2)',
                        textDecoration: 'none', fontSize: '0.83rem', fontWeight: 600,
                        marginBottom: 16,
                      }}
                    >
                      <Video size={14} /> Join Video Conference (Jitsi)
                    </a>

                    {/* Checklist */}
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8, color: 'var(--text)' }}>
                      Preparation Checklist
                    </div>

                    {ckLoading ? (
                      <div style={{ textAlign: 'center', padding: 16 }}>
                        <Loader2 size={18} className="spin" />
                      </div>
                    ) : (
                      <>
                        {checklist.length === 0 && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                            No items yet.
                          </p>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                          {checklist.map(item => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: item.is_done ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0 }}
                                onClick={() => handleToggleItem(item)}
                              >
                                {item.is_done ? <CheckSquare size={16} /> : <Square size={16} />}
                              </button>
                              <span style={{
                                flex: 1, fontSize: '0.83rem',
                                color: item.is_done ? 'var(--text-muted)' : 'var(--text)',
                                textDecoration: item.is_done ? 'line-through' : 'none',
                              }}>
                                {item.label}
                              </span>
                              {canManage && (
                                <button
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
                                  onClick={() => handleDeleteItem(item.id)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {canManage && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              style={{
                                flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)',
                                borderRadius: 6, padding: '5px 10px', fontSize: '0.82rem', color: 'var(--text)',
                              }}
                              placeholder="Add checklist item…"
                              value={newItem}
                              onChange={e => setNewItem(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleAddItem() }}
                            />
                            <button
                              className="btn-primary"
                              style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                              onClick={handleAddItem}
                              disabled={addingItem || !newItem.trim()}
                            >
                              {addingItem ? <Loader2 size={13} className="spin" /> : <Plus size={13} />}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Modal ─────────────────────────────────────────── */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Hearing' : 'Schedule Hearing'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {error && <p className="form-error">{error}</p>}

            <div className="form-group">
              <label>Case *</label>
              <select
                value={form.case_id}
                onChange={e => setForm({ ...form, case_id: e.target.value })}
                disabled={!!editing}
              >
                <option value="">Select a case…</option>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                placeholder="e.g. Pre-trial Hearing"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="modal-row">
              <div className="form-group">
                <label>Type</label>
                <select
                  value={form.hearing_type}
                  onChange={e => setForm({ ...form, hearing_type: e.target.value })}
                >
                  {['initial','trial','motion','deposition','settlement','other'].map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Date &amp; Time *</label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                placeholder="Courtroom / address"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                rows={3}
                placeholder="Additional notes…"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {editing && (
              <div className="form-group">
                <label>Status</label>
                <select
                  value={(form as any).status ?? editing.status}
                  onChange={e => setForm({ ...form, ...({ status: e.target.value } as any) })}
                >
                  {['scheduled','completed','postponed','cancelled'].map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={15} className="spin" /> : null}
                {editing ? 'Save Changes' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
