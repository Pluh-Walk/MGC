import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useState, useEffect, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, Plus, Calendar as CalIcon,
  List, MapPin, FileText, Loader2, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { hearingsApi, casesApi } from '../services/api'

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
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const isAttorney = user?.role === 'attorney'

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
    if (!isAttorney) return
    casesApi.list().then(r =>
      setCases(r.data.data.map((c: any) => ({
        id: c.id, case_number: c.case_number, title: c.title
      })))
    )
  }, [isAttorney])

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
            {isAttorney && (
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
              <div className="rbc-wrap">
                <Calendar
                  localizer={localizer}
                  events={events}
                  view={calView}
                  onView={(v) => setCalView(v)}
                  style={{ height: 600 }}
                  eventPropGetter={eventStyleGetter}
                  onSelectEvent={(ev: any) => isAttorney && openEdit(ev.resource)}
                  popup
                />
              </div>
            )}

            {/* ── List View ── */}
            {view === 'list' && (
              <div className="hearings-list">
                {hearings.length === 0 && (
                  <p className="empty-state">No hearings scheduled.</p>
                )}
                {hearings.map(h => (
                  <div key={h.id} className="hearing-row">
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
                    {isAttorney && (
                      <div className="hearing-actions">
                        <button className="btn-sm" onClick={() => openEdit(h)}>Edit</button>
                        <button className="btn-sm danger" onClick={() => handleDelete(h.id)}>Cancel</button>
                      </div>
                    )}
                  </div>
                ))}
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
