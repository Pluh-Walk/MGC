/**
 * TwoFactorSetup — self-contained 2FA management panel.
 * Shows 2FA status and handles setup/disable/backup-code flows.
 * Drop this inside any Security tab section.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck, ShieldOff, QrCode, KeyRound, Copy, Check, Loader2,
  AlertCircle, CheckCircle2, RefreshCw,
} from 'lucide-react'
import api from '../services/api'

interface BackupCodeRowProps {
  codes: string[]
  onCopy: () => void
  copied: boolean
}

function BackupCodeDisplay({ codes, onCopy, copied }: BackupCodeRowProps) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <p style={{ fontSize: '0.85rem', color: '#e53e3e', fontWeight: 600, marginBottom: '0.5rem' }}>
        ⚠️ Save these 8 backup codes now — they won't be shown again.
      </p>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem',
        background: '#1a202c', borderRadius: '8px', padding: '0.75rem',
        fontFamily: 'monospace', fontSize: '0.85rem',
      }}>
        {codes.map((c) => (
          <span key={c} style={{ color: '#68d391', letterSpacing: '0.15em' }}>{c}</span>
        ))}
      </div>
      <button
        style={{
          marginTop: '0.6rem', display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: copied ? '#276749' : '#2b6cb0', color: '#fff', border: 'none',
          borderRadius: '6px', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.8rem',
        }}
        onClick={onCopy}
      >
        {copied ? <><Check size={13}/> Copied!</> : <><Copy size={13}/> Copy all codes</>}
      </button>
    </div>
  )
}

interface Props {
  role: string
}

type Phase =
  | 'idle'        // status loaded, 2FA off
  | 'enabled'     // 2FA on — show disable form
  | 'setup_qr'    // QR shown, waiting for confirm OTP
  | 'setup_done'  // just enabled — show backup codes

export default function TwoFactorSetup({ role }: Props) {
  const [phase,            setPhase]            = useState<Phase>('idle')
  const [loading,          setLoading]          = useState(true)
  const [backupRemaining,  setBackupRemaining]  = useState(0)
  const [qrDataUrl,        setQrDataUrl]        = useState('')
  const [manualKey,        setManualKey]        = useState('')
  const [confirmOtp,       setConfirmOtp]       = useState('')
  const [disablePassword,  setDisablePassword]  = useState('')
  const [disableOtp,       setDisableOtp]       = useState('')
  const [regenOtp,         setRegenOtp]         = useState('')
  const [newBackupCodes,   setNewBackupCodes]   = useState<string[]>([])
  const [copied,           setCopied]           = useState(false)
  const [msg,              setMsg]              = useState<{ text: string; ok: boolean } | null>(null)
  const [busy,             setBusy]             = useState(false)
  const [showRegen,        setShowRegen]        = useState(false)

  // Only attorneys and admins can set up 2FA
  const allowed = ['attorney', 'admin'].includes(role)

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/2fa/status')
      if (data.enabled) {
        setPhase('enabled')
        setBackupRemaining(data.backupCodesRemaining)
      } else {
        setPhase('idle')
      }
    } catch {
      setPhase('idle')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (allowed) loadStatus() }, [allowed, loadStatus])

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 5000)
  }

  const handleStartSetup = async () => {
    setBusy(true)
    try {
      const { data } = await api.post('/2fa/setup')
      setQrDataUrl(data.qrCode)
      setManualKey(data.manualKey)
      setPhase('setup_qr')
    } catch (e: any) {
      flash(e.response?.data?.message || 'Error starting setup.', false)
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmSetup = async () => {
    if (!/^\d{6}$/.test(confirmOtp)) {
      flash('Enter a 6-digit OTP from your authenticator app.', false)
      return
    }
    setBusy(true)
    try {
      const { data } = await api.post('/2fa/confirm-setup', { otp: confirmOtp })
      setNewBackupCodes(data.backupCodes)
      setPhase('setup_done')
      flash('2FA enabled successfully!', true)
    } catch (e: any) {
      flash(e.response?.data?.message || 'Invalid OTP.', false)
    } finally {
      setBusy(false)
    }
  }

  const handleDisable = async () => {
    if (!disablePassword || !/^\d{6}$/.test(disableOtp)) {
      flash('Enter your password and a valid 6-digit OTP.', false)
      return
    }
    setBusy(true)
    try {
      await api.post('/2fa/disable', { password: disablePassword, otp: disableOtp })
      flash('2FA has been disabled.', true)
      setDisablePassword('')
      setDisableOtp('')
      await loadStatus()
    } catch (e: any) {
      flash(e.response?.data?.message || 'Could not disable 2FA.', false)
    } finally {
      setBusy(false)
    }
  }

  const handleRegenBackup = async () => {
    if (!/^\d{6}$/.test(regenOtp)) {
      flash('Enter your 6-digit OTP to regenerate backup codes.', false)
      return
    }
    setBusy(true)
    try {
      const { data } = await api.post('/2fa/regenerate-backup-codes', { otp: regenOtp })
      setNewBackupCodes(data.backupCodes)
      setRegenOtp('')
      setShowRegen(false)
      flash('New backup codes generated.', true)
      await loadStatus()
    } catch (e: any) {
      flash(e.response?.data?.message || 'Could not regenerate codes.', false)
    } finally {
      setBusy(false)
    }
  }

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(newBackupCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const finishSetup = async () => {
    setNewBackupCodes([])
    setConfirmOtp('')
    await loadStatus()
  }

  if (!allowed) {
    return (
      <div style={{ padding: '0.75rem', background: '#fffbeb', borderRadius: '8px', fontSize: '0.85rem', color: '#92400e' }}>
        <AlertCircle size={14} style={{ marginRight: '6px' }} />
        2FA is available for attorneys and administrators only.
      </div>
    )
  }

  if (loading) {
    return <div style={{ color: '#718096', fontSize: '0.85rem' }}><Loader2 size={14} className="spin" /> Loading 2FA status…</div>
  }

  return (
    <div>
      {msg && (
        <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: '0.75rem' }}>
          {msg.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {msg.text}
        </div>
      )}

      {/* ── IDLE: 2FA not yet enabled ── */}
      {phase === 'idle' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
            <ShieldOff size={18} color="#e53e3e" />
            <span style={{ fontWeight: 600, color: '#e53e3e' }}>2FA is not enabled</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#4a5568', marginBottom: '1rem' }}>
            Enable Two-Factor Authentication to add an extra layer of security to your login.
            You'll need an authenticator app like <strong>Google Authenticator</strong> or <strong>Authy</strong>.
          </p>
          <button className="btn-primary" onClick={handleStartSetup} disabled={busy}>
            {busy ? <><Loader2 size={14} className="spin" /> Starting…</> : <><QrCode size={14} /> Enable 2FA</>}
          </button>
        </div>
      )}

      {/* ── SETUP QR: scan with authenticator ── */}
      {phase === 'setup_qr' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
            <QrCode size={18} color="#2b6cb0" />
            <span style={{ fontWeight: 600 }}>Scan with your authenticator app</span>
          </div>
          {qrDataUrl && (
            <img src={qrDataUrl} alt="2FA QR Code" style={{ width: 180, height: 180, borderRadius: '8px', border: '2px solid #e2e8f0' }} />
          )}
          <p style={{ fontSize: '0.8rem', color: '#718096', margin: '0.5rem 0' }}>
            Can't scan? Enter this key manually:
          </p>
          <code style={{ background: '#edf2f7', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
            {manualKey}
          </code>
          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
              <KeyRound size={13} style={{ marginRight: '5px' }} /> Enter the 6-digit code from your app
            </label>
            <input
              className="profile-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={confirmOtp}
              onChange={(e) => setConfirmOtp(e.target.value.replace(/\D/g, ''))}
              style={{ maxWidth: '160px', letterSpacing: '0.2em', textAlign: 'center' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button className="btn-primary" onClick={handleConfirmSetup} disabled={busy}>
              {busy ? <><Loader2 size={14} className="spin" /> Verifying…</> : <><Check size={14} /> Confirm &amp; Enable</>}
            </button>
            <button
              style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.9rem', cursor: 'pointer', fontSize: '0.85rem' }}
              onClick={() => { setPhase('idle'); setConfirmOtp('') }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── SETUP DONE: show backup codes ── */}
      {phase === 'setup_done' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
            <CheckCircle2 size={18} color="#22c55e" />
            <span style={{ fontWeight: 600, color: '#22c55e' }}>2FA is now enabled!</span>
          </div>
          <BackupCodeDisplay codes={newBackupCodes} onCopy={copyBackupCodes} copied={copied} />
          <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={finishSetup}>
            <Check size={14} /> I've saved my backup codes
          </button>
        </div>
      )}

      {/* ── ENABLED: manage 2FA ── */}
      {phase === 'enabled' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
            <ShieldCheck size={18} color="#22c55e" />
            <span style={{ fontWeight: 600, color: '#22c55e' }}>2FA is enabled</span>
            <span style={{ fontSize: '0.78rem', color: '#718096', marginLeft: '4px' }}>
              ({backupRemaining} backup code{backupRemaining !== 1 ? 's' : ''} remaining)
            </span>
          </div>

          {/* New backup codes from recent regen */}
          {newBackupCodes.length > 0 && (
            <BackupCodeDisplay codes={newBackupCodes} onCopy={copyBackupCodes} copied={copied} />
          )}

          {/* Regenerate backup codes */}
          {!showRegen ? (
            <button
              style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '1rem' }}
              onClick={() => setShowRegen(true)}
            >
              <RefreshCw size={13} /> Regenerate backup codes
            </button>
          ) : (
            <div style={{ background: '#fffbeb', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#92400e', marginBottom: '0.5rem', fontWeight: 600 }}>
                This will invalidate all existing backup codes.
              </p>
              <input
                className="profile-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter OTP"
                value={regenOtp}
                onChange={(e) => setRegenOtp(e.target.value.replace(/\D/g, ''))}
                style={{ maxWidth: '140px', letterSpacing: '0.2em', textAlign: 'center', marginRight: '0.5rem' }}
              />
              <button className="btn-primary" onClick={handleRegenBackup} disabled={busy} style={{ marginRight: '0.4rem' }}>
                {busy ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />} Regenerate
              </button>
              <button
                style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.82rem' }}
                onClick={() => { setShowRegen(false); setRegenOtp('') }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Disable 2FA */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: '#e53e3e' }}>
              Disable 2FA
            </p>
            <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.75rem' }}>
              Enter your account password and the current OTP from your authenticator app.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                className="profile-input"
                type="password"
                placeholder="Current password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                style={{ maxWidth: '200px' }}
              />
              <input
                className="profile-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="OTP"
                value={disableOtp}
                onChange={(e) => setDisableOtp(e.target.value.replace(/\D/g, ''))}
                style={{ maxWidth: '120px', letterSpacing: '0.2em', textAlign: 'center' }}
              />
            </div>
            <button
              style={{ marginTop: '0.65rem', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.45rem 1rem', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={handleDisable}
              disabled={busy}
            >
              {busy ? <Loader2 size={13} className="spin" /> : <ShieldOff size={13} />} Disable 2FA
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
