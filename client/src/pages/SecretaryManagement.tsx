import { useEffect, useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scale, ArrowLeft, UserPlus, Users, Mail, Trash2, AlertCircle, CheckCircle2, X, Clock, XCircle, Phone, Link2, Send } from 'lucide-react'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { secretaryApi } from '../services/api'

interface Secretary {
  id: number
  fullname: string
  username: string
  email: string
  phone: string | null
  linked_at: string
}

interface Invitation {
  id: number
  email: string
  status: string
  created_at: string
  expires_at: string
}

export default function SecretaryManagement() {
  const [secretaries, setSecretaries] = useState<Secretary[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Invite form
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)

  const fetchData = () => {
    setLoading(true)
    secretaryApi.list()
      .then(res => {
        setSecretaries(res.data.data.secretaries || [])
        setInvitations(res.data.data.invitations || [])
      })
      .catch(err => setError(err.response?.data?.message || 'Failed to load.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(''), 4000); return () => clearTimeout(t) }
  }, [error])

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t) }
  }, [success])

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault()
    setInviting(true)
    try {
      await secretaryApi.invite(inviteEmail)
      setSuccess(`Invitation sent to ${inviteEmail}.`)
      setInviteEmail('')
      setShowInvite(false)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send invitation.')
    } finally { setInviting(false) }
  }

  const handleRemove = async (s: Secretary) => {
    if (!confirm(`Remove ${s.fullname} as your secretary? They will lose access to your cases.`)) return
    try {
      await secretaryApi.remove(s.id)
      setSuccess(`${s.fullname} removed.`)
      fetchData()
    } catch (err: any) { setError(err.response?.data?.message || 'Failed.') }
  }

  const handleRevoke = async (inv: Invitation) => {
    try {
      await secretaryApi.revokeInvite(inv.id)
      setSuccess(`Invitation to ${inv.email} revoked.`)
      fetchData()
    } catch (err: any) { setError(err.response?.data?.message || 'Failed.') }
  }

  const pendingInvitations = invitations.filter(i => i.status === 'pending')

  const daysUntilExpiry = (d: string) => {
    const diff = new Date(d).getTime() - Date.now()
    const days = Math.ceil(diff / 86400000)
    return days > 0 ? `${days}d left` : 'Expired'
  }

  const navigate = useNavigate()

  return (
    <div className="dashboard">
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className="role-badge attorney">Attorney</span>
          <NotificationBell />
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        <button className="btn-back" onClick={() => navigate('/dashboard/attorney')}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div className="page-header-row">
          <div>
            <h2>Secretary Management</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {secretaries.length} active &middot; {pendingInvitations.length} pending
            </p>
          </div>
          <button className="btn-back" onClick={() => setShowInvite(true)} style={{ background: 'var(--accent)', color: '#000', border: 'none' }}>
            <UserPlus size={16} /> Invite Secretary
          </button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> {error} <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button></div>}
        {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}><CheckCircle2 size={16} /> {success} <button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button></div>}

        {loading ? <div className="loading-state"><div className="spinner" /></div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Active Secretaries */}
          <div className="admin-activity-card">
            <div className="card-header">
              <h3><Users size={16} /> Active Secretaries</h3>
              <span className="pill pill-active" style={{ fontSize: '0.72rem' }}>{secretaries.length}</span>
            </div>

            {secretaries.length === 0 ? (
              <div className="admin-empty-state" style={{ padding: '2.5rem 1.5rem' }}>
                <Users size={40} />
                <h3>No Secretaries Yet</h3>
                <p>Invite someone to help manage your cases and schedule.</p>
              </div>
            ) : (
              <div className="sec-card-grid">
                {secretaries.map(s => (
                  <div key={s.id} className="sec-card">
                    <div className="sec-card-top">
                      <div className="sec-avatar">
                        {s.fullname.charAt(0).toUpperCase()}
                      </div>
                      <div className="sec-card-info">
                        <h4>{s.fullname}</h4>
                        <span className="sec-username">@{s.username}</span>
                      </div>
                      <button
                        className="action-icon-btn danger"
                        title="Remove secretary"
                        onClick={() => handleRemove(s)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="sec-card-details">
                      <div className="sec-detail-row">
                        <Mail size={13} />
                        <span>{s.email}</span>
                      </div>
                      {s.phone && (
                        <div className="sec-detail-row">
                          <Phone size={13} />
                          <span>{s.phone}</span>
                        </div>
                      )}
                      <div className="sec-detail-row">
                        <Link2 size={13} />
                        <span>Linked {new Date(s.linked_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <div className="admin-activity-card">
              <div className="card-header">
                <h3><Clock size={16} /> Pending Invitations</h3>
                <span className="pill pill-pending" style={{ fontSize: '0.72rem' }}>{pendingInvitations.length}</span>
              </div>
              <div style={{ padding: 0 }}>
                {pendingInvitations.map(inv => (
                  <div key={inv.id} className="sec-invite-row">
                    <div className="sec-invite-icon">
                      <Mail size={16} />
                    </div>
                    <div className="sec-invite-info">
                      <span className="sec-invite-email">{inv.email}</span>
                      <div className="sec-invite-meta">
                        <span><Send size={11} /> Sent {new Date(inv.created_at).toLocaleDateString()}</span>
                        <span className={`sec-invite-expiry ${new Date(inv.expires_at).getTime() < Date.now() ? 'expired' : ''}`}>
                          <Clock size={11} /> {daysUntilExpiry(inv.expires_at)}
                        </span>
                      </div>
                    </div>
                    <button
                      className="action-icon-btn danger"
                      title="Revoke invitation"
                      onClick={() => handleRevoke(inv)}
                    >
                      <XCircle size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        )}

        {/* Invite Modal */}
        {showInvite && (
          <div className="modal-overlay" onClick={() => setShowInvite(false)}>
            <div className="admin-create-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-top">
              <h3><UserPlus size={18} /> Invite Secretary</h3>
              <button onClick={() => setShowInvite(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleInvite}>
              <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Enter the email address of the person you want to invite. They'll receive a link to register as your secretary and gain access to your cases.
              </p>
              <div className="field-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="secretary@example.com"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowInvite(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={inviting}>
                  <Send size={15} /> {inviting ? 'Sending…' : 'Send Invitation'}
                </button>
              </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
