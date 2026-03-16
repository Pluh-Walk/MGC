import { useEffect, useState } from 'react'
import { ShieldCheck, CheckCircle, XCircle, AlertCircle, X, ExternalLink, Clock, User, Scale, CreditCard } from 'lucide-react'
import { adminApi } from '../services/api'

interface Verification {
  id: number
  fullname: string
  email: string
  username: string
  role: string
  ibp_number: string | null
  ibp_chapter: string | null
  id_type: string | null
  id_number: string | null
  id_photo: string | null
  created_at: string
}

export default function AdminVerificationQueue() {
  const [queue, setQueue] = useState<Verification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selected, setSelected] = useState<Verification | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [processing, setProcessing] = useState<number | null>(null)

  const fetchQueue = () => {
    setLoading(true)
    adminApi.verificationQueue()
      .then(res => setQueue(res.data.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchQueue() }, [])

  const handleApprove = async (v: Verification) => {
    setProcessing(v.id)
    try {
      await adminApi.handleVerification(v.id, 'approve')
      setSuccess(`${v.fullname} approved successfully.`)
      fetchQueue()
    } catch (err: any) { setError(err.response?.data?.message || 'Failed.') }
    finally { setProcessing(null) }
  }

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) return
    setProcessing(selected.id)
    try {
      await adminApi.handleVerification(selected.id, 'reject', rejectReason)
      setSuccess(`${selected.fullname} rejected.`)
      setShowReject(false)
      setSelected(null)
      setRejectReason('')
      fetchQueue()
    } catch (err: any) { setError(err.response?.data?.message || 'Failed.') }
    finally { setProcessing(null) }
  }

  const openReject = (v: Verification) => {
    setSelected(v)
    setRejectReason('')
    setShowReject(true)
  }

  const attorneyCount = queue.filter(v => v.role === 'attorney').length
  const clientCount = queue.filter(v => v.role === 'client').length

  return (
    <div className="admin-dash">
      <div className="admin-dash-header">
        <div>
          <h1><ShieldCheck size={24} /> Verification Queue</h1>
          <span className="subtitle">{queue.length} pending verification{queue.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> {error} <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button></div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}><CheckCircle size={16} /> {success} <button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button></div>}

      {/* Summary pills */}
      {!loading && queue.length > 0 && (
        <div className="verif-summary-row">
          <div className="verif-summary-pill">
            <Scale size={14} />
            <span>{attorneyCount} Attorney{attorneyCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="verif-summary-pill">
            <User size={14} />
            <span>{clientCount} Client{clientCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {loading ? <div className="page-loading"><div className="spinner" /></div> : queue.length === 0 ? (
        <div className="admin-empty-state">
          <ShieldCheck size={48} />
          <h3>All Clear</h3>
          <p>No pending verifications at this time.</p>
        </div>
      ) : (
        <div className="verif-grid">
          {queue.map(v => (
            <div key={v.id} className="verif-card">
              <div className="verif-card-top">
                <div className="verif-avatar" data-role={v.role}>
                  {v.fullname.charAt(0).toUpperCase()}
                </div>
                <div className="verif-card-info">
                  <h3>{v.fullname}</h3>
                  <span className="verif-meta">@{v.username} &middot; {v.email}</span>
                </div>
                <span className={`pill pill-${v.role}`}>{v.role}</span>
              </div>

              <div className="verif-details">
                {v.role === 'attorney' && (
                  <>
                    <div className="verif-detail-row">
                      <CreditCard size={14} />
                      <span className="detail-label">IBP Number</span>
                      <span className="detail-value">{v.ibp_number || '—'}</span>
                    </div>
                    <div className="verif-detail-row">
                      <Scale size={14} />
                      <span className="detail-label">Chapter</span>
                      <span className="detail-value">{v.ibp_chapter || '—'}</span>
                    </div>
                  </>
                )}
                {v.role === 'client' && v.id_type && (
                  <div className="verif-detail-row">
                    <CreditCard size={14} />
                    <span className="detail-label">{v.id_type}</span>
                    <span className="detail-value">{v.id_number || '—'}</span>
                  </div>
                )}
                <div className="verif-detail-row">
                  <Clock size={14} />
                  <span className="detail-label">Registered</span>
                  <span className="detail-value">{new Date(v.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {v.id_photo && (
                <a href={`http://localhost:5000${v.id_photo}`} target="_blank" rel="noopener noreferrer" className="verif-photo-link">
                  <ExternalLink size={14} /> View uploaded ID document
                </a>
              )}

              <div className="verif-actions">
                <button className="verif-btn verif-btn-approve" onClick={() => handleApprove(v)} disabled={processing === v.id}>
                  <CheckCircle size={16} /> {processing === v.id ? 'Processing…' : 'Approve'}
                </button>
                <button className="verif-btn verif-btn-reject" onClick={() => openReject(v)} disabled={processing === v.id}>
                  <XCircle size={16} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showReject && selected && (
        <div className="modal-overlay" onClick={() => setShowReject(false)}>
          <div className="admin-suspend-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-top">
              <h3><XCircle size={18} /> Reject {selected.fullname}</h3>
              <button onClick={() => setShowReject(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p>This user will be notified of the rejection with your reason.</p>
              <textarea rows={3} placeholder="Reason for rejection…" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowReject(false)}>Cancel</button>
              <button className="btn-primary" style={{ background: 'var(--danger)' }} onClick={handleReject} disabled={!rejectReason.trim() || processing === selected.id}>
                {processing === selected.id ? 'Rejecting…' : 'Reject User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
