import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Calendar as BigCalendar, dateFnsLocalizer, View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import {
  Scale, FileText, Users, Calendar, MessageSquare, Briefcase, Megaphone,
  Search, Plus, Send, Paperclip, X, Loader2, Image, MoreHorizontal,
  Trash2, Clock, MapPin, ChevronRight, AlertTriangle, CalendarClock, Check, CheckCheck,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import UserAvatar from '../components/UserAvatar'
import GlobalSearch from '../components/GlobalSearch'
import { hearingsApi, announcementsApi, messagesApi, casesApi, deadlinesApi } from '../services/api'
import { io as socketIO, Socket } from 'socket.io-client'

const locales = { 'en-US': enUS }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })

const STATUS_COLOR: Record<string, string> = {
  scheduled: '#c9a84c', completed: '#22c55e', postponed: '#f59e0b', cancelled: '#ef4444',
}

interface Hearing {
  id: number; case_id: number; case_number: string; case_title: string;
  title: string; hearing_type: string; scheduled_at: string;
  location: string | null; notes: string | null;
  status: 'scheduled' | 'completed' | 'postponed' | 'cancelled';
}
interface Announcement {
  id: number; title: string; body: string; case_id: number | null;
  case_number: string | null; case_title: string | null;
  author_name: string; created_at: string;
}
interface Conversation {
  partner_id: number; partner_name: string; partner_username: string;
  partner_role: string; last_message: string | null; last_attachment: string | null;
  last_at: string; unread_count: number;
}
interface Message {
  id: number; sender_id: number; receiver_id: number; sender_name: string;
  content: string | null; is_read: boolean; created_at: string;
  edited_at: string | null; attachment_path: string | null;
  attachment_name: string | null; attachment_mime: string | null;
}
interface Contact { id: number; fullname: string; username: string; role: string }

export default function AttorneyDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // ── Hearings state ───────────────────────────────────
  const [hearings, setHearings] = useState<Hearing[]>([])
  const [loadingH, setLoadingH] = useState(true)
  const [calView, setCalView] = useState<View>('month')
  const [selectedHearing, setSelectedHearing] = useState<Hearing | null>(null)

  // ── Drafts state ─────────────────────────────────────
  const [drafts, setDrafts] = useState<any[]>([])

  // ── Deadline summary state ────────────────────────────
  const [deadlineSummary, setDeadlineSummary] = useState<{ overdue: number; thisWeek: any[] }>({ overdue: 0, thisWeek: [] })

  // ── Announcements state ──────────────────────────────
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loadingA, setLoadingA] = useState(true)

  // ── Messages state ───────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [thread, setThread] = useState<Message[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [activeName, setActiveName] = useState('')
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachPreview, setAttachPreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [msgSearch, setMsgSearch] = useState('')
  const [showContacts, setShowContacts] = useState(false)
  const [menuId, setMenuId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [partnerTyping, setPartnerTyping] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const activeIdRef = useRef<number | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userIdRef = useRef<number | undefined>(undefined)

  // ── Load hearings ────────────────────────────────────
  const loadHearings = useCallback(async () => {
    setLoadingH(true)
    try { const r = await hearingsApi.list(); setHearings(r.data.data) }
    finally { setLoadingH(false) }
  }, [])
  useEffect(() => { loadHearings() }, [loadHearings])

  // ── Load drafts ──────────────────────────────────────
  useEffect(() => {
    casesApi.drafts().then(r => setDrafts(r.data.data ?? [])).catch(() => {})
  }, [])

  // ── Load deadline summary ────────────────────────────
  useEffect(() => {
    deadlinesApi.summary().then(r => setDeadlineSummary({ overdue: r.data.overdue, thisWeek: r.data.thisWeek })).catch(() => {})
  }, [])

  // ── Load announcements ───────────────────────────────
  const loadAnnouncements = useCallback(async () => {
    setLoadingA(true)
    try { const r = await announcementsApi.list(); setAnnouncements(r.data.data) }
    finally { setLoadingA(false) }
  }, [])
  useEffect(() => { loadAnnouncements() }, [loadAnnouncements])

  // ── Load conversations ───────────────────────────────
  const loadConversations = useCallback(async () => {
    try { const r = await messagesApi.conversations(); setConversations(r.data.data) }
    finally { setLoadingConvs(false) }
  }, [])
  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => { messagesApi.contacts().then(r => setContacts(r.data.data)) }, [])

  // ── Keep refs in sync ────────────────────────────────
  useEffect(() => { activeIdRef.current = activeId }, [activeId])
  useEffect(() => { userIdRef.current = user?.id }, [user])

  // ── Socket.io connection ─────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    const socketUrl = import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin
    const socket = socketIO(socketUrl, { auth: { token }, path: '/socket.io' })
    socketRef.current = socket
    socket.on('message:new', (msg: any) => {
      const senderId = msg.sender_id
      if (activeIdRef.current === senderId) {
        setThread(prev => [...prev, msg])
        socket.emit('messages:read', { from: senderId })
      } else {
        setConversations(prev => {
          const exists = prev.some(c => c.partner_id === senderId)
          if (exists) return prev.map(c => c.partner_id === senderId
            ? { ...c, unread_count: c.unread_count + 1, last_message: msg.content, last_at: msg.created_at }
            : c)
          loadConversations()
          return prev
        })
      }
    })
    socket.on('typing:start', (data: { from: number }) => {
      if (activeIdRef.current === data.from) setPartnerTyping(true)
    })
    socket.on('typing:stop', (data: { from: number }) => {
      if (activeIdRef.current === data.from) setPartnerTyping(false)
    })
    socket.on('messages:read', (data: { by: number }) => {
      if (activeIdRef.current === data.by) {
        setThread(prev => prev.map(m =>
          m.sender_id === userIdRef.current ? { ...m, is_read: true } : m
        ))
      }
    })
    return () => { socket.disconnect() }
  }, [loadConversations])

  // ── Resolve partner name ─────────────────────────────
  useEffect(() => {
    if (activeId && !activeName) {
      const c = conversations.find(c => c.partner_id === activeId)
      if (c) { setActiveName(c.partner_name); return }
      const ct = contacts.find(c => c.id === activeId)
      if (ct) setActiveName(ct.fullname)
    }
  }, [conversations, contacts, activeId, activeName])

  // ── Load / poll thread ───────────────────────────────
  const loadThread = useCallback(async (pid: number) => {
    setLoadingThread(true)
    try {
      const r = await messagesApi.thread(pid); setThread(r.data.data)
      setConversations(prev => prev.map(c => c.partner_id === pid ? { ...c, unread_count: 0 } : c))
      if (socketRef.current) socketRef.current.emit('messages:read', { from: pid })
    } finally { setLoadingThread(false) }
  }, [])
  useEffect(() => {
    if (!activeId) return
    loadThread(activeId)
    pollRef.current = setInterval(() => loadThread(activeId), 30_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [activeId, loadThread])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [thread, partnerTyping])

  // ── Close context menu on outside click ──────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('.msg-menu') && !t.closest('.msg-actions-btn')) setMenuId(null)
    }
    if (menuId !== null) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuId])

  // ── Attachment ───────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null; setAttachment(file)
    if (file?.type.startsWith('image/')) setAttachPreview(URL.createObjectURL(file))
    else setAttachPreview(null); e.target.value = ''
  }
  const clearAttachment = () => {
    if (attachPreview) URL.revokeObjectURL(attachPreview)
    setAttachment(null); setAttachPreview(null)
  }

  // ── Conversation selection ───────────────────────────
  const selectConversation = (conv: Conversation) => {
    setActiveId(conv.partner_id); setActiveName(conv.partner_name)
    setShowContacts(false); setEditingId(null); setMenuId(null)
  }
  const startNew = (contact: Contact) => {
    setActiveId(contact.id); setActiveName(contact.fullname)
    setShowContacts(false); setThread([]); setEditingId(null); setMenuId(null)
  }

  // ── Send ─────────────────────────────────────────────
  const handleSend = async () => {
    if ((!draft.trim() && !attachment) || !activeId) return
    setSending(true)
    const text = draft.trim(); const file = attachment; setDraft('')
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    if (activeId && socketRef.current) socketRef.current.emit('typing:stop', { to: activeId })
    if (attachPreview) URL.revokeObjectURL(attachPreview)
    setAttachment(null); setAttachPreview(null)
    try {
      await messagesApi.send({ receiver_id: activeId, content: text || undefined, attachment: file })
      await loadThread(activeId); await loadConversations()
    } finally { setSending(false) }
  }

  // ── Edit / Delete message ────────────────────────────
  const startEdit = (m: Message) => { setEditingId(m.id); setEditDraft(m.content || ''); setMenuId(null) }
  const submitEdit = async () => {
    if (!editingId || !editDraft.trim()) return
    try {
      await messagesApi.editMessage(editingId, editDraft.trim())
      const now = new Date().toISOString()
      setThread(prev => prev.map(m => m.id === editingId ? { ...m, content: editDraft.trim(), edited_at: now } : m))
    } finally { setEditingId(null) }
  }
  const handleDeleteMsg = async (id: number, type: 'for_me' | 'for_everyone') => {
    setMenuId(null)
    try { await messagesApi.deleteMessage(id, type); setThread(prev => prev.filter(m => m.id !== id)) }
    catch (err: any) { alert(err.response?.data?.message || 'Failed to delete message.') }
  }
  const handleDeleteConversation = async () => {
    if (!activeId) return
    if (!window.confirm(`Delete your conversation with ${activeName}?`)) return
    try {
      await messagesApi.deleteConversation(activeId)
      setConversations(prev => prev.filter(c => c.partner_id !== activeId))
      setActiveId(null); setThread([]); setActiveName('')
    } catch (err: any) { alert(err.response?.data?.message || 'Failed.') }
  }

  const renderAttachment = (m: Message) => {
    if (!m.attachment_name) return null
    const url = messagesApi.attachmentUrl(m.id)
    if (m.attachment_mime?.startsWith('image/'))
      return <a href={url} target="_blank" rel="noreferrer" className="msg-img-link"><img src={url} alt={m.attachment_name} className="msg-img" /></a>
    return <a href={url} target="_blank" rel="noreferrer" className="msg-file-card"><FileText size={15} /><span>{m.attachment_name}</span></a>
  }

  const filteredConvs = conversations.filter(c => c.partner_name.toLowerCase().includes(msgSearch.toLowerCase()))

  // ── Calendar events ──────────────────────────────────
  const calEvents = hearings.filter(h => h.status !== 'cancelled').map(h => ({
    id: h.id,
    title: `${h.case_number} — ${h.title}`,
    start: new Date(h.scheduled_at),
    end: new Date(new Date(h.scheduled_at).getTime() + 60 * 60 * 1000),
    resource: h,
  }))
  const eventStyleGetter = (event: any) => ({
    style: {
      backgroundColor: STATUS_COLOR[event.resource.status] ?? '#4a90d9',
      border: 'none', borderRadius: '4px', color: '#0f172a', fontSize: '0.75rem', fontWeight: 600,
    },
  })

  const upcoming = hearings
    .filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) >= new Date())
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 5)

  return (
    <div className="dashboard-split">
      {/* ── Nav ─────────────────────────────────────────── */}
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className="role-badge attorney">Attorney</span>
          <GlobalSearch />
          <NotificationBell />
          <SettingsDropdown />
        </div>
      </nav>

      {/* ── Body ────────────────────────────────────────── */}
      <div className="dash-body">
        {/* ─── Left Sidebar ─── */}
        <aside className="dash-sidebar">
          <div className="sidebar-user">
            <UserAvatar
              userId={user!.id}
              fullname={user!.fullname}
              className="user-avatar"
            />
            <div className="user-meta">
              <strong>{user?.fullname}</strong>
              <span>@{user?.username}</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button className="sidebar-btn" onClick={() => navigate('/cases')}>
              <Briefcase size={17} /> My Cases
            </button>
            <button className="sidebar-btn" onClick={() => navigate('/clients')}>
              <Users size={17} /> Clients
            </button>
            <button className="sidebar-btn" onClick={() => navigate('/secretary-management')}>
              <Users size={17} /> Secretaries
            </button>
            <button className="sidebar-btn" onClick={() => navigate('/announcements')}>
              <Megaphone size={17} /> Announcements
            </button>
          </nav>

          {/* Upcoming hearings in sidebar */}
          {upcoming.length > 0 && (
            <div className="sidebar-upcoming">
              <h4>Upcoming Hearings</h4>
              {upcoming.map(h => (
                <div key={h.id} className="upcoming-item" onClick={() => setSelectedHearing(h)}>
                  <div className="upcoming-dot" style={{ background: STATUS_COLOR[h.status] }} />
                  <div className="upcoming-info">
                    <strong>{h.title}</strong>
                    <span>{new Date(h.scheduled_at).toLocaleDateString()} · {h.case_number}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Deadline summary widget */}
          {(deadlineSummary.overdue > 0 || deadlineSummary.thisWeek.length > 0) && (
            <div className="sidebar-upcoming" style={{ borderTop: '1px solid #f1f5f9' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CalendarClock size={14} /> Deadlines
              </h4>
              {deadlineSummary.overdue > 0 && (
                <div
                  className="upcoming-item"
                  onClick={() => navigate('/cases?overdue_only=true')}
                  style={{ cursor: 'pointer', background: '#fef2f2', borderRadius: 8, padding: '0.4rem 0.6rem', marginBottom: '0.35rem' }}
                >
                  <AlertTriangle size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
                  <div className="upcoming-info" style={{ marginLeft: 6 }}>
                    <strong style={{ color: '#dc2626' }}>{deadlineSummary.overdue} overdue deadline{deadlineSummary.overdue !== 1 ? 's' : ''}</strong>
                    <span>Tap to view cases</span>
                  </div>
                </div>
              )}
              {deadlineSummary.thisWeek.map((d: any) => (
                <div
                  key={d.id}
                  className="upcoming-item"
                  onClick={() => navigate(`/cases/${d.case_id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="upcoming-dot" style={{ background: '#6366f1' }} />
                  <div className="upcoming-info">
                    <strong>{d.title}</strong>
                    <span>{new Date(d.due_date).toLocaleDateString()} · {d.case_number}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ─── Center: Calendar + Announcements ─── */}
        <main className="dash-center">
          <div className="center-section">
            <div className="center-section-header">
              <h3><Calendar size={18} className="cal-panel-icon" /> Calendar</h3>
              <button className="btn-link" onClick={() => navigate('/hearings')}>
                View all <ChevronRight size={14} />
              </button>
            </div>
            {loadingH ? (
              <div className="loading-state small"><Loader2 size={22} className="spin" /></div>
            ) : (
              <div className="cal-panel-calendar">
                <BigCalendar
                  localizer={localizer}
                  events={calEvents}
                  view={calView}
                  onView={v => setCalView(v)}
                  style={{ height: 420 }}
                  eventPropGetter={eventStyleGetter}
                  onSelectEvent={(ev: any) => setSelectedHearing(ev.resource)}
                  popup
                />
              </div>
            )}
            {selectedHearing && (
              <div className="cal-panel-detail">
                <div className="cal-detail-bar" style={{ background: STATUS_COLOR[selectedHearing.status] }} />
                <div className="cal-detail-body">
                  <div className="cal-detail-top">
                    <strong>{selectedHearing.title}</strong>
                    <span className={`hearing-badge status-${selectedHearing.status}`}>{selectedHearing.status}</span>
                  </div>
                  <div className="cal-detail-time">
                    <Clock size={13} /> {new Date(selectedHearing.scheduled_at).toLocaleString()}
                  </div>
                  {selectedHearing.location && (
                    <div className="cal-detail-loc"><MapPin size={13} /> {selectedHearing.location}</div>
                  )}
                </div>
                <button className="cal-detail-close" onClick={() => setSelectedHearing(null)}>&times;</button>
              </div>
            )}
          </div>

          {/* ── Pending Drafts Section ── */}
          {drafts.length > 0 && (
            <div className="center-section">
              <div className="center-section-header">
                <h3><FileText size={18} className="cal-panel-icon" /> Pending Drafts</h3>
                <button className="btn-link" onClick={() => navigate('/cases')}>View all <ChevronRight size={14} /></button>
              </div>
              <div className="announcements-feed">
                {drafts.slice(0, 5).map(d => (
                  <div key={d.id} className="announce-feed-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/cases/${d.id}`)} role="button" tabIndex={0}>
                    <div className="announce-feed-top">
                      <span className="announce-feed-tag"><Briefcase size={11} /> {d.case_number}</span>
                      <span className="announce-feed-date" style={{ color: '#a78bfa', fontWeight: 600 }}>Draft</span>
                    </div>
                    <strong>{d.title}</strong>
                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Submitted by secretary — click to review</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Announcements Section ── */}
          <div className="center-section">
            <div className="center-section-header">
              <h3><Megaphone size={18} className="cal-panel-icon" /> Announcements</h3>
              <button className="btn-link" onClick={() => navigate('/announcements')}>
                View all <ChevronRight size={14} />
              </button>
            </div>
            {loadingA ? (
              <div className="loading-state small"><Loader2 size={22} className="spin" /></div>
            ) : announcements.length === 0 ? (
              <p className="empty-state-sm">No announcements yet.</p>
            ) : (
              <div className="announcements-feed">
                {announcements.slice(0, 5).map(a => (
                  <div key={a.id} className="announce-feed-item">
                    <div className="announce-feed-top">
                      <span className="announce-feed-tag">
                        {a.case_number ? <><Briefcase size={11} /> {a.case_number}</> : 'Firm-wide'}
                      </span>
                      <span className="announce-feed-date">{new Date(a.created_at).toLocaleDateString()}</span>
                    </div>
                    <strong>{a.title}</strong>
                    <p>{a.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* ─── Right Sidebar: Messages ─── */}
        <aside className="dash-messages-panel">
          <div className="mp-compact">
            {!activeId ? (
              <div className="mp-compact-list">
                <div className="mp-compact-list-header">
                  <MessageSquare size={16} />
                  <span className="mp-compact-title">Messages</span>
                  <button className="btn-icon" title="New conversation" onClick={() => setShowContacts(v => !v)}>
                    <Plus size={15} />
                  </button>
                </div>
                <div className="mp-compact-search">
                  <Search size={13} className="search-icon" />
                  <input placeholder="Search…" value={msgSearch} onChange={e => setMsgSearch(e.target.value)} />
                </div>
                {showContacts && (
                  <div className="contacts-list compact">
                    <p className="contacts-label">New conversation</p>
                    {contacts.map(c => (
                      <div key={c.id} className="contact-item" onClick={() => startNew(c)} role="button" tabIndex={0}>
                        <div className="conv-avatar sm">{c.fullname.charAt(0).toUpperCase()}</div>
                        <div><strong>{c.fullname}</strong><span className="conv-role">{c.role}</span></div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mp-compact-convs">
                  {loadingConvs && <div className="loading-state small"><Loader2 size={16} className="spin" /></div>}
                  {!loadingConvs && filteredConvs.length === 0 && (
                    <p className="conv-empty">{conversations.length === 0 ? 'No conversations yet.' : 'No results.'}</p>
                  )}
                  {filteredConvs.map(c => (
                    <div key={c.partner_id} className="mp-compact-conv-item" onClick={() => selectConversation(c)}>
                      <div className="conv-avatar sm">{c.partner_name.charAt(0).toUpperCase()}</div>
                      <div className="mp-compact-conv-info">
                        <div className="mp-compact-conv-top">
                          <strong>{c.partner_name}</strong>
                          {c.unread_count > 0 && <span className="conv-unread">{c.unread_count}</span>}
                        </div>
                        <span className="mp-compact-conv-preview">
                          {c.last_message || (c.last_attachment ? `📎 ${c.last_attachment}` : '')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mp-compact-thread">
                <div className="mp-compact-thread-header">
                  <button className="btn-icon" onClick={() => { setActiveId(null); setActiveName(''); setThread([]) }}>
                    <X size={15} />
                  </button>
                  <span className="mp-compact-partner">{activeName}</span>
                  <button className="btn-icon" title="Delete conversation" onClick={handleDeleteConversation} style={{ color: 'var(--danger)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mp-compact-messages">
                  {loadingThread && thread.length === 0 && <div className="loading-state small"><Loader2 size={16} className="spin" /></div>}
                  {thread.length === 0 && !loadingThread && <p className="conv-empty" style={{ margin: 'auto' }}>Say hello!</p>}
                  {thread.map(m => {
                    const mine = m.sender_id === user?.id
                    const isEditing = editingId === m.id
                    const hasText = m.content !== null && m.content !== ''
                    return (
                      <div key={m.id} className={`chat-bubble-wrap ${mine ? 'mine' : 'theirs'}`}>
                        {mine && (
                          <div className="msg-actions-wrap">
                            <button className="msg-actions-btn" onClick={() => setMenuId(menuId === m.id ? null : m.id)}>
                              <MoreHorizontal size={12} />
                            </button>
                            {menuId === m.id && (
                              <div className="msg-menu mine">
                                {hasText && <button onClick={() => startEdit(m)}>Edit</button>}
                                <button onClick={() => handleDeleteMsg(m.id, 'for_me')}>Delete for me</button>
                                <button className="danger" onClick={() => handleDeleteMsg(m.id, 'for_everyone')}>Delete for everyone</button>
                              </div>
                            )}
                          </div>
                        )}
                        <div className={`chat-bubble ${mine ? 'mine' : 'theirs'}`}>
                          {isEditing ? (
                            <div className="bubble-edit">
                              <textarea value={editDraft} onChange={e => setEditDraft(e.target.value)} autoFocus
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit() } if (e.key === 'Escape') setEditingId(null) }} />
                              <div className="bubble-edit-actions"><button onClick={submitEdit}>Save</button><button onClick={() => setEditingId(null)}>Cancel</button></div>
                            </div>
                          ) : (
                            <>
                              {renderAttachment(m)}
                              {hasText && <p>{m.content}</p>}
                              <div className="bubble-meta">
                                {m.edited_at && <span className="msg-edited">edited</span>}
                                {mine && (
                                  <span className="msg-status" title={m.is_read ? 'Seen' : 'Sent'}>
                                    {m.is_read
                                      ? <CheckCheck size={12} style={{ color: '#3b82f6', verticalAlign: 'middle' }} />
                                      : <Check size={12} style={{ color: 'rgba(15,23,42,0.6)', verticalAlign: 'middle' }} />}
                                  </span>
                                )}
                                <span className="bubble-time">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </>
                          )}
                        </div>
                        {!mine && (
                          <div className="msg-actions-wrap">
                            <button className="msg-actions-btn" onClick={() => setMenuId(menuId === m.id ? null : m.id)}>
                              <MoreHorizontal size={12} />
                            </button>
                            {menuId === m.id && (
                              <div className="msg-menu theirs"><button onClick={() => handleDeleteMsg(m.id, 'for_me')}>Delete for me</button></div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                  {partnerTyping && (
                    <div className="typing-indicator">
                      <span className="typing-bubble" /><span className="typing-bubble" /><span className="typing-bubble" />
                      <span style={{ marginLeft: 6, color: '#64748b', fontSize: '0.78rem' }}>{activeName} is typing…</span>
                    </div>
                  )}
                </div>
                <div className="chat-compose-wrap">
                  {attachment && (
                    <div className="attach-preview-strip">
                      {attachPreview ? <img src={attachPreview} alt="preview" className="attach-thumb" /> : <div className="attach-file-chip"><FileText size={13} /><span>{attachment.name}</span></div>}
                      <button className="attach-remove" onClick={clearAttachment} title="Remove"><X size={13} /></button>
                    </div>
                  )}
                  <div className="chat-compose">
                    <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} onChange={handleFileChange} />
                    <button className="btn-attach" title="Attach" onClick={() => fileRef.current?.click()} type="button">
                      {attachment?.type.startsWith('image/') ? <Image size={15} /> : <Paperclip size={15} />}
                    </button>
                    <textarea rows={1} placeholder="Type a message…" value={draft}
                      onChange={e => {
                        setDraft(e.target.value)
                        if (activeId && socketRef.current) {
                          if (e.target.value) {
                            socketRef.current.emit('typing:start', { to: activeId })
                            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
                            typingTimeoutRef.current = setTimeout(() => { socketRef.current?.emit('typing:stop', { to: activeId }) }, 1500)
                          } else {
                            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
                            socketRef.current.emit('typing:stop', { to: activeId })
                          }
                        }
                      }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} />
                    <button className="btn-send" onClick={handleSend} disabled={(!draft.trim() && !attachment) || sending}>
                      {sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
