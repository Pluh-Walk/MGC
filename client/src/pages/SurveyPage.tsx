import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Scale, Loader2, CheckCircle, Star } from 'lucide-react'
import api from '../services/api'

interface SurveyData {
  id: number
  case_number: string
  case_title: string
  client_name: string
  outcome: string | null
}

function StarRating({ label, value, onChange }: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem' }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: n <= value ? '#f59e0b' : 'var(--border)',
              padding: 2, fontSize: '1.8rem', lineHeight: 1,
            }}
            onClick={() => onChange(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''} for ${label}`}
          >
            <Star size={28} fill={n <= value ? '#f59e0b' : 'none'} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function SurveyPage() {
  const { token } = useParams<{ token: string }>()
  const [survey,    setSurvey]    = useState<SurveyData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving,    setSaving]    = useState(false)

  const [nps,          setNps]          = useState(0)
  const [satisfaction, setSatisfaction] = useState(0)
  const [communication, setCommunication] = useState(0)
  const [outcome,       setOutcome]      = useState(0)
  const [comments,      setComments]     = useState('')

  useEffect(() => {
    api.get(`/survey/${token}`)
      .then(r => setSurvey(r.data.data))
      .catch(e => setError(e.response?.data?.message ?? 'Survey not found or already completed.'))
      .finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async () => {
    if (!nps || !satisfaction || !communication) {
      setError('Please fill in all required ratings.')
      return
    }
    setSaving(true)
    try {
      await api.post(`/survey/${token}`, {
        nps_score:            nps - 1,   // map 1-10 from 1-star=1 to actual 0-10 scale
        satisfaction_rating:  satisfaction,
        communication_rating: communication,
        outcome_rating:       outcome || null,
        comments:             comments.trim() || null,
      })
      setSubmitted(true)
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Failed to submit. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <Loader2 size={32} className="spin" style={{ color: 'var(--accent)' }} />
    </div>
  )

  if (submitted) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <CheckCircle size={56} style={{ color: 'var(--success)', marginBottom: 20 }} />
        <h2 style={{ color: 'var(--text)', marginBottom: 12 }}>Thank you for your feedback!</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Your response has been recorded. We appreciate you taking the time to share your experience.
        </p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          background: '#1a365d', borderRadius: '12px 12px 0 0',
          padding: '24px 32px', marginBottom: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Scale size={22} style={{ color: '#c9a84c' }} />
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>MGC Law System</span>
          </div>
          <p style={{ color: '#bee3f8', margin: 0, fontSize: '0.85rem' }}>
            Client Satisfaction Survey
          </p>
        </div>

        <div style={{
          background: 'var(--surface-solid)', border: '1px solid var(--border)',
          borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '28px 32px',
        }}>
          {survey && (
            <div style={{
              background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
              borderRadius: 8, padding: '12px 16px', marginBottom: 24,
            }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>{survey.case_title}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 2 }}>
                Case #{survey.case_number}
                {survey.outcome && ` · Outcome: ${survey.outcome}`}
              </div>
            </div>
          )}

          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>
            Your case has been closed. We'd love to hear about your experience working with us.
            This survey is completely confidential and helps us improve our services.
          </p>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              color: 'var(--danger)', fontSize: '0.85rem',
            }}>
              {error}
            </div>
          )}

          {/* NPS: repurpose star rating 1-5 mapped to 0-10 scale */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem' }}>
              How likely are you to recommend us to a friend or colleague? *
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                (1 = Not at all, 5 = Extremely likely)
              </span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setNps(n)}
                  style={{
                    width: 44, height: 44, border: '2px solid',
                    borderColor: nps === n ? 'var(--accent)' : 'var(--border)',
                    borderRadius: 8, cursor: 'pointer', fontWeight: 700,
                    background: nps === n ? 'rgba(201,168,76,0.2)' : 'var(--surface-2)',
                    color: nps === n ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '0.95rem',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <StarRating
            label="Overall Satisfaction *"
            value={satisfaction}
            onChange={setSatisfaction}
          />

          <StarRating
            label="Communication Quality *"
            value={communication}
            onChange={setCommunication}
          />

          <StarRating
            label="Outcome Satisfaction (optional)"
            value={outcome}
            onChange={setOutcome}
          />

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem' }}>
              Additional Comments (optional)
            </label>
            <textarea
              rows={4}
              style={{
                width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontSize: '0.9rem',
                resize: 'vertical',
              }}
              placeholder="Tell us about your experience, what we could improve, or any other feedback…"
              value={comments}
              onChange={e => setComments(e.target.value)}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#0f172a', fontWeight: 700,
              fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? <Loader2 size={18} className="spin" /> : null}
            Submit Feedback
          </button>
        </div>
      </div>
    </div>
  )
}
