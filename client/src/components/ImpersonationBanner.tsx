import { adminApi } from '../services/api'

export default function ImpersonationBanner() {
  const adminToken = localStorage.getItem('admin_token')
  const adminUser = localStorage.getItem('admin_user')
  const logId = localStorage.getItem('impersonation_log_id')
  const targetName = localStorage.getItem('impersonation_target_name')

  if (!adminToken || !adminUser) return null

  const handleEnd = async () => {
    try {
      if (logId) await adminApi.endImpersonation(Number(logId))
    } catch { /* best-effort */ }
    // Restore admin session
    localStorage.setItem('token', adminToken)
    localStorage.setItem('user', adminUser)
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    localStorage.removeItem('impersonation_log_id')
    localStorage.removeItem('impersonation_target_name')
    window.location.href = '/admin/users'
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#7c3aed', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '1rem', padding: '0.5rem 1rem',
      fontSize: '0.85rem', fontWeight: 600,
    }}>
      <span>👤 You are viewing as <strong>{targetName ?? 'another user'}</strong> (read-only mode)</span>
      <button
        onClick={handleEnd}
        style={{
          background: '#fff', color: '#7c3aed', border: 'none', borderRadius: 6,
          padding: '3px 12px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
        }}
      >
        Exit Impersonation
      </button>
    </div>
  )
}
