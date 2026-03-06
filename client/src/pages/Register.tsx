import { useState, FormEvent, useRef } from 'react'
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
  Upload,
  Loader2,
  ScanLine,
  BadgeCheck,
  RotateCcw,
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

type Step = 'form' | 'ibp-verify' | 'id-verify'

export default function Register() {
  const navigate = useNavigate()

  // ── Registration form state ───────────────────────────
  const [form, setForm] = useState<RegisterData>(EMPTY)
  const [showPw, setShowPw] = useState(false)
  const [showCPw, setShowCPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterData, string>>>({})

  // ── IBP verification state ────────────────────────────
  const [step, setStep] = useState<Step>('form')
  const [registeredUserId, setRegisteredUserId] = useState<number | null>(null)
  const [ibpFile, setIbpFile] = useState<File | null>(null)
  const [ibpPreview, setIbpPreview] = useState<string | null>(null)
  const [ibpLoading, setIbpLoading] = useState(false)
  const [ibpError, setIbpError] = useState('')
  const [ibpDone, setIbpDone] = useState(false)
  const ibpRef = useRef<HTMLInputElement>(null)

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
      const res = await authService.register(form)
      if (form.role === 'attorney') {
        setRegisteredUserId(res.data.userId)
        setStep('ibp-verify')
      } else {
        // Client — require government ID verification
        setRegisteredUserId(res.data.userId)
        setStep('id-verify')
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

  // ── IBP handlers ─────────────────────────────────────
  const handleIbpFile = (file: File) => {
    setIbpFile(file)
    setIbpError('')
    setIbpPreview(URL.createObjectURL(file))
  }

  const handleIbpInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleIbpFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleIbpFile(file)
  }

  const handleScan = async () => {
    if (!ibpFile || !registeredUserId) return
    setIbpLoading(true)
    setIbpError('')
    try {
      await authService.verifyIBP(registeredUserId, ibpFile)
      setIbpDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Verification failed. Please try again.'
      setIbpError(msg)
    } finally {
      setIbpLoading(false)
    }
  }

  // ── Client ID handlers ────────────────────────────────
  const [clientIdFile, setClientIdFile] = useState<File | null>(null)
  const [clientIdPreview, setClientIdPreview] = useState<string | null>(null)
  const [clientIdLoading, setClientIdLoading] = useState(false)
  const [clientIdError, setClientIdError] = useState('')
  const [clientIdDone, setClientIdDone] = useState(false)
  const clientIdRef = useRef<HTMLInputElement>(null)

  const handleClientIdFile = (file: File) => {
    setClientIdFile(file)
    setClientIdError('')
    setClientIdPreview(URL.createObjectURL(file))
  }

  const handleClientIdInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleClientIdFile(file)
    e.target.value = ''
  }

  const handleClientIdDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleClientIdFile(file)
  }

  const handleClientIdScan = async () => {
    if (!clientIdFile || !registeredUserId) return
    setClientIdLoading(true)
    setClientIdError('')
    try {
      await authService.verifyClientID(registeredUserId, clientIdFile)
      setClientIdDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Verification failed. Please try again.'
      setClientIdError(msg)
    } finally {
      setClientIdLoading(false)
    }
  }

  const field = (key: keyof RegisterData) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value }),
    className: fieldErrors[key] ? 'invalid' : '',
  })

  // ── IBP Verification Step ────────────────────────────
  if (step === 'ibp-verify') {
    return (
      <div className="auth-page">
        <div className="auth-card ibp-card">
          <div className="auth-logo">
            <div className="auth-logo-icon"><Scale size={26} /></div>
            <h1>MGC Law</h1>
            <p>Attorney Verification</p>
          </div>

          {ibpDone ? (
            <div className="ibp-success">
              <div className="ibp-success-icon"><CheckCircle2 size={52} /></div>
              <h3>Verification Successful!</h3>
              <p>Your IBP card has been verified. Redirecting to login…</p>
            </div>
          ) : (
            <>
              <div className="ibp-header">
                <BadgeCheck size={22} className="ibp-header-icon" />
                <div>
                  <h2>IBP Card Verification</h2>
                  <p className="subtitle">Upload a clear photo of your Integrated Bar of the Philippines (IBP) card. The system will scan it automatically.</p>
                </div>
              </div>

              {ibpError && (
                <div className="alert alert-error">
                  <AlertCircle size={16} /> {ibpError}
                </div>
              )}

              {/* Drop zone */}
              <div
                className={`ibp-dropzone${ibpPreview ? ' has-preview' : ''}`}
                onClick={() => ibpRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && ibpRef.current?.click()}
              >
                <input
                  ref={ibpRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleIbpInput}
                />
                {ibpPreview ? (
                  <img src={ibpPreview} alt="IBP card preview" className="ibp-preview-img" />
                ) : (
                  <div className="ibp-dropzone-placeholder">
                    <Upload size={32} className="ibp-upload-icon" />
                    <span>Click or drag & drop your IBP card here</span>
                    <small>JPEG, PNG, or WebP · Max 10 MB</small>
                  </div>
                )}
              </div>

              {ibpPreview && !ibpDone && (
                <button
                  className="ibp-retake"
                  onClick={() => { setIbpFile(null); setIbpPreview(null); setIbpError('') }}
                >
                  <RotateCcw size={13} /> Use a different image
                </button>
              )}

              <button
                className="btn-primary ibp-scan-btn"
                onClick={handleScan}
                disabled={!ibpFile || ibpLoading}
              >
                {ibpLoading ? (
                  <><Loader2 size={16} className="spin" /> Scanning card…</>
                ) : (
                  <><ScanLine size={16} /> Scan & Verify</>
                )}
              </button>
            </>
          )}

          {!ibpDone && (
            <div className="auth-footer">
              Already have an account?
              <Link to="/login">Sign in</Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Client ID Verification Step ─────────────────────
  if (step === 'id-verify') {
    return (
      <div className="auth-page">
        <div className="auth-card ibp-card">
          <div className="auth-logo">
            <div className="auth-logo-icon"><Scale size={26} /></div>
            <h1>MGC Law</h1>
            <p>Client Verification</p>
          </div>

          {clientIdDone ? (
            <div className="ibp-success">
              <div className="ibp-success-icon"><CheckCircle2 size={52} /></div>
              <h3>Verification Successful!</h3>
              <p>Your ID has been verified. Redirecting to login…</p>
            </div>
          ) : (
            <>
              <div className="ibp-header">
                <BadgeCheck size={22} className="ibp-header-icon" />
                <div>
                  <h2>Government ID Verification</h2>
                  <p className="subtitle">Upload a clear photo of a valid government-issued ID (e.g. PhilSys, Driver's License, Passport, UMID, Voter's ID). The system will scan it automatically.</p>
                </div>
              </div>

              {clientIdError && (
                <div className="alert alert-error">
                  <AlertCircle size={16} /> {clientIdError}
                </div>
              )}

              {/* Drop zone */}
              <div
                className={`ibp-dropzone${clientIdPreview ? ' has-preview' : ''}`}
                onClick={() => clientIdRef.current?.click()}
                onDrop={handleClientIdDrop}
                onDragOver={e => e.preventDefault()}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && clientIdRef.current?.click()}
              >
                <input
                  ref={clientIdRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleClientIdInput}
                />
                {clientIdPreview ? (
                  <img src={clientIdPreview} alt="ID preview" className="ibp-preview-img" />
                ) : (
                  <div className="ibp-dropzone-placeholder">
                    <Upload size={32} className="ibp-upload-icon" />
                    <span>Click or drag & drop your ID here</span>
                    <small>JPEG, PNG, or WebP · Max 10 MB</small>
                  </div>
                )}
              </div>

              {clientIdPreview && !clientIdDone && (
                <button
                  className="ibp-retake"
                  onClick={() => { setClientIdFile(null); setClientIdPreview(null); setClientIdError('') }}
                >
                  <RotateCcw size={13} /> Use a different image
                </button>
              )}

              <button
                className="btn-primary ibp-scan-btn"
                onClick={handleClientIdScan}
                disabled={!clientIdFile || clientIdLoading}
              >
                {clientIdLoading ? (
                  <><Loader2 size={16} className="spin" /> Scanning ID…</>
                ) : (
                  <><ScanLine size={16} /> Scan & Verify</>
                )}
              </button>
            </>
          )}

          {!clientIdDone && (
            <div className="auth-footer">
              Already have an account?
              <Link to="/login">Sign in</Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Registration Form Step ───────────────────────────
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

          {form.role === 'attorney' && (
            <div className="ibp-notice">
              <BadgeCheck size={15} />
              <span>Attorney accounts require IBP card verification after registration.</span>
            </div>
          )}

          {form.role === 'client' && (
            <div className="ibp-notice">
              <BadgeCheck size={15} />
              <span>Client accounts require a valid government-issued ID for verification after registration.</span>
            </div>
          )}

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
