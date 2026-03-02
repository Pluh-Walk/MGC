import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Scale,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react'
import { authService, RegisterData } from '../services/authService'

const EMPTY: RegisterData = {
  fullname: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'client',
}

export default function Register() {
  const navigate = useNavigate()

  const [form, setForm] = useState<RegisterData>(EMPTY)
  const [showPw, setShowPw] = useState(false)
  const [showCPw, setShowCPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterData, string>>>({})

  const validate = (): boolean => {
    const e: Partial<Record<keyof RegisterData, string>> = {}

    if (!form.fullname.trim())  e.fullname = 'Full name is required.'
    if (!form.username.trim())  e.username = 'Username is required.'

    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!form.email.trim())     e.email = 'Email is required.'
    else if (!emailRx.test(form.email)) e.email = 'Enter a valid email address.'

    if (!form.password)         e.password = 'Password is required.'
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters.'

    if (!form.confirmPassword)          e.confirmPassword = 'Please confirm your password.'
    else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.'

    if (!form.role)             e.role = 'Please select a role.'

    setFieldErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!validate()) return

    setLoading(true)
    try {
      await authService.register(form)
      setSuccess('Account created! Redirecting to login…')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Registration failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const field = (key: keyof RegisterData) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value }),
    className: fieldErrors[key] ? 'invalid' : '',
  })

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 500 }}>
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

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <h2>Create Account</h2>
          <p className="subtitle">Fill in the details to register</p>

          {/* Full Name */}
          <div className="form-group">
            <label>Full Name</label>
            <div className="input-wrapper">
              <User size={16} className="input-icon" />
              <input type="text" placeholder="e.g. Juan dela Cruz" {...field('fullname')} autoComplete="name" />
            </div>
            {fieldErrors.fullname && <p className="field-error"><AlertCircle size={12}/> {fieldErrors.fullname}</p>}
          </div>

          {/* Email */}
          <div className="form-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <Mail size={16} className="input-icon" />
              <input type="email" placeholder="you@example.com" {...field('email')} autoComplete="email" />
            </div>
            {fieldErrors.email && <p className="field-error"><AlertCircle size={12}/> {fieldErrors.email}</p>}
          </div>

          {/* Username */}
          <div className="form-group">
            <label>Username</label>
            <div className="input-wrapper">
              <User size={16} className="input-icon" />
              <input type="text" placeholder="Choose a username" {...field('username')} autoComplete="username" />
            </div>
            {fieldErrors.username && <p className="field-error"><AlertCircle size={12}/> {fieldErrors.username}</p>}
          </div>

          {/* Role */}
          <div className="form-group">
            <label>Role</label>
            <div className="input-wrapper">
              <ShieldCheck size={16} className="input-icon" />
              <select {...field('role')}>
                <option value="client">Client</option>
                <option value="attorney">Attorney</option>
              </select>
            </div>
            {fieldErrors.role && <p className="field-error"><AlertCircle size={12}/> {fieldErrors.role}</p>}
          </div>

          {/* Password */}
          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Minimum 8 characters"
                {...field('password')}
                autoComplete="new-password"
              />
              <button type="button" className="toggle-pw" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            {fieldErrors.password && <p className="field-error"><AlertCircle size={12}/> {fieldErrors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label>Confirm Password</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                type={showCPw ? 'text' : 'password'}
                placeholder="Re-enter your password"
                {...field('confirmPassword')}
                autoComplete="new-password"
              />
              <button type="button" className="toggle-pw" onClick={() => setShowCPw(!showCPw)}>
                {showCPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p className="field-error"><AlertCircle size={12}/> {fieldErrors.confirmPassword}</p>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading
              ? <><div className="spinner"/> Creating account…</>
              : <><UserPlus size={16}/> Register</>}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
