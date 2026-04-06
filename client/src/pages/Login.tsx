import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Scale,
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
} from 'lucide-react'
import { authService } from '../services/authService'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { setUser } = useAuth()

  const [form, setForm] = useState({ identifier: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 2FA challenge state
  const [challengeToken, setChallengeToken] = useState('')
  const [totpInput,      setTotpInput]      = useState('')
  const [totpError,      setTotpError]      = useState('')
  const [totpLoading,    setTotpLoading]    = useState(false)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.identifier.trim()) e.identifier = 'Username or email is required.'
    if (!form.password)          e.password   = 'Password is required.'
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
      const res = await authService.login({
        identifier: form.identifier.trim(),
        password: form.password,
      })

      // 2FA gate: server requires OTP before issuing real session
      if (res.data.totp_required) {
        setChallengeToken(res.data.challenge_token)
        setLoading(false)
        return
      }

      const user = res.data.user
      setUser(user)

      if (remember) {
        localStorage.setItem('rememberMe', form.identifier)
      } else {
        localStorage.removeItem('rememberMe')
      }

      setSuccess('Login successful! Redirecting…')
      const dashboards: Record<string, string> = {
        attorney:  '/dashboard/attorney',
        client:    '/dashboard/client',
        admin:     '/dashboard/admin',
        secretary: '/dashboard/secretary',
      }
      setTimeout(() => {
        navigate(dashboards[user.role] || '/dashboard/client')
      }, 800)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Login failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyTotp = async (e: FormEvent) => {
    e.preventDefault()
    setTotpError('')
    const isDigit6  = /^\d{6}$/.test(totpInput)
    const isBackup  = /^[0-9A-Fa-f]{8}$/.test(totpInput)
    if (!isDigit6 && !isBackup) {
      setTotpError('Enter your 6-digit OTP or 8-character backup code.')
      return
    }
    setTotpLoading(true)
    try {
      const res = await authService.verify2FA(challengeToken, totpInput)
      const user = res.data.user
      setUser(user)
      if (remember) localStorage.setItem('rememberMe', form.identifier)
      else         localStorage.removeItem('rememberMe')
      setSuccess('Login successful! Redirecting…')
      const dashboards: Record<string, string> = {
        attorney:  '/dashboard/attorney',
        client:    '/dashboard/client',
        admin:     '/dashboard/admin',
        secretary: '/dashboard/secretary',
      }
      setTimeout(() => navigate(dashboards[user.role] || '/dashboard/client'), 800)
    } catch (err: unknown) {
      setTotpError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Invalid code. Please try again.'
      )
    } finally {
      setTotpLoading(false)
    }
  }

  // ── 2FA challenge screen ──────────────────────────────────────────────
  if (challengeToken) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon"><Scale size={26}/></div>
            <h1>MGC Law</h1>
            <p>Two-Factor Verification</p>
          </div>

          {success && <div className="alert alert-success"><CheckCircle2 size={16}/> {success}</div>}

          <form className="auth-form" onSubmit={handleVerifyTotp} noValidate>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <ShieldCheck size={40} color="#2b6cb0" style={{ marginBottom: '0.5rem' }}/>
              <h2 style={{ marginBottom: '0.25rem' }}>Authentication Required</h2>
              <p className="subtitle">Enter the 6-digit code from your authenticator app, or a backup code.</p>
            </div>

            {totpError && <div className="alert alert-error"><AlertCircle size={14}/> {totpError}</div>}

            <div className="form-group">
              <label>One-Time Password</label>
              <div className="input-wrapper">
                <KeyRound size={16} className="input-icon"/>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000000 or backup code"
                  maxLength={8}
                  value={totpInput}
                  onChange={(e) => setTotpInput(e.target.value.replace(/\s/g, ''))}
                  autoFocus
                  autoComplete="one-time-code"
                  style={{ letterSpacing: '0.2em', textAlign: 'center' }}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={totpLoading}>
              {totpLoading
                ? <><div className="spinner"/> Verifying…</>
                : <><ShieldCheck size={16}/> Verify</>}
            </button>

            <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}
                onClick={() => { setChallengeToken(''); setTotpInput(''); setTotpError('') }}
              >
                &larr; Back to login
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Scale size={26} />
          </div>
          <h1>MGC Law</h1>
          <p>Legal Management System</p>
        </div>

        {/* Alerts */}
        {error   && <div className="alert alert-error">  <AlertCircle  size={16}/> {error}   </div>}
        {success && <div className="alert alert-success"><CheckCircle2 size={16}/> {success} </div>}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <h2>Welcome back</h2>
          <p className="subtitle">Sign in to your account to continue</p>

          {/* Identifier */}
          <div className="form-group">
            <label>Username or Email</label>
            <div className="input-wrapper">
              <User size={16} className="input-icon" />
              <input
                type="text"
                placeholder="Enter username or email"
                className={errors.identifier ? 'invalid' : ''}
                value={form.identifier}
                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                autoComplete="username"
              />
            </div>
            {errors.identifier && <p className="field-error"><AlertCircle size={12}/> {errors.identifier}</p>}
          </div>

          {/* Password */}
          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Enter your password"
                className={errors.password ? 'invalid' : ''}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
              />
              <button type="button" className="toggle-pw" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            {errors.password && <p className="field-error"><AlertCircle size={12}/> {errors.password}</p>}
          </div>

          {/* Remember Me */}
          <div className="form-extras">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me
            </label>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <><div className="spinner"/> Signing in…</> : <><LogIn size={16}/> Sign In</>}
          </button>

          <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
            <Link to="/forgot-password" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Forgot your password?
            </Link>
          </div>
        </form>

        <div className="auth-footer">
          Don't have an account?
          <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  )
}
