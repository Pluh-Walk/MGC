import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Scale, ArrowLeft, Send, MessageSquare, Search, Loader2, Plus,
  Paperclip, X, FileText, Image, MoreHorizontal, Trash2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { messagesApi } from '../services/api'

interface Conversation {
  partner_id: number
  partner_name: string
  partner_username: string
  partner_role: string
  last_message: string | null
  last_attachment: string | null
  last_at: string
  unread_count: number
}

interface Message {
  id: number
  sender_id: number
  receiver_id: number
  sender_name: string
  content: string | null
  is_read: boolean
  created_at: string
  edited_at: string | null
  attachment_path: string | null
  attachment_name: string | null
  attachment_mime: string | null
}

interface Contact {
  id: number
  fullname: string
  username: string
  role: string
}

export default function Messages() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [conversations,  setConversations]  = useState<Conversation[]>([])
  const [contacts,       setContacts]       = useState<Contact[]>([])
  const [thread,         setThread]         = useState<Message[]>([])
  const [activeId,       setActiveId]       = useState<number | null>(
    searchParams.get('with') ? Number(searchParams.get('with')) : null
  )
  const [activeName,     setActiveName]     = useState('')
  const [draft,          setDraft]          = useState('')
  const [attachment,     setAttachment]     = useState<File | null>(null)
  const [attachPreview,  setAttachPreview]  = useState<string | null>(null)
  const [sending,        setSending]        = useState(false)
  const [loadingThread,  setLoadingThread]  = useState(false)
  const [loadingConvs,   setLoadingConvs]   = useState(true)
  const [search,         setSearch]         = useState('')
  const [showContacts,   setShowContacts]   = useState(false)
  const [menuId,         setMenuId]         = useState<number | null>(null)
  const [editingId,      setEditingId]      = useState<number | null>(null)
  const [editDraft,      setEditDraft]      = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  const dashboardPath = user?.role === 'attorney' ? '/dashboard/attorney' : '/dashboard/client'

  // ── Close context menu on outside click ────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('.msg-menu') && !t.closest('.msg-actions-btn')) setMenuId(null)
    }
    if (menuId !== null) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuId])

  // ── Resolve partner name from loaded data ───────────────
  useEffect(() => {
    if (activeId && !activeName) {
      const c  = conversations.find(c => c.partner_id === activeId)
      if (c)  { setActiveName(c.partner_name); return }
      const ct = contacts.find(c => c.id === activeId)
      if (ct)   setActiveName(ct.fullname)
    }
  }, [conversations, contacts, activeId, activeName])

  // ── Load conversations ──────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res = await messagesApi.conversations()
      setConversations(res.data.data)
    } finally {
      setLoadingConvs(false)
    }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // ── Load contacts ───────────────────────────────────────
  useEffect(() => {
    messagesApi.contacts().then(r => setContacts(r.data.data))
  }, [])

  // ── Load / poll thread ──────────────────────────────────
  const loadThread = useCallback(async (partnerId: number) => {
    setLoadingThread(true)
    try {
      const res = await messagesApi.thread(partnerId)
      setThread(res.data.data)
      setConversations(prev =>
        prev.map(c => c.partner_id === partnerId ? { ...c, unread_count: 0 } : c)
      )
    } finally {
      setLoadingThread(false)
    }
  }, [])

  useEffect(() => {
    if (!activeId) return
    loadThread(activeId)
    pollRef.current = setInterval(() => loadThread(activeId), 10_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [activeId, loadThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  // ── Attachment ──────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setAttachment(file)
    if (file?.type.startsWith('image/')) setAttachPreview(URL.createObjectURL(file))
    else setAttachPreview(null)
    e.target.value = ''
  }

  const clearAttachment = () => {
    if (attachPreview) URL.revokeObjectURL(attachPreview)
    setAttachment(null)
    setAttachPreview(null)
  }

  // ── Conversation selection ──────────────────────────────
  const selectConversation = (conv: Conversation) => {
    setActiveId(conv.partner_id)
    setActiveName(conv.partner_name)
    setSearchParams({ with: String(conv.partner_id) })
    setShowContacts(false)
    setEditingId(null)
    setMenuId(null)
  }

  const startNew = (contact: Contact) => {
    setActiveId(contact.id)
    setActiveName(contact.fullname)
    setSearchParams({ with: String(contact.id) })
    setShowContacts(false)
    setThread([])
    setEditingId(null)
    setMenuId(null)
  }

  // ── Send ────────────────────────────────────────────────
  const handleSend = async () => {
    if ((!draft.trim() && !attachment) || !activeId) return
    setSending(true)
    const text = draft.trim()
    const file = attachment
    setDraft('')
    if (attachPreview) URL.revokeObjectURL(attachPreview)
    setAttachment(null)
    setAttachPreview(null)
    try {
      await messagesApi.send({ receiver_id: activeId, content: text || undefined, attachment: file })
      await loadThread(activeId)
      await loadConversations()
    } finally {
      setSending(false)
    }
  }

  // ── Edit ────────────────────────────────────────────────
  const startEdit = (m: Message) => {
    setEditingId(m.id)
    setEditDraft(m.content || '')
    setMenuId(null)
  }

  const submitEdit = async () => {
    if (!editingId || !editDraft.trim()) return
    try {
      await messagesApi.editMessage(editingId, editDraft.trim())
      const now = new Date().toISOString()
      setThread(prev =>
        prev.map(m => m.id === editingId ? { ...m, content: editDraft.trim(), edited_at: now } : m)
      )
    } finally {
      setEditingId(null)
    }
  }

  // ── Delete message ──────────────────────────────────────
  const handleDeleteMsg = async (id: number, type: 'for_me' | 'for_everyone') => {
    setMenuId(null)
    try {
      await messagesApi.deleteMessage(id, type)
      setThread(prev => prev.filter(m => m.id !== id))
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete message.')
    }
  }

  // ── Delete conversation ─────────────────────────────────
  const handleDeleteConversation = async () => {
    if (!activeId) return
    if (!window.confirm(
      `Delete your conversation with ${activeName}?\n\nIt will be removed from your list but the other person can still see it.`
    )) return
    try {
      await messagesApi.deleteConversation(activeId)
      setConversations(prev => prev.filter(c => c.partner_id !== activeId))
      setActiveId(null)
      setThread([])
      setActiveName('')
      setSearchParams({})
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed.')
    }
  }

  // ── Render in-bubble attachment ─────────────────────────
  const renderAttachment = (m: Message) => {
    if (!m.attachment_name) return null
    const url = messagesApi.attachmentUrl(m.id)
    if (m.attachment_mime?.startsWith('image/')) {
      return (
        <a href={url} target="_blank" rel="noreferrer" className="msg-img-link">
          <img src={url} alt={m.attachment_name} className="msg-img" />
        </a>
      )
    }
    return (
      <a href={url} target="_blank" rel="noreferrer" className="msg-file-card">
        <FileText size={15} />
        <span>{m.attachment_name}</span>
      </a>
    )
  }

  const filteredConvs = conversations.filter(c =>
    c.partner_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="messages-page">
      {/* ── Nav ──────────────────────────────────────────── */}
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

      <div className="messages-layout">

        {/* ── Sidebar ──────────────────────────────────── */}
        <aside className="messages-sidebar">
          <div className="messages-sidebar-header">
            <button className="btn-icon" title="Back to dashboard" onClick={() => navigate(dashboardPath)}>
              <ArrowLeft size={16} />
            </button>
            <div className="messages-search">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search conversations…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn-icon" title="New conversation" onClick={() => setShowContacts(v => !v)}>
              <Plus size={16} />
            </button>
          </div>

          {showContacts && (
            <div className="contacts-list">
              <p className="contacts-label">Start a new conversation</p>
              {contacts.map(c => (
                <div key={c.id} className="contact-item" onClick={() => startNew(c)} role="button" tabIndex={0}>
                  <div className="conv-avatar">{c.fullname.charAt(0).toUpperCase()}</div>
                  <div>
                    <strong>{c.fullname}</strong>
                    <span className="conv-role">{c.role}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="conversations-list">
            {loadingConvs && <div className="loading-state small"><Loader2 size={18} className="spin" /></div>}
            {!loadingConvs && filteredConvs.length === 0 && (
              <p className="conv-empty">
                {conversations.length === 0 ? 'No conversations yet. Click + to start one.' : 'No results.'}
              </p>
            )}
            {filteredConvs.map(c => (
              <div
                key={c.partner_id}
                className={`conversation-item${activeId === c.partner_id ? ' active' : ''}`}
                onClick={() => selectConversation(c)}
                role="button"
                tabIndex={0}
              >
                <div className="conv-avatar">{c.partner_name.charAt(0).toUpperCase()}</div>
                <div className="conv-details">
                  <div className="conv-name-row">
                    <strong>{c.partner_name}</strong>
                    <span className="conv-time">{new Date(c.last_at).toLocaleDateString()}</span>
                  </div>
                  <div className="conv-preview-row">
                    <span className="conv-preview">
                      {c.last_message || (c.last_attachment ? `📎 ${c.last_attachment}` : '')}
                    </span>
                    {c.unread_count > 0 && <span className="conv-unread">{c.unread_count}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Thread ───────────────────────────────────── */}
        <section className="messages-main">
          {!activeId ? (
            <div className="messages-empty">
              <MessageSquare size={44} />
              <p>Select a conversation or start a new one.</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="thread-header">
                <div className="conv-avatar sm">{activeName.charAt(0).toUpperCase()}</div>
                <span className="thread-partner-name">{activeName}</span>
                <button
                  className="btn-icon"
                  title="Delete conversation"
                  onClick={handleDeleteConversation}
                  style={{ marginLeft: 'auto', color: 'var(--danger)' }}
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Messages */}
              <div className="thread-messages">
                {loadingThread && thread.length === 0 && (
                  <div className="loading-state small"><Loader2 size={20} className="spin" /></div>
                )}
                {thread.length === 0 && !loadingThread && (
                  <p className="conv-empty" style={{ margin: 'auto' }}>No messages yet. Say hello!</p>
                )}

                {thread.map(m => {
                  const mine      = m.sender_id === user?.id
                  const isEditing = editingId === m.id
                  const hasText   = m.content !== null && m.content !== ''

                  return (
                    <div key={m.id} className={`chat-bubble-wrap ${mine ? 'mine' : 'theirs'}`}>

                      {/* Actions button — LEFT of bubble for mine, RIGHT for theirs */}
                      {mine && (
                        <div className="msg-actions-wrap">
                          <button className="msg-actions-btn" onClick={() => setMenuId(menuId === m.id ? null : m.id)}>
                            <MoreHorizontal size={14} />
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

                      {/* Bubble */}
                      <div className={`chat-bubble ${mine ? 'mine' : 'theirs'}`}>
                        {isEditing ? (
                          <div className="bubble-edit">
                            <textarea
                              value={editDraft}
                              onChange={e => setEditDraft(e.target.value)}
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit() }
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                            />
                            <div className="bubble-edit-actions">
                              <button onClick={submitEdit}>Save</button>
                              <button onClick={() => setEditingId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {renderAttachment(m)}
                            {hasText && <p>{m.content}</p>}
                            <div className="bubble-meta">
                              {m.edited_at && <span className="msg-edited">edited</span>}
                              <span className="bubble-time">
                                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Actions button for theirs — RIGHT of bubble */}
                      {!mine && (
                        <div className="msg-actions-wrap">
                          <button className="msg-actions-btn" onClick={() => setMenuId(menuId === m.id ? null : m.id)}>
                            <MoreHorizontal size={14} />
                          </button>
                          {menuId === m.id && (
                            <div className="msg-menu theirs">
                              <button onClick={() => handleDeleteMsg(m.id, 'for_me')}>Delete for me</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* ── Compose ──────────────────────────────── */}
              <div className="chat-compose-wrap">
                {attachment && (
                  <div className="attach-preview-strip">
                    {attachPreview
                      ? <img src={attachPreview} alt="preview" className="attach-thumb" />
                      : <div className="attach-file-chip"><FileText size={13} /><span>{attachment.name}</span></div>
                    }
                    <button className="attach-remove" onClick={clearAttachment} title="Remove"><X size={13} /></button>
                  </div>
                )}
                <div className="chat-compose">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <button className="btn-attach" title="Attach file" onClick={() => fileRef.current?.click()} type="button">
                    {attachment?.type.startsWith('image/') ? <Image size={17} /> : <Paperclip size={17} />}
                  </button>
                  <textarea
                    rows={1}
                    placeholder="Type a message…"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                    }}
                  />
                  <button
                    className="btn-send"
                    onClick={handleSend}
                    disabled={(!draft.trim() && !attachment) || sending}
                  >
                    {sending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
