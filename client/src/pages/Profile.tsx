import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, UserCircle, Mail, AtSign, ShieldCheck, Phone, MapPin,
  Briefcase, Save, Edit2, BadgeCheck, Camera, CheckCircle2, AlertCircle,
  Loader2, Activity, Lock, ChevronDown, Building2, Gavel, Star,
  BookOpen, Clock, Users, Calendar, TrendingUp, FileText, MessageSquare,
  CreditCard, Heart, Bell, ChevronRight, Upload, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { profileApi, casesApi, reviewsApi } from '../services/api'

const AVAIL_OPTIONS = [
  { value: 'available', label: 'Available',   color: '#22c55e' },
  { value: 'in_court',  label: 'In Court',    color: '#f59e0b' },
  { value: 'offline',   label: 'Offline',     color: '#ef4444' },
] as const
type Avail = 'available' | 'in_court' | 'offline'
type Tab = 'professional' | 'activity' | 'security' | 'reviews'
type ClientTab = 'info' | 'cases' | 'activity' | 'security'

const ACTION_LABEL: Record<string, string> = {
  CASE_CREATED:        '📁 Created a new case',
  CASE_UPDATED:        '✏️ Updated a case',
  PROFILE_UPDATED:     '👤 Updated profile',
  PASSWORD_CHANGED:    '🔒 Changed password',
  CLIENT_PROFILE_UPDATED: '👥 Updated client profile',
  DOCUMENT_UPLOADED:   '📎 Uploaded a document',
  DOCUMENT_DELETED:    '🗑️ Deleted a document',
  HEARING_CREATED:     '📅 Scheduled a hearing',
  HEARING_UPDATED:     '📅 Updated a hearing',
  ANNOUNCEMENT_CREATED:'📢 Posted an announcement',
}

const CLIENT_ACTION_LABEL: Record<string, string> = {
  PROFILE_UPDATED:  '👤 Updated profile',
  PASSWORD_CHANGED: '🔒 Changed password',
  DOCUMENT_UPLOADED:'📎 Uploaded a document',
  status_change:    '📋 Case status changed',
  hearing:          '📅 Hearing scheduled',
  filing:           '📄 Filing updated',
  note:             '📝 Note added',
  document:         '📎 Document uploaded',
  other:            '📌 Case event',
}

export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const photoRef = useRef<HTMLInputElement>(null)
  const dashPath = user?.role === 'attorney' ? '/dashboard/attorney' : '/dashboard/client'

  // ── Core state ────────────────────────────────────────
  const [profile, setProfile] = useState<any>(null)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null)
  const [editing, setEditing] = useState(false)
  const [tab,     setTab]     = useState<Tab>('professional')

  // ── Attorney extras ───────────────────────────────────
  const [stats,    setStats]    = useState<any>(null)
  const [activity, setActivity] = useState<any[]>([])
  const [avail,    setAvail]    = useState<Avail>('available')
  const [availOpen, setAvailOpen] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)

  // ── Attorney reviews ──────────────────────────────────
  const [myReviews,      setMyReviews]      = useState<any[]>([])
  const [myReviewsAvg,   setMyReviewsAvg]   = useState<number>(0)
  const [myReviewsTotal, setMyReviewsTotal] = useState<number>(0)
  const [reviewsLoaded,  setReviewsLoaded]  = useState(false)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [rvImgErrors,    setRvImgErrors]    = useState<Record<number,boolean>>({})

  // ── Client extras ─────────────────────────────────────
  const [clientTab,      setClientTab]      = useState<ClientTab>('info')
  const [clientStats,    setClientStats]    = useState<any>(null)
  const [clientActivity, setClientActivity] = useState<any[]>([])
  const [clientCases,    setClientCases]    = useState<any[]>([])
  const [notifs, setNotifs] = useState({ email: true, case_updates: true, hearings: true, messages: true })
  const [attyImgErr,   setAttyImgErr]   = useState(false)

  // ── Professional form ─────────────────────────────────
  const [form, setForm] = useState({
    fullname: '', phone: '', address: '', date_of_birth: '', occupation: '',
    // attorney-only
    office_address: '', ibp_number: '', law_firm: '',
    specializations: '', court_admissions: '', years_experience: '',
    bio: '', availability: 'available' as Avail,
    // client-only
    id_type: '', id_number: '', emergency_contact: '',
  })

  // ── Security form ─────────────────────────────────────
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmNew: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const isAttorney = user?.role === 'attorney'

  // ── Load ──────────────────────────────────────────────
  const load = useCallback(async () => {
    const res = await profileApi.me()
    const p   = res.data.data
    setProfile(p)
    const pr = p.profile ?? {}
    setForm({
      fullname: p.fullname || '',
      phone: pr.phone || '',
      address: pr.address || '',
      date_of_birth: pr.date_of_birth?.split('T')[0] || '',
      occupation: pr.occupation || '',
      office_address: pr.office_address || '',
      ibp_number: pr.ibp_number || '',
      law_firm: pr.law_firm || '',
      specializations: pr.specializations || '',
      court_admissions: pr.court_admissions || '',
      years_experience: pr.years_experience?.toString() || '',
      bio: pr.bio || '',
      availability: pr.availability || 'available',
      id_type: pr.id_type || '',
      id_number: pr.id_number || '',
      emergency_contact: pr.emergency_contact || '',
    })
    if (!isAttorney) {
      setNotifs({
        email:        pr.notif_email         !== 0,
        case_updates: pr.notif_case_updates  !== 0,
        hearings:     pr.notif_hearings      !== 0,
        messages:     pr.notif_messages      !== 0,
      })
    }
    setAvail(pr.availability || 'available')
    setPhotoPreview(pr.photo_path ? profileApi.photoUrl(p.id) : null)
  }, [isAttorney])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!isAttorney) return
    profileApi.stats().then(r => setStats(r.data.data)).catch(() => {})
    profileApi.activity().then(r => setActivity(r.data.data)).catch(() => {})
  }, [isAttorney])
  useEffect(() => {
    if (isAttorney) return
    profileApi.clientStats().then(r => setClientStats(r.data.data)).catch(() => {})
    profileApi.clientActivity().then(r => setClientActivity(r.data.data)).catch(() => {})
    casesApi.list().then(r => {
      const d = r.data.data
      setClientCases(Array.isArray(d) ? d : (d?.items ?? []))
    }).catch(() => {})
  }, [isAttorney])

  useEffect(() => {
    if (!isAttorney || tab !== 'reviews' || reviewsLoaded || !profile) return
    setReviewsLoading(true)
    reviewsApi.getAttorneyReviews(profile.id)
      .then(res => {
        setMyReviews(res.data.data)
        setMyReviewsAvg(res.data.avg_rating ?? 0)
        setMyReviewsTotal(res.data.total ?? 0)
        setReviewsLoaded(true)
      })
      .finally(() => setReviewsLoading(false))
  }, [isAttorney, tab, profile])

  // ── Profile completion (attorney) ─────────────────────
  const completion = (() => {
    const p = profile?.profile ?? {}
    const fields = [form.phone, p.office_address, p.ibp_number, p.law_firm,
                    p.specializations, p.years_experience, p.bio, photoPreview]
    const filled = fields.filter(Boolean).length
    return Math.round((filled / fields.length) * 100)
  })()

  // ── Profile completion (client) ───────────────────────
  const clientCompletion = !isAttorney ? (() => {
    const fields = [form.phone, form.address, form.date_of_birth, form.occupation,
                    form.id_type, form.id_number, form.emergency_contact]
    return Math.round((fields.filter(Boolean).length / fields.length) * 100)
  })() : 0

  const clientMissingFields = !isAttorney
    ? ([
        !form.phone             && 'Contact Number',
        !form.address           && 'Address',
        !form.date_of_birth     && 'Date of Birth',
        !form.occupation        && 'Occupation',
        !form.id_type           && 'Government ID Type',
        !form.id_number         && 'ID Number',
        !form.emergency_contact && 'Emergency Contact',
      ].filter(Boolean) as string[])
    : []

  // ── Save profile ──────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setMsg(null)
    try {
      await profileApi.updateMe({
        ...form,
        years_experience: form.years_experience ? Number(form.years_experience) : null,
        ...(!isAttorney ? {
          notif_email:         notifs.email         ? 1 : 0,
          notif_case_updates:  notifs.case_updates  ? 1 : 0,
          notif_hearings:      notifs.hearings      ? 1 : 0,
          notif_messages:      notifs.messages      ? 1 : 0,
        } : {}),
      })
      setMsg({ text: 'Profile updated successfully.', ok: true })
      setEditing(false); load()
    } catch (err: any) {
      setMsg({ text: err.response?.data?.message || 'Failed to save.', ok: false })
    } finally { setSaving(false) }
  }

  // ── Availability ──────────────────────────────────────
  const handleAvailChange = async (val: Avail) => {
    setAvail(val); setAvailOpen(false)
    try { await profileApi.updateMe({ ...form, availability: val }) }
    catch {}
  }

  // ── Photo upload ──────────────────────────────────────
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setPhotoLoading(true)
    try {
      const preview = URL.createObjectURL(file); setPhotoPreview(preview)
      await profileApi.uploadPhoto(file)
      // force browser to reload photo from server
      setPhotoPreview(profileApi.photoUrl(profile.id) + '?t=' + Date.now())
    } catch (err: any) {
      setMsg({ text: err.response?.data?.message || 'Photo upload failed.', ok: false })
    } finally { setPhotoLoading(false); e.target.value = '' }
  }

  // ── Change password ───────────────────────────────────
  const handlePasswordChange = async () => {
    setPwMsg(null)
    if (!pwForm.currentPassword || !pwForm.newPassword) {
      setPwMsg({ text: 'All password fields are required.', ok: false }); return
    }
    if (pwForm.newPassword !== pwForm.confirmNew) {
      setPwMsg({ text: 'New passwords do not match.', ok: false }); return
    }
    setPwSaving(true)
    try {
      await profileApi.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
      setPwMsg({ text: 'Password changed successfully.', ok: true })
      setPwForm({ currentPassword: '', newPassword: '', confirmNew: '' })
    } catch (err: any) {
      setPwMsg({ text: err.response?.data?.message || 'Failed to change password.', ok: false })
    } finally { setPwSaving(false) }
  }

  const initials = (user?.fullname || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const availInfo = AVAIL_OPTIONS.find(a => a.value === avail)!

  // ════════════════════════════════════════════════════════
  // CLIENT PROFILE
  // ════════════════════════════════════════════════════════
  if (!isAttorney) {
    const atty = clientStats?.assigned_attorney
    const attyAvailColor = atty?.availability === 'available' ? '#22c55e'
      : atty?.availability === 'in_court' ? '#f59e0b' : '#ef4444'
    const attyAvailLabel = atty?.availability === 'available' ? 'Available'
      : atty?.availability === 'in_court' ? 'In Court' : 'Offline'

    return (
      <div className="dashboard">
        <nav className="dash-nav">
          <div className="dash-nav-brand"><Scale size={22} className="nav-icon" />MGC Law System</div>
          <div className="dash-nav-right">
            <span className="role-badge client">Client</span>
            <NotificationBell /><SettingsDropdown />
          </div>
        </nav>

        <main className="dash-content">
          <button className="btn-back" onClick={() => navigate(dashPath)}><ArrowLeft size={16} />Back to Dashboard</button>

          <div className="atty-profile-layout">

            {/* ════ SIDEBAR ════ */}
            <aside className="atty-sidebar">

              {/* Hero Card */}
              <div className="atty-hero-card">
                <div className="atty-avatar-wrap">
                  <div className="atty-avatar">
                    {photoPreview
                      ? <img src={photoPreview} alt="profile" className="atty-avatar-img" />
                      : <span className="atty-avatar-initials">{initials}</span>}
                    {photoLoading && <div className="atty-avatar-overlay"><Loader2 size={20} className="spin" /></div>}
                  </div>
                  <button className="atty-photo-btn" onClick={() => setShowPhotoMenu(v => !v)} title="Edit photo">
                    <Camera size={13} />
                  </button>
                  {showPhotoMenu && (
                    <div className="photo-menu-dropdown">
                      <button onClick={() => { setShowPhotoMenu(false); photoRef.current?.click() }}>
                        <Upload size={13} /> Upload New Photo
                      </button>
                      <button onClick={() => setShowPhotoMenu(false)}>
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  )}
                  <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handlePhotoSelect} />
                </div>
                <h2 className="atty-hero-name">{form.fullname || user?.fullname}</h2>
                <div className="atty-hero-badges">
                  <span className="role-badge client">Client</span>
                  {profile?.id_verified === 1 && (
                    <span className="atty-verified-badge"><BadgeCheck size={12} /> Verified</span>
                  )}
                </div>
                {form.occupation && <p className="atty-hero-firm">{form.occupation}</p>}
                <div className="client-consult-status">
                  <span className="avail-dot" style={{ background: '#22c55e' }} />
                  Active Client
                </div>
              </div>

              {/* Profile Completion */}
              <div className="atty-completion-card">
                <div className="completion-header">
                  <span>Profile Completion</span>
                  <strong>{clientCompletion}%</strong>
                </div>
                <div className="completion-track">
                  <div className="completion-fill" style={{ width: `${clientCompletion}%` }} />
                </div>
                {clientMissingFields.length > 0 && (
                  <>
                    <p className="completion-hint">⚠️ Complete your profile to avoid case delays.</p>
                    <div className="missing-fields-list">
                      {clientMissingFields.map(f => (
                        <span key={f} className="missing-field-chip">{f}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Assigned Attorney Card */}
              <div className={`client-attorney-card${atty ? '' : ' unassigned'}`}>
                <p className="client-attorney-label"><Users size={13} /> Assigned Attorney</p>
                {atty ? (
                  <>
                    <div className="client-attorney-info">
                      <div className="client-attorney-avatar">
                        {atty.id && !attyImgErr ? (
                          <img
                            src={profileApi.photoUrl(atty.id)}
                            alt={atty.fullname}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                            onError={() => setAttyImgErr(true)}
                          />
                        ) : (
                          atty.fullname.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
                        )}
                      </div>
                      <div className="client-attorney-details">
                        <strong>{atty.fullname}</strong>
                        <div className="client-attorney-avail">
                          <span className="avail-dot" style={{ background: attyAvailColor }} />
                          <span>{attyAvailLabel}</span>
                        </div>
                        {atty.law_firm && <small className="client-attorney-firm">{atty.law_firm}</small>}
                      </div>
                    </div>
                    <button className="quick-action-btn" style={{ marginTop: '0.5rem', width: '100%' }}
                      onClick={() => navigate('/messages')}>
                      <MessageSquare size={13} /> Message Attorney
                    </button>
                  </>
                ) : (
                  <p className="client-attorney-none">No attorney assigned yet.</p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="atty-quick-actions">
                <p className="quick-actions-label">Quick Actions</p>
                <button className="quick-action-btn" onClick={() => navigate('/cases')}>
                  <Briefcase size={15} /> View My Cases
                </button>
                <button className="quick-action-btn" onClick={() => navigate('/messages')}>
                  <MessageSquare size={15} /> Message Attorney
                </button>
                <button className="quick-action-btn" onClick={() => navigate('/hearings')}>
                  <Calendar size={15} /> View Hearings
                </button>
                <button className="quick-action-btn" onClick={() => navigate('/announcements')}>
                  <Bell size={15} /> Announcements
                </button>
              </div>
            </aside>

            {/* ════ MAIN CONTENT ════ */}
            <div className="atty-main">

              {/* Tabs */}
              <div className="atty-tabs">
                {([
                  { id: 'info',      icon: <UserCircle size={15}/>, label: 'Personal Info' },
                  { id: 'cases',     icon: <Briefcase size={15}/>,  label: 'My Cases'     },
                  { id: 'activity',  icon: <Activity size={15}/>,   label: 'Activity'     },
                  { id: 'security',  icon: <Lock size={15}/>,       label: 'Security'     },
                ] as const).map(t => (
                  <button key={t.id} className={`atty-tab${clientTab === t.id ? ' active' : ''}`}
                    onClick={() => setClientTab(t.id)}>
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>

              {/* Alert */}
              {msg && (
                <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '1rem' }}>
                  {msg.ok ? <CheckCircle2 size={15}/> : <AlertCircle size={15}/>} {msg.text}
                </div>
              )}

              {/* ── INFO TAB ── */}
              {clientTab === 'info' && (
                <div className="atty-section">
                  <div className="atty-section-header">
                    <h3><UserCircle size={18}/> Personal &amp; Legal Information</h3>
                    {!editing
                      ? <button className="btn-primary" onClick={() => setEditing(true)}><Edit2 size={14}/> Edit</button>
                      : <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn-secondary" onClick={() => { setEditing(false); load() }}>Cancel</button>
                          <button className="btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 size={14} className="spin"/> : <Save size={14}/>}
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                        </div>}
                  </div>

                  <div className="atty-form-grid">
                    <div className="atty-field">
                      <label><UserCircle size={14}/> Full Name</label>
                      {editing
                        ? <input className="profile-input" value={form.fullname} onChange={e => setForm({...form, fullname: e.target.value})} placeholder="Full name" />
                        : <span>{form.fullname || '—'}</span>}
                    </div>
                    <div className="atty-field">
                      <label><Phone size={14}/> Contact Number</label>
                      {editing
                        ? <input className="profile-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+63 912 345 6789" />
                        : <span>{form.phone || '—'}</span>}
                    </div>
                    <div className="atty-field">
                      <label><Calendar size={14}/> Date of Birth</label>
                      {editing
                        ? <input className="profile-input" type="date" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} />
                        : <span>{form.date_of_birth ? new Date(form.date_of_birth + 'T00:00:00').toLocaleDateString() : '—'}</span>}
                    </div>
                    <div className="atty-field">
                      <label><Briefcase size={14}/> Occupation</label>
                      {editing
                        ? <input className="profile-input" value={form.occupation} onChange={e => setForm({...form, occupation: e.target.value})} placeholder="e.g. Business Owner" />
                        : <span>{form.occupation || '—'}</span>}
                    </div>
                    <div className="atty-field">
                      <label><CreditCard size={14}/> Government ID Type</label>
                      {editing
                        ? <select className="profile-input" value={form.id_type} onChange={e => setForm({...form, id_type: e.target.value})}>
                            <option value="">Select ID Type…</option>
                            <option value="PhilSys">Philippine Identification System (PhilSys)</option>
                            <option value="Driver's License">Driver's License</option>
                            <option value="Passport">Passport</option>
                            <option value="UMID">UMID (SSS / GSIS)</option>
                            <option value="Voter's ID">Voter's ID</option>
                            <option value="PhilHealth">PhilHealth ID</option>
                            <option value="Pag-IBIG">Pag-IBIG / HDMF ID</option>
                            <option value="Postal ID">Postal ID</option>
                            <option value="Senior Citizen">Senior Citizen ID</option>
                            <option value="PRC">PRC ID</option>
                            <option value="Other">Other Government ID</option>
                          </select>
                        : <span>{form.id_type || '—'}</span>}
                    </div>
                    <div className="atty-field">
                      <label><BadgeCheck size={14}/> ID Number</label>
                      {editing
                        ? <input className="profile-input" value={form.id_number} onChange={e => setForm({...form, id_number: e.target.value})} placeholder="e.g. 1234-5678-9012" />
                        : <span>{form.id_number || '—'}</span>}
                    </div>
                    <div className="atty-field full-width">
                      <label><Heart size={14}/> Emergency Contact</label>
                      {editing
                        ? <input className="profile-input" value={form.emergency_contact} onChange={e => setForm({...form, emergency_contact: e.target.value})} placeholder="Name · Relationship · Phone number" />
                        : <span>{form.emergency_contact || '—'}</span>}
                    </div>
                    <div className="atty-field full-width">
                      <label><MapPin size={14}/> Address</label>
                      {editing
                        ? <textarea className="profile-input" rows={2} value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Street, Barangay, City, Province" />
                        : <span>{form.address || '—'}</span>}
                    </div>
                  </div>

                  <div className="atty-identity-row">
                    <div><AtSign size={13}/> <strong>@{user?.username}</strong></div>
                    <div><Mail size={13}/> {user?.email}</div>
                    <div><Clock size={13}/> Member since {profile ? new Date(profile.created_at).toLocaleDateString() : '—'}</div>
                  </div>
                </div>
              )}

              {/* ── CASES TAB ── */}
              {clientTab === 'cases' && (
                <>
                  <div className="atty-section">
                    <div className="atty-section-header">
                      <h3><Briefcase size={18}/> My Legal Cases</h3>
                      <button className="btn-primary" onClick={() => navigate('/cases')}>
                        <ChevronRight size={14}/> View All
                      </button>
                    </div>
                    <div className="client-case-stats-grid">
                      <div className="client-stat-card">
                        <Briefcase size={20} className="stat-icon gold" />
                        <strong>{clientStats?.active_cases ?? '—'}</strong>
                        <span>Active Cases</span>
                      </div>
                      <div className="client-stat-card">
                        <CheckCircle2 size={20} className="stat-icon green" />
                        <strong>{clientStats?.completed_cases ?? '—'}</strong>
                        <span>Completed</span>
                      </div>
                      <div className="client-stat-card">
                        <Clock size={20} className="stat-icon purple" />
                        <strong>{clientStats?.pending_cases ?? '—'}</strong>
                        <span>Pending Review</span>
                      </div>
                    </div>
                  </div>

                  {atty ? (
                    <div className="atty-section">
                      <div className="atty-section-header">
                        <h3><Users size={18}/> Assigned Attorney</h3>
                      </div>
                      <div className="client-attorney-detail">
                        <div className="client-attorney-detail-avatar">
                          {atty.id && !attyImgErr ? (
                            <img
                              src={profileApi.photoUrl(atty.id)}
                              alt={atty.fullname}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                              onError={() => setAttyImgErr(true)}
                            />
                          ) : (
                            atty.fullname.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
                          )}
                        </div>
                        <div className="client-attorney-detail-info">
                          <h4>{atty.fullname}</h4>
                          {atty.law_firm && <p className="atty-hero-firm">{atty.law_firm}</p>}
                          <div className="client-attorney-avail" style={{ marginTop: '0.35rem' }}>
                            <span className="avail-dot" style={{ background: attyAvailColor }} />
                            <span>{attyAvailLabel}</span>
                          </div>
                        </div>
                        <button className="btn-primary" onClick={() => navigate('/messages')}>
                          <MessageSquare size={14}/> Message
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="atty-section">
                      <p className="empty-state-sm">No attorney has been assigned to your account yet.</p>
                    </div>
                  )}
                </>
              )}

              {/* ── ACTIVITY TAB ── */}
              {clientTab === 'activity' && (
                <div className="atty-section">
                  <div className="atty-section-header">
                    <h3><Activity size={18}/> Recent Legal Activity</h3>
                  </div>
                  {clientActivity.length === 0 ? (
                    <p className="empty-state-sm">No activity recorded yet.</p>
                  ) : (
                    <div className="activity-feed">
                      {clientActivity.map((a, i) => (
                        <div key={i} className="activity-item">
                          <div className="activity-dot" />
                          <div className="activity-body">
                            <span>{CLIENT_ACTION_LABEL[a.action] || a.action}</span>
                            {a.details && <small>{a.details}</small>}
                            {a.case_number && <small>Case: {a.case_number} — {a.case_title}</small>}
                            <time>{new Date(a.created_at).toLocaleString()}</time>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── SECURITY TAB ── */}
              {clientTab === 'security' && (
                <div className="atty-section">
                  <div className="atty-section-header">
                    <h3><Lock size={18}/> Security &amp; Preferences</h3>
                  </div>

                  {/* Change Password */}
                  <div className="atty-security-section">
                    <h4>Change Password</h4>
                    {pwMsg && (
                      <div className={`alert ${pwMsg.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '0.75rem' }}>
                        {pwMsg.ok ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>} {pwMsg.text}
                      </div>
                    )}
                    <div className="atty-form-grid">
                      <div className="atty-field full-width">
                        <label><Lock size={14}/> Current Password</label>
                        <input type="password" className="profile-input" value={pwForm.currentPassword}
                          onChange={e => setPwForm({...pwForm, currentPassword: e.target.value})} placeholder="Enter current password" />
                      </div>
                      <div className="atty-field">
                        <label><Lock size={14}/> New Password</label>
                        <input type="password" className="profile-input" value={pwForm.newPassword}
                          onChange={e => setPwForm({...pwForm, newPassword: e.target.value})} placeholder="Minimum 8 characters" />
                      </div>
                      <div className="atty-field">
                        <label><Lock size={14}/> Confirm New Password</label>
                        <input type="password" className="profile-input" value={pwForm.confirmNew}
                          onChange={e => setPwForm({...pwForm, confirmNew: e.target.value})} placeholder="Re-enter new password" />
                      </div>
                    </div>
                    <button className="btn-primary" style={{ marginTop: '0.75rem' }} onClick={handlePasswordChange} disabled={pwSaving}>
                      {pwSaving ? <><Loader2 size={14} className="spin"/> Saving…</> : <><Save size={14}/> Update Password</>}
                    </button>
                  </div>

                  {/* Communication Preferences */}
                  <div className="atty-security-info">
                    <h4>Communication Preferences</h4>
                    {([
                      { key: 'email'        as const, icon: <Mail size={14}/>,         label: 'Email Notifications',  desc: 'Receive system alerts via email' },
                      { key: 'case_updates' as const, icon: <Briefcase size={14}/>,    label: 'Case Update Alerts',   desc: 'Notified when your case status changes' },
                      { key: 'hearings'     as const, icon: <Calendar size={14}/>,     label: 'Hearing Reminders',    desc: 'Reminders before scheduled hearings' },
                      { key: 'messages'     as const, icon: <MessageSquare size={14}/>,label: 'Message Notifications',desc: 'Alert when attorney sends a message' },
                    ]).map(({ key, icon, label, desc }) => (
                      <div key={key} className="notif-toggle-row">
                        <div className="notif-toggle-info">
                          <div className="notif-toggle-label">{icon} {label}</div>
                          <small>{desc}</small>
                        </div>
                        <button
                          className={`toggle-switch${notifs[key] ? ' on' : ''}`}
                          onClick={() => setNotifs(n => ({ ...n, [key]: !n[key] }))}
                          role="switch"
                          aria-checked={notifs[key]}
                        >
                          <span className="toggle-thumb" />
                        </button>
                      </div>
                    ))}
                    <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={handleSave} disabled={saving}>
                      {saving ? <><Loader2 size={14} className="spin"/> Saving…</> : <><Save size={14}/> Save Preferences</>}
                    </button>
                  </div>

                  {/* Account Info */}
                  <div className="atty-security-info" style={{ marginTop: '1.5rem' }}>
                    <h4>Account Info</h4>
                    <div className="security-info-row"><span>Account created:</span><span>{profile ? new Date(profile.created_at).toLocaleDateString() : '—'}</span></div>
                    <div className="security-info-row"><span>ID Verified:</span><span>{profile?.id_verified ? '✅ Verified' : '⚠️ Pending verification'}</span></div>
                  </div>
                </div>
              )}

            </div>{/* end atty-main */}
          </div>{/* end atty-profile-layout */}
        </main>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════
  // ATTORNEY PROFILE
  // ════════════════════════════════════════════════════════
  return (
    <div className="dashboard">
      <nav className="dash-nav">
        <div className="dash-nav-brand"><Scale size={22} className="nav-icon" />MGC Law System</div>
        <div className="dash-nav-right">
          <span className="role-badge attorney">Attorney</span>
          <NotificationBell /><SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        <button className="btn-back" onClick={() => navigate(dashPath)}>
          <ArrowLeft size={16} />Back to Dashboard
        </button>

        <div className="atty-profile-layout">
          {/* ══ LEFT SIDEBAR ══ */}
          <aside className="atty-sidebar">

            {/* Hero Card */}
            <div className="atty-hero-card">
              <div className="atty-avatar-wrap">
                <div className="atty-avatar">
                  {photoPreview
                    ? <img src={photoPreview} alt="profile" className="atty-avatar-img" />
                    : <span className="atty-avatar-initials">{initials}</span>}
                  {photoLoading && <div className="atty-avatar-overlay"><Loader2 size={20} className="spin" /></div>}
                </div>
                <button className="atty-photo-btn" onClick={() => setShowPhotoMenu(v => !v)} title="Edit photo">
                  <Camera size={13} />
                </button>
                {showPhotoMenu && (
                  <div className="photo-menu-dropdown">
                    <button onClick={() => { setShowPhotoMenu(false); photoRef.current?.click() }}>
                      <Upload size={13} /> Upload New Photo
                    </button>
                    <button onClick={() => setShowPhotoMenu(false)}>
                      <X size={13} /> Cancel
                    </button>
                  </div>
                )}
                <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handlePhotoSelect} />
              </div>

              <h2 className="atty-hero-name">{user?.fullname}</h2>
              <div className="atty-hero-badges">
                <span className="role-badge attorney">Attorney</span>
                {profile?.ibp_verified === 1 && (
                  <span className="atty-verified-badge"><BadgeCheck size={12} /> Verified</span>
                )}
              </div>
              <p className="atty-hero-firm">{profile?.profile?.law_firm || 'MGC Law Office'}</p>

              {/* Availability selector */}
              <div className="atty-avail-wrap" style={{ position: 'relative' }}>
                <button className="atty-avail-btn" onClick={() => setAvailOpen(v => !v)}>
                  <span className="avail-dot" style={{ background: availInfo.color }} />
                  {availInfo.label}
                  <ChevronDown size={13} style={{ marginLeft: 'auto' }} />
                </button>
                {availOpen && (
                  <div className="atty-avail-menu">
                    {AVAIL_OPTIONS.map(o => (
                      <button key={o.value} className={`avail-option${avail === o.value ? ' active' : ''}`}
                        onClick={() => handleAvailChange(o.value)}>
                        <span className="avail-dot" style={{ background: o.color }} />{o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Completion Bar */}
            <div className="atty-completion-card">
              <div className="completion-header">
                <span>Profile Completion</span>
                <strong>{completion}%</strong>
              </div>
              <div className="completion-track">
                <div className="completion-fill" style={{ width: `${completion}%` }} />
              </div>
              {completion < 100 && (
                <p className="completion-hint">Complete your professional details to improve visibility.</p>
              )}
            </div>

            {/* Stats */}
            {stats && (
              <div className="atty-stats-grid">
                <div className="atty-stat-card">
                  <Briefcase size={18} className="stat-icon gold" />
                  <strong>{stats.active_cases}</strong>
                  <span>Active Cases</span>
                </div>
                <div className="atty-stat-card">
                  <CheckCircle2 size={18} className="stat-icon green" />
                  <strong>{stats.closed_cases}</strong>
                  <span>Closed</span>
                </div>
                <div className="atty-stat-card">
                  <Users size={18} className="stat-icon blue" />
                  <strong>{stats.clients}</strong>
                  <span>Clients</span>
                </div>
                <div className="atty-stat-card">
                  <Calendar size={18} className="stat-icon purple" />
                  <strong>{stats.upcoming_hearings}</strong>
                  <span>Hearings</span>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="atty-quick-actions">
              <p className="quick-actions-label">Quick Actions</p>
              <button className="quick-action-btn" onClick={() => navigate('/cases')}><Briefcase size={15} />View My Cases</button>
              <button className="quick-action-btn" onClick={() => navigate('/clients')}><Users size={15} />Manage Clients</button>
              <button className="quick-action-btn" onClick={() => navigate('/hearings')}><Calendar size={15} />Hearings</button>
              <button className="quick-action-btn" onClick={() => navigate('/announcements')}><FileText size={15} />Announcements</button>
              <button className="quick-action-btn" onClick={() => navigate('/messages')}><MessageSquare size={15} />Messages</button>
            </div>
          </aside>

          {/* ══ MAIN CONTENT ══ */}
          <div className="atty-main">
            {/* Tabs */}
            <div className="atty-tabs">
              {([  
                { id: 'professional', icon: <ShieldCheck size={15}/>, label: 'Professional' },
                { id: 'reviews',      icon: <Star size={15}/>,         label: 'Reviews' },
                { id: 'activity',     icon: <Activity size={15}/>,    label: 'Activity' },
                { id: 'security',     icon: <Lock size={15}/>,        label: 'Security' },
              ] as const).map(t => (
                <button key={t.id} className={`atty-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* Alert */}
            {msg && (
              <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '1rem' }}>
                {msg.ok ? <CheckCircle2 size={15}/> : <AlertCircle size={15}/>} {msg.text}
              </div>
            )}

            {/* ── Professional Tab ── */}
            {tab === 'professional' && (
              <div className="atty-section">
                <div className="atty-section-header">
                  <h3><ShieldCheck size={18}/> Professional Information</h3>
                  {!editing
                    ? <button className="btn-primary" onClick={() => setEditing(true)}><Edit2 size={14}/> Edit</button>
                    : <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-secondary" onClick={() => { setEditing(false); load() }}>Cancel</button>
                        <button className="btn-primary" onClick={handleSave} disabled={saving}>
                          {saving ? <Loader2 size={14} className="spin"/> : <Save size={14}/>}
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>}
                </div>

                <div className="atty-form-grid">
                  {/* Full Name */}
                  <div className="atty-field">
                    <label><UserCircle size={14}/> Full Name</label>
                    {editing
                      ? <input className="profile-input" value={form.fullname} onChange={e => setForm({...form, fullname: e.target.value})} placeholder="Full name" />
                      : <span>{form.fullname || '—'}</span>}
                  </div>
                  {/* Phone */}
                  <div className="atty-field">
                    <label><Phone size={14}/> Contact Number</label>
                    {editing
                      ? <input className="profile-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+63 912 345 6789" />
                      : <span>{form.phone || '—'}</span>}
                  </div>
                  {/* IBP Number */}
                  <div className="atty-field">
                    <label><BadgeCheck size={14}/> IBP / Bar License No.</label>
                    {editing
                      ? <input className="profile-input" value={form.ibp_number} onChange={e => setForm({...form, ibp_number: e.target.value})} placeholder="e.g. IBP-12345" />
                      : <span>{form.ibp_number || '—'}</span>}
                  </div>
                  {/* Years of Experience */}
                  <div className="atty-field">
                    <label><TrendingUp size={14}/> Years of Experience</label>
                    {editing
                      ? <input className="profile-input" type="number" min={0} max={60} value={form.years_experience} onChange={e => setForm({...form, years_experience: e.target.value})} placeholder="e.g. 10" />
                      : <span>{form.years_experience ? `${form.years_experience} years` : '—'}</span>}
                  </div>
                  {/* Law Firm */}
                  <div className="atty-field">
                    <label><Building2 size={14}/> Law Firm Name</label>
                    {editing
                      ? <input className="profile-input" value={form.law_firm} onChange={e => setForm({...form, law_firm: e.target.value})} placeholder="e.g. MGC Law Office" />
                      : <span>{form.law_firm || '—'}</span>}
                  </div>
                  {/* Specializations */}
                  <div className="atty-field">
                    <label><Star size={14}/> Practice Areas / Specialization</label>
                    {editing
                      ? <input className="profile-input" value={form.specializations} onChange={e => setForm({...form, specializations: e.target.value})} placeholder="e.g. Criminal Law, Civil Law, Family Law" />
                      : <div className="spec-chips">
                          {form.specializations
                            ? form.specializations.split(',').map(s => <span key={s} className="spec-chip">{s.trim()}</span>)
                            : <span>—</span>}
                        </div>}
                  </div>
                  {/* Office Address */}
                  <div className="atty-field full-width">
                    <label><MapPin size={14}/> Office Address</label>
                    {editing
                      ? <textarea className="profile-input" rows={2} value={form.office_address} onChange={e => setForm({...form, office_address: e.target.value})} placeholder="Office unit, building, street, city" />
                      : <span>{form.office_address || '—'}</span>}
                  </div>
                  {/* Court Admissions */}
                  <div className="atty-field full-width">
                    <label><Gavel size={14}/> Court Admissions</label>
                    {editing
                      ? <input className="profile-input" value={form.court_admissions} onChange={e => setForm({...form, court_admissions: e.target.value})} placeholder="e.g. Supreme Court, Court of Appeals, RTC Makati" />
                      : <span>{form.court_admissions || '—'}</span>}
                  </div>
                  {/* Bio */}
                  <div className="atty-field full-width">
                    <label><BookOpen size={14}/> Professional Bio</label>
                    {editing
                      ? <textarea className="profile-input" rows={4} value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} placeholder="Brief professional background and expertise…" />
                      : <p className="atty-bio-text">{form.bio || '—'}</p>}
                  </div>
                </div>

                {/* Read-only identity */}
                <div className="atty-identity-row">
                  <div><AtSign size={13}/> <strong>@{user?.username}</strong></div>
                  <div><Mail size={13}/> {user?.email}</div>
                  <div><Clock size={13}/> Member since {profile ? new Date(profile.created_at).toLocaleDateString() : '—'}</div>
                </div>
              </div>
            )}

            {/* ── Reviews Tab ── */}
            {tab === 'reviews' && (
              <div className="atty-section">
                <div className="atty-section-header">
                  <h3><Star size={18}/> My Reviews</h3>
                </div>
                {reviewsLoading ? (
                  <div className="loading-state"><Loader2 size={28} className="spin" /></div>
                ) : (
                  <>
                    <div className="rv-summary">
                      <div className="rv-big-score">{Number(myReviewsAvg).toFixed(1)}</div>
                      <div className="rv-summary-right">
                        <div className="rv-stars-row">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={18}
                              fill={myReviewsAvg >= s ? '#f59e0b' : 'none'}
                              stroke='#f59e0b'
                              opacity={myReviewsAvg >= s - 0.5 ? 1 : 0.3}
                            />
                          ))}
                        </div>
                        <span className="rv-total">{myReviewsTotal} review{myReviewsTotal !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {myReviews.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>No reviews yet.</p>
                    ) : (
                      <div className="rv-list">
                        {myReviews.map((r: any) => {
                          const ini = r.client_name.split(' ').slice(0,2).map((w: string) => w[0]).join('').toUpperCase()
                          return (
                            <div key={r.id} className="rv-item">
                              <div className="rv-avatar">
                                {!rvImgErrors[r.client_id] ? (
                                  <img
                                    src={profileApi.photoUrl(r.client_id)}
                                    alt={r.client_name}
                                    onError={() => setRvImgErrors(prev => ({ ...prev, [r.client_id]: true }))}
                                  />
                                ) : (
                                  <span>{ini}</span>
                                )}
                              </div>
                              <div className="rv-body">
                                <div className="rv-header">
                                  <span className="rv-name">{r.client_name}</span>
                                  <div className="rv-stars-sm">
                                    {[1,2,3,4,5].map(s => (
                                      <Star key={s} size={13}
                                        fill={r.rating >= s ? '#f59e0b' : 'none'}
                                        stroke={r.rating >= s ? '#f59e0b' : 'var(--text-muted)'}
                                      />
                                    ))}
                                  </div>
                                  <span className="rv-date">
                                    {new Date(r.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                                {r.comment && <p className="rv-comment">{r.comment}</p>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Activity Tab ── */}
            {tab === 'activity' && (
              <div className="atty-section">
                <div className="atty-section-header">
                  <h3><Activity size={18}/> Recent Activity</h3>
                </div>
                {activity.length === 0 ? (
                  <p className="empty-state-sm">No activity recorded yet.</p>
                ) : (
                  <div className="activity-feed">
                    {activity.map((a, i) => (
                      <div key={i} className="activity-item">
                        <div className="activity-dot" />
                        <div className="activity-body">
                          <span>{ACTION_LABEL[a.action] || a.action}</span>
                          {a.details && <small>{a.details}</small>}
                          <time>{new Date(a.created_at).toLocaleString()}</time>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Security Tab ── */}
            {tab === 'security' && (
              <div className="atty-section">
                <div className="atty-section-header">
                  <h3><Lock size={18}/> Security</h3>
                </div>
                <div className="atty-security-section">
                  <h4>Change Password</h4>
                  {pwMsg && (
                    <div className={`alert ${pwMsg.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '0.75rem' }}>
                      {pwMsg.ok ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>} {pwMsg.text}
                    </div>
                  )}
                  <div className="atty-form-grid">
                    <div className="atty-field full-width">
                      <label><Lock size={14}/> Current Password</label>
                      <input type="password" className="profile-input" value={pwForm.currentPassword}
                        onChange={e => setPwForm({...pwForm, currentPassword: e.target.value})} placeholder="Enter current password" />
                    </div>
                    <div className="atty-field">
                      <label><Lock size={14}/> New Password</label>
                      <input type="password" className="profile-input" value={pwForm.newPassword}
                        onChange={e => setPwForm({...pwForm, newPassword: e.target.value})} placeholder="Minimum 8 characters" />
                    </div>
                    <div className="atty-field">
                      <label><Lock size={14}/> Confirm New Password</label>
                      <input type="password" className="profile-input" value={pwForm.confirmNew}
                        onChange={e => setPwForm({...pwForm, confirmNew: e.target.value})} placeholder="Re-enter new password" />
                    </div>
                  </div>
                  <button className="btn-primary" style={{ marginTop: '0.5rem' }} onClick={handlePasswordChange} disabled={pwSaving}>
                    {pwSaving ? <><Loader2 size={14} className="spin"/> Saving…</> : <><Save size={14}/> Update Password</>}
                  </button>
                </div>

                <div className="atty-security-info">
                  <h4>Account Info</h4>
                  <div className="security-info-row"><span>Last login:</span><span>—</span></div>
                  <div className="security-info-row"><span>Account created:</span><span>{profile ? new Date(profile.created_at).toLocaleDateString() : '—'}</span></div>
                  <div className="security-info-row"><span>IBP Verified:</span><span>{profile?.ibp_verified ? '✅ Verified' : '⚠️ Not verified'}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
