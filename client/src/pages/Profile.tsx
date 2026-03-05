import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale, ArrowLeft, UserCircle, Mail, AtSign, ShieldCheck, Phone, MapPin,
  Briefcase, Save, Edit2, BadgeCheck, Camera, CheckCircle2, AlertCircle,
  Loader2, Activity, Lock, ChevronDown, Building2, Gavel, Star,
  BookOpen, Clock, Users, Calendar, TrendingUp, FileText, MessageSquare,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { profileApi } from '../services/api'

const AVAIL_OPTIONS = [
  { value: 'available', label: 'Available',   color: '#22c55e' },
  { value: 'in_court',  label: 'In Court',    color: '#f59e0b' },
  { value: 'offline',   label: 'Offline',     color: '#ef4444' },
] as const
type Avail = 'available' | 'in_court' | 'offline'
type Tab = 'professional' | 'activity' | 'security'

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

  // ── Professional form ─────────────────────────────────
  const [form, setForm] = useState({
    fullname: '', phone: '', address: '', date_of_birth: '', occupation: '',
    // attorney-only
    office_address: '', ibp_number: '', law_firm: '',
    specializations: '', court_admissions: '', years_experience: '',
    bio: '', availability: 'available' as Avail,
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
    })
    setAvail(pr.availability || 'available')
    if (isAttorney) {
      setPhotoPreview(pr.photo_path ? profileApi.photoUrl(p.id) : null)
    }
  }, [isAttorney])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!isAttorney) return
    profileApi.stats().then(r => setStats(r.data.data)).catch(() => {})
    profileApi.activity().then(r => setActivity(r.data.data)).catch(() => {})
  }, [isAttorney])

  // ── Profile completion (attorney) ─────────────────────
  const completion = (() => {
    const p = profile?.profile ?? {}
    const fields = [form.phone, p.office_address, p.ibp_number, p.law_firm,
                    p.specializations, p.years_experience, p.bio, photoPreview]
    const filled = fields.filter(Boolean).length
    return Math.round((filled / fields.length) * 100)
  })()

  // ── Save profile ──────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setMsg(null)
    try {
      await profileApi.updateMe({
        ...form,
        years_experience: form.years_experience ? Number(form.years_experience) : null,
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
  // CLIENT PROFILE (unchanged simple view)
  // ════════════════════════════════════════════════════════
  if (!isAttorney) {
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
          <div className="profile-page">
            <div className="profile-hero-card">
              <div className="profile-hero-avatar">{initials}</div>
              <h1 className="profile-hero-name">{form.fullname || user?.fullname}</h1>
              <span className="role-badge client" style={{ marginTop: '0.35rem' }}>Client</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '1rem' }}>
              {editing
                ? <><button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                    <button className="btn-primary" onClick={handleSave} disabled={saving}><Save size={15} />{saving ? 'Saving…' : 'Save Changes'}</button></>
                : <button className="btn-primary" onClick={() => setEditing(true)}><Edit2 size={15} />Edit Profile</button>}
            </div>
            {msg && <p style={{ color: msg.ok ? '#22c55e' : '#ef4444', marginBottom: '1rem' }}>{msg.text}</p>}
            <div className="profile-info-grid">
              {[
                { icon: <UserCircle size={20}/>, color: 'icon-gold', label: 'Full Name', key: 'fullname' as const, type: 'text', placeholder: 'Full name' },
                { icon: <Phone size={20}/>, color: 'icon-gold', label: 'Phone', key: 'phone' as const, type: 'text', placeholder: '+63 912 345 6789' },
                { icon: <Briefcase size={20}/>, color: 'icon-blue', label: 'Occupation', key: 'occupation' as const, type: 'text', placeholder: 'e.g. Business Owner' },
              ].map(({ icon, color, label, key, type, placeholder }) => (
                <div className="profile-info-card" key={key}>
                  <div className={`profile-info-icon ${color}`}>{icon}</div>
                  <div className="profile-info-body">
                    <label>{label}</label>
                    {editing ? <input type={type} value={form[key]} onChange={e => setForm({...form, [key]: e.target.value})} placeholder={placeholder} className="profile-input" />
                             : <span>{form[key] || '—'}</span>}
                  </div>
                </div>
              ))}
              <div className="profile-info-card"><div className="profile-info-icon icon-blue"><AtSign size={20}/></div><div className="profile-info-body"><label>Username</label><span>@{user?.username}</span></div></div>
              <div className="profile-info-card"><div className="profile-info-icon icon-green"><Mail size={20}/></div><div className="profile-info-body"><label>Email</label><span>{user?.email}</span></div></div>
              <div className="profile-info-card" style={{ gridColumn: '1 / -1' }}>
                <div className="profile-info-icon icon-green"><MapPin size={20}/></div>
                <div className="profile-info-body">
                  <label>Address</label>
                  {editing ? <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Street, City, Province" className="profile-input" rows={2} />
                           : <span>{form.address || '—'}</span>}
                </div>
              </div>
            </div>
          </div>
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
                <button className="atty-photo-btn" onClick={() => photoRef.current?.click()} title="Upload photo">
                  <Camera size={13} />
                </button>
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
