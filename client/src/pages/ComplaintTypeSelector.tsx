import { useNavigate } from 'react-router-dom'
import { Scale, AlertTriangle, ArrowLeft, FileText, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'

const CASE_TYPES = [
  {
    value: 'civil',
    label: 'Civil Case',
    Icon: Scale,
    description:
      'For disputes involving contracts, obligations, property, family matters, and other civil rights violations.',
    examples: [
      'Breach of contract',
      'Unpaid loans / collection of sum of money',
      'Property disputes',
      'Annulment / legal separation',
      'Ejectment / unlawful detainer',
    ],
    route: '/intake/new/civil',
  },
  {
    value: 'tort',
    label: 'Tort / Quasi-Delict',
    Icon: AlertTriangle,
    description:
      'For claims arising from negligence, fault, or a wrongful act that caused injury or damage to you.',
    examples: [
      'Vehicular accidents',
      'Medical negligence / malpractice',
      'Personal injury caused by another\'s fault',
      'Damage to property through negligence',
      'Defamation (libel / slander)',
    ],
    route: '/intake/new/tort',
  },
]

export default function ComplaintTypeSelector() {
  useAuth()
  const navigate = useNavigate()

  return (
    <div className="dashboard">
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className="role-badge client">Client</span>
          <NotificationBell />
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        <button className="btn-back" onClick={() => navigate('/dashboard/client')}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div style={{ marginTop: '1rem', maxWidth: 760, margin: '1rem auto 0' }}>
          {/* Header */}
          <div style={{
            background: 'var(--surface-solid)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '1.75rem 2rem', marginBottom: '1.75rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <FileText size={22} color="var(--accent)" />
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)' }}>
                File a Complaint
              </h1>
            </div>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '0.9rem' }}>
              Select the type of case that best describes your complaint. You will be shown the appropriate
              intake form based on your selection. If you are unsure, please consult an attorney first.
            </p>
          </div>

          {/* Case type cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            {CASE_TYPES.map(({ value, label, Icon, description, examples, route }) => (
              <button
                key={value}
                onClick={() => navigate(route)}
                style={{
                  background: 'var(--surface-solid)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '2rem 1.75rem',
                  textAlign: 'left', cursor: 'pointer',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  display: 'flex', flexDirection: 'column', gap: '1rem',
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px var(--accent)'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 48, height: 48, borderRadius: 'var(--radius-sm)',
                  background: 'rgba(201,168,76,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={24} color="var(--accent)" />
                </div>

                {/* Title + description */}
                <div>
                  <p style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)', marginBottom: '0.4rem' }}>
                    {label}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    {description}
                  </p>
                </div>

                {/* Examples */}
                <div>
                  <p style={{
                    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.45rem',
                  }}>
                    Examples
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {examples.map(ex => (
                      <li key={ex} style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{ex}</li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <div style={{
                  marginTop: 'auto', paddingTop: '0.5rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  gap: '0.25rem', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600,
                }}>
                  Select this type <ChevronRight size={16} />
                </div>
              </button>
            ))}
          </div>

          <p style={{
            textAlign: 'center', fontSize: '0.82rem',
            color: 'var(--text-muted)', marginTop: '1.5rem',
          }}>
            Other case types (criminal, labor, administrative) require direct attorney engagement
            due to different pre-filing procedures.
          </p>
        </div>
      </main>
    </div>
  )
}
