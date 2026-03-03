import { useState, useEffect, useRef } from 'react'
import { Bell, X, Check } from 'lucide-react'
import { notificationsApi } from '../services/api'

interface Notif {
  id: number
  type: string
  message: string
  reference_id: number | null
  is_read: boolean
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  hearing_reminder:  'Hearing',
  case_update:       'Case Update',
  document_uploaded: 'Document',
  note_added:        'Note',
  announcement:      'Announcement',
  password_reset:    'Security',
}

export default function NotificationBell() {
  const [open,    setOpen]    = useState(false)
  const [unread,  setUnread]  = useState(0)
  const [notifs,  setNotifs]  = useState<Notif[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // ── SSE: live unread count ───────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const es = new EventSource(
      `/api/notifications/stream?token=${encodeURIComponent(token)}`
    )
    es.onmessage = (e) => {
      try { setUnread(JSON.parse(e.data).unread ?? 0) } catch {}
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [])

  // ── Close on outside click ───────────────────────────────
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await notificationsApi.list()
      setNotifs(res.data.data)
      setUnread(res.data.unread)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next) load()
  }

  const markAll = async () => {
    await notificationsApi.markAllRead()
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnread(0)
  }

  const markOne = async (id: number) => {
    await notificationsApi.markOneRead(id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  return (
    <div className="notif-wrapper" ref={ref}>
      <button
        className={`btn-notif${open ? ' active' : ''}`}
        onClick={handleToggle}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-title">Notifications</span>
            {unread > 0 && (
              <button className="notif-mark-all" onClick={markAll}>
                <Check size={12} /> Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {loading && <p className="notif-empty">Loading…</p>}
            {!loading && notifs.length === 0 && (
              <p className="notif-empty">You're all caught up!</p>
            )}
            {!loading && notifs.map(n => (
              <div
                key={n.id}
                className={`notif-item${n.is_read ? '' : ' unread'}`}
                onClick={() => !n.is_read && markOne(n.id)}
                role="button"
                tabIndex={0}
              >
                <div className="notif-item-body">
                  <span className="notif-type-tag">
                    {TYPE_LABELS[n.type] ?? n.type}
                  </span>
                  <p className="notif-message">{n.message}</p>
                  <span className="notif-time">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
                {!n.is_read && (
                  <button
                    className="notif-dismiss"
                    title="Dismiss"
                    onClick={e => { e.stopPropagation(); markOne(n.id) }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
