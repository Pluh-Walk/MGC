import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Scale,
  ArrowLeft,
  UserCircle,
  Mail,
  AtSign,
  ShieldCheck,
  Phone,
  MapPin,
  Briefcase,
  Save,
  Edit2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import { profileApi } from '../services/api'

export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverMsg, setServerMsg] = useState('')
  const [profile, setProfile] = useState<any>(null)

  const [form, setForm] = useState({
    fullname: user?.fullname || '',
    phone: '',
    address: '',
    date_of_birth: '',
    occupation: '',
  })

  const initials = user?.fullname
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  const dashPath = user?.role === 'attorney' ? '/dashboard/attorney' : '/dashboard/client'

  useEffect(() => {
    profileApi.me().then((res) => {
      const p = res.data.data
      setProfile(p)
      setForm({
        fullname: p.fullname || '',
        phone: p.profile?.phone || '',
        address: p.profile?.address || '',
        date_of_birth: p.profile?.date_of_birth?.split('T')[0] || '',
        occupation: p.profile?.occupation || '',
      })
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setServerMsg('')
    try {
      await profileApi.updateMe(form)
      setServerMsg('Profile updated successfully.')
      setEditing(false)
    } catch (err: any) {
      setServerMsg(err.response?.data?.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard">
      {/* Nav */}
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className={`role-badge ${user?.role}`}>
            {user?.role === 'attorney' ? 'Attorney' : 'Client'}
          </span>
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        {/* Back button */}
        <button className="btn-back" onClick={() => navigate(dashPath)}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <div className="profile-page">
          {/* Hero card */}
          <div className="profile-hero-card">
            <div className="profile-hero-avatar">{initials}</div>
            <h1 className="profile-hero-name">{form.fullname || user?.fullname}</h1>
            <span className={`role-badge ${user?.role}`} style={{ marginTop: '0.35rem' }}>
              {user?.role === 'attorney' ? 'Attorney' : 'Client'}
            </span>
          </div>

          {/* Action row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '1rem' }}>
            {editing ? (
              <>
                <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  <Save size={15} />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button className="btn-primary" onClick={() => setEditing(true)}>
                <Edit2 size={15} />
                Edit Profile
              </button>
            )}
          </div>

          {serverMsg && (
            <p style={{ color: serverMsg.includes('success') ? '#22c55e' : '#ef4444', marginBottom: '1rem' }}>
              {serverMsg}
            </p>
          )}

          {/* Info cards */}
          <div className="profile-info-grid">
            {/* Full Name */}
            <div className="profile-info-card">
              <div className="profile-info-icon icon-gold"><UserCircle size={20} /></div>
              <div className="profile-info-body">
                <label>Full Name</label>
                {editing ? (
                  <input
                    value={form.fullname}
                    onChange={(e) => setForm({ ...form, fullname: e.target.value })}
                    className="profile-input"
                  />
                ) : (
                  <span>{form.fullname}</span>
                )}
              </div>
            </div>

            {/* Username (read-only) */}
            <div className="profile-info-card">
              <div className="profile-info-icon icon-blue"><AtSign size={20} /></div>
              <div className="profile-info-body">
                <label>Username</label>
                <span>@{user?.username}</span>
              </div>
            </div>

            {/* Email (read-only) */}
            <div className="profile-info-card">
              <div className="profile-info-icon icon-green"><Mail size={20} /></div>
              <div className="profile-info-body">
                <label>Email Address</label>
                <span>{user?.email}</span>
              </div>
            </div>

            {/* Role (read-only) */}
            <div className="profile-info-card">
              <div className="profile-info-icon icon-purple"><ShieldCheck size={20} /></div>
              <div className="profile-info-body">
                <label>Role</label>
                <span style={{ textTransform: 'capitalize' }}>{user?.role}</span>
              </div>
            </div>

            {/* Client-only fields */}
            {user?.role === 'client' && (
              <>
                <div className="profile-info-card">
                  <div className="profile-info-icon icon-gold"><Phone size={20} /></div>
                  <div className="profile-info-body">
                    <label>Phone</label>
                    {editing ? (
                      <input
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="e.g. +63 912 345 6789"
                        className="profile-input"
                      />
                    ) : (
                      <span>{form.phone || '—'}</span>
                    )}
                  </div>
                </div>

                <div className="profile-info-card">
                  <div className="profile-info-icon icon-blue"><Briefcase size={20} /></div>
                  <div className="profile-info-body">
                    <label>Occupation</label>
                    {editing ? (
                      <input
                        value={form.occupation}
                        onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                        placeholder="e.g. Business Owner"
                        className="profile-input"
                      />
                    ) : (
                      <span>{form.occupation || '—'}</span>
                    )}
                  </div>
                </div>

                <div className="profile-info-card" style={{ gridColumn: '1 / -1' }}>
                  <div className="profile-info-icon icon-green"><MapPin size={20} /></div>
                  <div className="profile-info-body">
                    <label>Address</label>
                    {editing ? (
                      <textarea
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        placeholder="Street, City, Province"
                        className="profile-input"
                        rows={2}
                      />
                    ) : (
                      <span>{form.address || '—'}</span>
                    )}
                  </div>
                </div>

                {profile?.profile?.attorney_name && (
                  <div className="profile-info-card">
                    <div className="profile-info-icon icon-purple"><ShieldCheck size={20} /></div>
                    <div className="profile-info-body">
                      <label>Assigned Attorney</label>
                      <span>{profile.profile.attorney_name}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
