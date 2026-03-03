import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Scale, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { passwordResetApi } from '../services/api'

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const [done, setDone] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async ({ password, confirmPassword }: FormData) => {
    setServerError('')
    try {
      await passwordResetApi.reset(token, password, confirmPassword)
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: any) {
      setServerError(err.response?.data?.message || 'Reset failed. The link may have expired.')
    }
  }

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <Scale size={28} className="nav-icon" />
            <span>MGC Law System</span>
          </div>
          <div className="success-block" style={{ textAlign: 'center' }}>
            <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem' }} />
            <h2>Invalid Link</h2>
            <p>This reset link is missing a token. Please request a new one.</p>
            <Link to="/forgot-password" className="btn-primary" style={{ display: 'inline-block', marginTop: '1.5rem' }}>
              Request New Link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Scale size={28} className="nav-icon" />
          <span>MGC Law System</span>
        </div>

        {done ? (
          <div className="success-block" style={{ textAlign: 'center' }}>
            <CheckCircle size={48} style={{ color: '#22c55e', margin: '0 auto 1rem' }} />
            <h2>Password Reset!</h2>
            <p>Your password has been updated. Redirecting you to login…</p>
          </div>
        ) : (
          <>
            <h2>Set New Password</h2>
            <p className="auth-subtitle">Choose a strong password for your account.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
              <div className="form-group">
                <label>New Password</label>
                <div className="input-icon-wrap">
                  <Lock size={16} className="input-icon" />
                  <input
                    type="password"
                    {...register('password')}
                    placeholder="Min. 8 characters"
                    className="input-with-icon"
                  />
                </div>
                {errors.password && <span className="field-error">{errors.password.message}</span>}
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <div className="input-icon-wrap">
                  <Lock size={16} className="input-icon" />
                  <input
                    type="password"
                    {...register('confirmPassword')}
                    placeholder="Repeat password"
                    className="input-with-icon"
                  />
                </div>
                {errors.confirmPassword && (
                  <span className="field-error">{errors.confirmPassword.message}</span>
                )}
              </div>

              {serverError && <p className="form-error">{serverError}</p>}

              <button type="submit" className="btn-primary btn-full" disabled={isSubmitting}>
                {isSubmitting ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
