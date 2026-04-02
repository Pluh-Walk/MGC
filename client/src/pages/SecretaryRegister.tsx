import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Scale,
  User,
  Lock,
  Eye,
  EyeOff,
  Phone,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { authService } from '../services/authService'
import { useAuth } from '../context/AuthContext'

export default function SecretaryRegister() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [form, setForm] = useState({
    fullname: '',
    username: '',
    password: '',
    confirmPassword: '',
    phone: '',
  })
  const [showPw, setShowPw] = useState(false)
  const [showCPw, setShowCPw] = useState(false)

  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Invitation details
  const [inviteEmail, setInviteEmail] = useState('')
  const [attorneyName, setAttorneyName] = useState('')
  const [tokenValid, setTokenValid] = useState(false)

  useEffect(() => {
    if (!token) {
      setValidating(false)
      setError('No invitation token provided. Please use the link from your invitation email.')
      return
    }

    authService.validateInvitation(token)
      .then((res) => {
        setInviteEmail(res.data.invitation.email)
        setAttorneyName(res.data.invitation.attorney_name)
        setTokenValid(true)
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Invalid or expired invitation.')
      })
      .finally(() => setValidating(false))
  }, [token])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.fullname.trim()) e.fullname = 'Full name is required.'
    if (!form.username.trim()) e.username = 'Username is required.'
    if (form.username.length < 3) e.username = 'Username must be at least 3 characters.'
    if (!form.password) e.password = 'Password is required.'
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters.'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!validate()) return

    setLoading(true)
    try {
      const res = await authService.registerSecretary({
        token,
        fullname: form.fullname.trim(),
        username: form.username.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        phone: form.phone.trim() || undefined,
      })

      if (res.data.success) {
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('user', JSON.stringify(res.data.user))
        setUser(res.data.user)

        setSuccess('Registration successful! Redirecting…')
        setTimeout(() => navigate('/dashboard/secretary'), 800)
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Registration failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 size={32} className="spinner" />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Verifying invitation…</p>
        </div>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon"><Scale size={26} /></div>
            <h1>MGC Law</h1>
            <p>Secretary Registration</p>
          </div>
          <div className="alert alert-error"><AlertCircle size={16} /> {error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><Scale size={26} /></div>
          <h1>MGC Law</h1>
          <p>Secretary Registration</p>
        </div>

        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          <CheckCircle2 size={16} />
          You've been invited by <strong>{attorneyName}</strong> to join as their secretary.
        </div>

        {error && <div className="alert alert-error"><AlertCircle size={16} /> {error}</div>}
        {success && <div className="alert alert-success"><CheckCircle2 size={16} /> {success}</div>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <h2>Create your account</h2>
          <p className="subtitle">Email: <strong>{inviteEmail}</strong></p>

          {/* Full Name */}
          <div className="form-group">
            <label>Full Name</label>
            <div className="input-wrapper">
              <User size={16} className="input-icon" />
              <input
                type="text"
                placeholder="Enter your full name"
                className={errors.fullname ? 'invalid' : ''}
                value={form.fullname}
                onChange={(e) => setForm({ ...form, fullname: e.target.value })}
              />
            </div>
            {errors.fullname && <p className="field-error"><AlertCircle size={12} /> {errors.fullname}</p>}
          </div>

          {/* Username */}
          <div className="form-group">
            <label>Username</label>
            <div className="input-wrapper">
              <User size={16} className="input-icon" />
              <input
                type="text"
                placeholder="Choose a username"
                className={errors.username ? 'invalid' : ''}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                autoComplete="username"
              />
            </div>
            {errors.username && <p className="field-error"><AlertCircle size={12} /> {errors.username}</p>}
          </div>

          {/* Phone */}
          <div className="form-group">
            <label>Phone <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(optional)</span></label>
            <div className="input-wrapper">
              <Phone size={16} className="input-icon" />
              <input
                type="tel"
                placeholder="Phone number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Create a password"
                className={errors.password ? 'invalid' : ''}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />
              <button type="button" className="toggle-pw" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="field-error"><AlertCircle size={12} /> {errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label>Confirm Password</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                type={showCPw ? 'text' : 'password'}
                placeholder="Confirm your password"
                className={errors.confirmPassword ? 'invalid' : ''}
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                autoComplete="new-password"
              />
              <button type="button" className="toggle-pw" onClick={() => setShowCPw(!showCPw)}>
                {showCPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="field-error"><AlertCircle size={12} /> {errors.confirmPassword}</p>}
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading
              ? <><div className="spinner" /> Creating account…</>
              : <><UserPlus size={16} /> Create Secretary Account</>}
          </button>
        </form>
      </div>
    </div>
  )
}
