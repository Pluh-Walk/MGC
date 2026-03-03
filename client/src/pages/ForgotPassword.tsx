import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Scale, Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { passwordResetApi } from '../services/api'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})
type FormData = z.infer<typeof schema>

export default function ForgotPassword() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async ({ email }: FormData) => {
    setServerError('')
    try {
      await passwordResetApi.request(email)
      setSent(true)
    } catch {
      setServerError('Something went wrong. Please try again.')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Scale size={28} className="nav-icon" />
          <span>MGC Law System</span>
        </div>

        {sent ? (
          <div className="success-block">
            <CheckCircle size={48} style={{ color: '#22c55e', margin: '0 auto 1rem' }} />
            <h2>Check your email</h2>
            <p>If an account exists for that email, we've sent a password reset link. Check your inbox (and spam folder).</p>
            <Link to="/login" className="btn-primary" style={{ display: 'inline-block', marginTop: '1.5rem' }}>
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <h2>Forgot Password</h2>
            <p className="auth-subtitle">Enter your account email and we'll send you a reset link.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
              <div className="form-group">
                <label>Email Address</label>
                <div className="input-icon-wrap">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    {...register('email')}
                    placeholder="you@example.com"
                    className="input-with-icon"
                  />
                </div>
                {errors.email && <span className="field-error">{errors.email.message}</span>}
              </div>

              {serverError && <p className="form-error">{serverError}</p>}

              <button type="submit" className="btn-primary btn-full" disabled={isSubmitting}>
                {isSubmitting ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            <div className="auth-footer">
              <Link to="/login">
                <ArrowLeft size={14} style={{ marginRight: '0.3rem' }} />
                Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
