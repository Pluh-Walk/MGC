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
