import { useState, useEffect } from 'react'
import { WrenchIcon } from 'lucide-react'

export default function MaintenanceBanner() {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('The system is currently undergoing maintenance. Please try again shortly.')

  useEffect(() => {
    const handler = (e: Event) => {
      const { detail } = e as CustomEvent
      setMessage(detail.message || message)
      setVisible(true)
    }
    window.addEventListener('maintenance-mode', handler)
    return () => window.removeEventListener('maintenance-mode', handler)
  }, [])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#f59e0b', color: '#1c1917',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '10px', padding: '12px 24px',
      fontWeight: 600, fontSize: '0.9rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      <WrenchIcon size={18} />
      {message}
      <button
        onClick={() => setVisible(false)}
        style={{ marginLeft: '1rem', background: 'transparent', border: '1px solid rgba(0,0,0,0.3)', borderRadius: '4px', padding: '2px 10px', cursor: 'pointer', fontWeight: 600 }}
      >
        Dismiss
      </button>
    </div>
  )
}
