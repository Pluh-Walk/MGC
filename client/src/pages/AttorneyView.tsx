import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Scale, ArrowLeft, UserCircle, Mail, Phone, MapPin,
  Award, Star, BadgeCheck, Briefcase, Clock, Loader2,
  CheckCircle2, Users, TrendingUp, MessageSquare, Send, Trash2, Pencil,
} from 'lucide-react'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'
import { profileApi, reviewsApi } from '../services/api'

interface AttorneyProfile {
  id: number
  fullname: string
  email: string
  phone: string | null
  office_address: string | null
  law_firm: string | null
  specializations: string | null
  court_admissions: string | null
  years_experience: number | null
  bio: string | null
  availability: string | null
  photo_path: string | null
}

interface AttorneyStats {
  active_cases: number
  completed_cases: number
  pending_cases: number
  total_cases: number
  total_clients: number
}

interface Review {
  id: number
  client_id: number
  client_name: string
  rating: number
  comment: string | null
  created_at: string
}

type Tab = 'info' | 'cases' | 'reviews'

const AVAIL_COLOR: Record<string, string> = {
  available: '#22c55e',
  in_court:  '#f59e0b',
  offline:   '#ef4444',
}
const AVAIL_LABEL: Record<string, string> = {
  available: 'Available',
  in_court:  'In Court',
  offline:   'Offline',
}

function mkInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export default function AttorneyView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [profile, setProfile]       = useState<AttorneyProfile | null>(null)
  const [loading, setLoading]       = useState(true)
  const [imgError, setImgError]     = useState(false)
  const [tab, setTab]               = useState<Tab>('info')
  const [stats, setStats]           = useState<AttorneyStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // Reviews state
  const [reviews,        setReviews]        = useState<Review[]>([])
  const [reviewsAvg,     setReviewsAvg]     = useState<number>(0)
  const [reviewsTotal,   setReviewsTotal]   = useState<number>(0)
  const [reviewsLoaded,  setReviewsLoaded]  = useState(false)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [myRating,    setMyRating]    = useState(0)
  const [hoverStar,   setHoverStar]   = useState(0)
  const [myComment,   setMyComment]   = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [reviewMsg,   setReviewMsg]   = useState<{ text: string; ok: boolean } | null>(null)
  const [clientImgErrors, setClientImgErrors] = useState<Record<number, boolean>>({})
  const [myReviewId,  setMyReviewId]  = useState<number | null>(null)
  const [deleting,    setDeleting]    = useState(false)
  const [showWriteBox, setShowWriteBox] = useState(true)

  useEffect(() => {
    if (!id) return
    profileApi.getAttorney(Number(id))
      .then(res => setProfile(res.data.data as AttorneyProfile))
      .catch(() => navigate('/attorneys'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (tab !== 'cases' || !id || stats) return
    setStatsLoading(true)
    profileApi.getAttorneyPublicStats(Number(id))
      .then(res => setStats(res.data.data as AttorneyStats))
      .finally(() => setStatsLoading(false))
  }, [tab, id])

  useEffect(() => {
    if (tab !== 'reviews' || !id || reviewsLoaded) return
    setReviewsLoading(true)
    Promise.all([
      reviewsApi.getAttorneyReviews(Number(id)),
      reviewsApi.getMyReview(Number(id)),
    ]).then(([revRes, myRes]) => {
      setReviews(revRes.data.data as Review[])
      setReviewsAvg(revRes.data.avg_rating ?? 0)
      setReviewsTotal(revRes.data.total ?? 0)
      if (myRes.data.data) {
        setMyRating(myRes.data.data.rating)
        setMyComment(myRes.data.data.comment ?? '')
        setMyReviewId(myRes.data.data.id ?? null)
        setShowWriteBox(false)
      }
      setReviewsLoaded(true)
    }).finally(() => setReviewsLoading(false))
  }, [tab, id])

  async function submitReview() {
    if (!id || myRating === 0) return
    setSubmitting(true)
    setReviewMsg(null)
    try {
      await reviewsApi.submitReview(Number(id), { rating: myRating, comment: myComment })
      setReviewMsg({ text: 'Review submitted!', ok: true })
      setShowWriteBox(false)
      const [revRes, myRes] = await Promise.all([
        reviewsApi.getAttorneyReviews(Number(id)),
        reviewsApi.getMyReview(Number(id)),
      ])
      setReviews(revRes.data.data as Review[])
      setReviewsAvg(revRes.data.avg_rating ?? 0)
      setReviewsTotal(revRes.data.total ?? 0)
      if (myRes.data.data) {
        setMyRating(myRes.data.data.rating)
        setMyComment(myRes.data.data.comment ?? '')
        setMyReviewId(myRes.data.data.id ?? null)
      }
    } catch {
      setReviewMsg({ text: 'Failed to submit. Please try again.', ok: false })
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteReview() {
    if (!id || !window.confirm('Delete your review? This cannot be undone.')) return
    setDeleting(true)
    setReviewMsg(null)
    try {
      await reviewsApi.deleteReview(Number(id))
      setMyReviewId(null)
      setMyRating(0)
      setMyComment('')
      setShowWriteBox(true)
      setReviewMsg({ text: 'Your review has been deleted.', ok: true })
      const revRes = await reviewsApi.getAttorneyReviews(Number(id))
      setReviews(revRes.data.data as Review[])
      setReviewsAvg(revRes.data.avg_rating ?? 0)
      setReviewsTotal(revRes.data.total ?? 0)
    } catch {
      setReviewMsg({ text: 'Failed to delete review. Please try again.', ok: false })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <nav className="dash-nav">
          <div className="dash-nav-brand"><Scale size={22} className="nav-icon" />MGC Law System</div>
        </nav>
        <main className="dash-content">
          <div className="loading-state">Loading attorney profileâ€¦</div>
        </main>
      </div>
    )
  }

  if (!profile) return null

  const avail = profile.availability ?? 'offline'
  const specs = profile.specializations
    ? profile.specializations.split(',').map(s => s.trim()).filter(Boolean)
    : []

  return (
    <div className="dashboard">
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className="role-badge client">Client</span>
          <NotificationBell />
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        <button className="btn-back" onClick={() => navigate('/attorneys')}>
          <ArrowLeft size={16} />Back to Attorneys
        </button>

        <div className="atty-profile-layout">

          {/* â•â•â•â• SIDEBAR â•â•â•â• */}
          <aside className="atty-sidebar">
            <div className="atty-hero-card">
              <div className="atty-avatar-wrap">
                <div className="atty-avatar">
                  {imgError
                    ? <span className="atty-avatar-initials">{mkInitials(profile.fullname)}</span>
                    : <img
                        src={profileApi.photoUrl(profile.id)}
                        alt={profile.fullname}
                        className="atty-avatar-img"
                        onError={() => setImgError(true)}
                      />
                  }
                </div>
              </div>
              <h2 className="atty-hero-name">{profile.fullname}</h2>
              <div className="atty-hero-badges">
                <span className="role-badge attorney">Attorney</span>
                <span className="atty-verified-badge"><BadgeCheck size={12} /> Verified</span>
              </div>
              {profile.law_firm && (
                <p className="atty-hero-firm"><Award size={13} /> {profile.law_firm}</p>
              )}
              <div className="client-consult-status">
                <span className="avail-dot" style={{ background: AVAIL_COLOR[avail] }} />
                <span style={{ color: AVAIL_COLOR[avail] }}>{AVAIL_LABEL[avail] ?? 'Offline'}</span>
              </div>
            </div>

            {/* Contact card */}
            <div className="atty-sidebar-card">
              <p className="atty-sidebar-label"><MessageSquare size={13} /> Contact Attorney</p>
              <button
                className="btn-primary"
                style={{ width: '100%', marginTop: '0.6rem' }}
                onClick={() => navigate(`/messages?with=${profile.id}`)}
              >
                <MessageSquare size={14} /> Send a Message
              </button>
            </div>

          </aside>

          {/* â•â•â•â• MAIN CONTENT â•â•â•â• */}
          <div className="atty-main">

            {/* Tabs */}
            <div className="atty-tabs">
              <button
                className={`atty-tab${tab === 'info' ? ' active' : ''}`}
                onClick={() => setTab('info')}
              >
                <UserCircle size={15} /> Professional Info
              </button>
              <button
                className={`atty-tab${tab === 'cases' ? ' active' : ''}`}
                onClick={() => setTab('cases')}
              >
                <Briefcase size={15} /> Case Progress
              </button>
              <button
                className={`atty-tab${tab === 'reviews' ? ' active' : ''}`}
                onClick={() => setTab('reviews')}
              >
                <Star size={15} /> Reviews
              </button>
            </div>

            {/* â”€â”€ Professional Info Tab â”€â”€ */}
            {tab === 'info' && (
              <div className="atty-section">
                <div className="atty-section-header">
                  <h3><UserCircle size={18} /> Professional Information</h3>
                </div>

                <div className="atty-form-grid">
                  {profile.years_experience != null && (
                    <div className="atty-field">
                      <label><Star size={14} /> Years of Experience</label>
                      <span>{profile.years_experience} yr{profile.years_experience !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {profile.phone && (
                    <div className="atty-field">
                      <label><Phone size={14} /> Contact Number</label>
                      <span>{profile.phone}</span>
                    </div>
                  )}
                  {profile.email && (
                    <div className="atty-field">
                      <label><Mail size={14} /> Email</label>
                      <span>{profile.email}</span>
                    </div>
                  )}
                  {specs.length > 0 && (
                    <div className="atty-field">
                      <label><Briefcase size={14} /> Specializations</label>
                      <div className="atty-dir-specs" style={{ marginTop: '0.25rem' }}>
                        {specs.map(s => (
                          <span key={s} className="atty-dir-spec-chip">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.office_address && (
                    <div className="atty-field full-width">
                      <label><MapPin size={14} /> Office Address</label>
                      <span>{profile.office_address}</span>
                    </div>
                  )}
                  {profile.court_admissions && (
                    <div className="atty-field full-width">
                      <label><Clock size={14} /> Court Admissions</label>
                      <span>{profile.court_admissions}</span>
                    </div>
                  )}
                </div>

                {profile.bio && (
                  <div style={{ marginTop: '1.25rem' }}>
                    <div className="atty-section-header" style={{ marginBottom: '0.5rem' }}>
                      <h3><UserCircle size={18} /> About</h3>
                    </div>
                    <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {profile.bio}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* â”€â”€ Case Progress Tab â”€â”€ */}
            {tab === 'cases' && (
              <div className="atty-section">
                <div className="atty-section-header">
                  <h3><Briefcase size={18} /> Case Progress</h3>
                </div>

                {statsLoading ? (
                  <div className="loading-state"><Loader2 size={28} className="spin" /></div>
                ) : stats ? (
                  <>
                    <div className="client-case-stats-grid">
                      <div className="client-stat-card">
                        <Briefcase size={20} className="stat-icon gold" />
                        <strong>{stats.active_cases}</strong>
                        <span>Active Cases</span>
                      </div>
                      <div className="client-stat-card">
                        <CheckCircle2 size={20} className="stat-icon green" />
                        <strong>{stats.completed_cases}</strong>
                        <span>Completed Cases</span>
                      </div>
                      <div className="client-stat-card">
                        <TrendingUp size={20} className="stat-icon blue" />
                        <strong>{stats.total_cases}</strong>
                        <span>Total Cases</span>
                      </div>
                      <div className="client-stat-card">
                        <Users size={20} className="stat-icon" />
                        <strong>{stats.total_clients}</strong>
                        <span>Clients Handled</span>
                      </div>
                    </div>

                    {stats.total_cases > 0 && (
                      <div style={{ marginTop: '1.5rem' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                          Completion Rate
                        </p>
                        <div style={{
                          background: 'var(--border)',
                          borderRadius: '999px',
                          height: '8px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${Math.round((stats.completed_cases / stats.total_cases) * 100)}%`,
                            background: 'var(--accent)',
                            height: '100%',
                            borderRadius: '999px',
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                          {Math.round((stats.completed_cases / stats.total_cases) * 100)}% of cases completed
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No case data available.</p>
                )}
              </div>
            )}

            {/* â”€â”€ Reviews Tab â”€â”€ */}
            {tab === 'reviews' && (
              <div className="atty-section">
                <div className="atty-section-header">
                  <h3><Star size={18} /> Reviews &amp; Ratings</h3>
                </div>

                {reviewsLoading ? (
                  <div className="loading-state"><Loader2 size={28} className="spin" /></div>
                ) : (
                  <>
                    {/* â”€â”€ Summary bar â”€â”€ */}
                    <div className="rv-summary">
                      <div className="rv-big-score">{Number(reviewsAvg).toFixed(1)}</div>
                      <div className="rv-summary-right">
                        <div className="rv-stars-row">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} size={18}
                              fill={reviewsAvg >= s ? '#f59e0b' : reviewsAvg >= s - 0.5 ? '#f59e0b' : 'none'}
                              stroke='#f59e0b'
                              opacity={reviewsAvg >= s - 0.5 ? 1 : 0.3}
                            />
                          ))}
                        </div>
                        <span className="rv-total">{reviewsTotal} review{reviewsTotal !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* â”€â”€ Write your review â”€â”€ */}
                    {showWriteBox && <div className="rv-write-box">
                      <p className="rv-write-label">Your Rating</p>
                      <div className="rv-star-picker">
                        {[1,2,3,4,5].map(s => (
                          <button key={s} className="rv-star-btn"
                            onMouseEnter={() => setHoverStar(s)}
                            onMouseLeave={() => setHoverStar(0)}
                            onClick={() => setMyRating(s)}
                          >
                            <Star size={28}
                              fill={(hoverStar || myRating) >= s ? '#f59e0b' : 'none'}
                              stroke={(hoverStar || myRating) >= s ? '#f59e0b' : 'var(--text-muted)'}
                            />
                          </button>
                        ))}
                        {myRating > 0 && (
                          <span className="rv-star-label">
                            {['','Poor','Fair','Good','Very Good','Excellent'][myRating]}
                          </span>
                        )}
                      </div>
                      <textarea
                        className="rv-comment-input"
                        placeholder="Share your experience with this attorney (optional)â€¦"
                        rows={3}
                        value={myComment}
                        onChange={e => setMyComment(e.target.value)}
                      />
                      {reviewMsg && (
                        <p className={`rv-msg${reviewMsg.ok ? ' ok' : ' err'}`}>{reviewMsg.text}</p>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {myReviewId && (
                          <button className="btn-secondary" onClick={() => setShowWriteBox(false)}>
                            Cancel
                          </button>
                        )}
                        <button
                          className="btn-primary"
                          onClick={submitReview}
                          disabled={submitting || myRating === 0}
                        >
                          {submitting ? <Loader2 size={13} className="spin" /> : <Send size={13} />}
                          {submitting ? 'Submitting…' : myRating > 0 ? (myReviewId ? 'Update Review' : 'Submit Review') : 'Select a rating first'}
                        </button>
                      </div>
                    </div>}

                    {/* â”€â”€ Review list â”€â”€ */}
                    {reviews.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>No reviews yet. Be the first!</p>
                    ) : (
                      <div className="rv-list">
                        {reviews.map(r => {
                          const ini = r.client_name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
                          return (
                            <div key={r.id} className="rv-item">
                              <div className="rv-avatar">
                                {!clientImgErrors[r.client_id] ? (
                                  <img
                                    src={profileApi.photoUrl(r.client_id)}
                                    alt={r.client_name}
                                    onError={() => setClientImgErrors(prev => ({ ...prev, [r.client_id]: true }))}
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
                                  {r.id === myReviewId && (
                                    <>
                                      <button
                                        className="rv-action-btn"
                                        onClick={() => setShowWriteBox(true)}
                                        title="Edit your review"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button
                                        className="rv-delete-btn"
                                        onClick={deleteReview}
                                        disabled={deleting}
                                        title="Delete your review"
                                      >
                                        {deleting ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                                      </button>
                                    </>
                                  )}
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

          </div>
        </div>
      </main>
    </div>
  )
}
