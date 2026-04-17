import { useNavigate } from 'react-router-dom'
import { Scale, AlertTriangle, ArrowLeft, FileText, ChevronRight, FileSignature, Home, Users, Briefcase, BookOpen, Info } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import NotificationBell from '../components/NotificationBell'

// ── Section 1: Standard self-service (barangay cert required) ──────
const STANDARD_TYPES = [
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
  {
    value: 'contract',
    label: 'Contract Dispute',
    Icon: FileSignature,
    description:
      'For disputes arising from a contract or agreement that was breached, not performed, or entered into through fraud.',
    examples: [
      'Breach of contract',
      'Non-payment / collection under contract',
      'Rescission or cancellation of agreement',
      'Loan agreement / promissory note',
      'Lease or rental agreement dispute',
    ],
    route: '/intake/new/contract',
  },
  {
    value: 'property',
    label: 'Property Dispute',
    Icon: Home,
    description:
      'For disputes involving real property — ownership, possession, boundaries, ejectment, or co-ownership.',
    examples: [
      'Ejectment / unlawful detainer',
      'Forcible entry',
      'Quieting of title',
      'Recovery of possession',
      'Boundary or encroachment dispute',
    ],
    route: '/intake/new/property',
  },
]

// ── Section 2: Alternative pre-filing flow (no barangay cert) ─────
const ALT_FLOW_TYPES = [
  {
    value: 'family',
    label: 'Family Law',
    Icon: Users,
    description:
      'For family matters — annulment, legal separation, custody, support, adoption, and VAWC. No barangay certificate needed; Family Court requires court-annexed mediation instead.',
    examples: [
      'Annulment / declaration of nullity',
      'Child custody',
      'Support (child / spouse)',
      'VAWC / domestic violence (RA 9262)',
      'Adoption',
    ],
    route: '/intake/new/family',
    badge: 'Court-annexed mediation',
  },
  {
    value: 'labor',
    label: 'Labor / Employment',
    Icon: Briefcase,
    description:
      'For employment disputes — illegal dismissal, unpaid wages, and benefits claims. No barangay certificate needed; SEnA (Single Entry Approach) at DOLE/NLRC is required first.',
    examples: [
      'Illegal / constructive dismissal',
      'Unpaid wages / 13th month pay',
      'Overtime / holiday pay',
      'Separation pay',
      'OFW / POEA dispute',
    ],
    route: '/intake/new/labor',
    badge: 'SEnA at DOLE/NLRC required',
  },
  {
    value: 'probate',
    label: 'Probate / Estate',
    Icon: BookOpen,
    description:
      'For estate settlement — testate or intestate, probate of will, letters of administration, and partition among heirs. No barangay certificate or pre-filing conciliation needed.',
    examples: [
      'Intestate estate settlement (no will)',
      'Probate of will',
      'Letters of administration',
      'Extrajudicial settlement',
      'Partition among heirs',
    ],
    route: '/intake/new/probate',
    badge: 'Special proceedings — court publication',
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

          {/* ── Section 1: Standard flow (barangay cert required) ── */}
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                Standard Flow — Barangay Certificate Required
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              {STANDARD_TYPES.map(({ value, label, Icon, description, examples, route }) => (
                <button
                  key={value}
                  onClick={() => navigate(route)}
                  style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2rem 1.75rem', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s', display: 'flex', flexDirection: 'column', gap: '1rem' }}
                  onMouseEnter={e => { ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px var(--accent)' }}
                  onMouseLeave={e => { ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; ;(e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', background: 'rgba(201,168,76,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={24} color="var(--accent)" />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)', marginBottom: '0.4rem' }}>{label}</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{description}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.45rem' }}>Examples</p>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {examples.map(ex => <li key={ex} style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{ex}</li>)}
                    </ul>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600 }}>
                    Select this type <ChevronRight size={16} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Section 2: Alternative pre-filing flow ── */}
          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Info size={12} /> Different Pre-Filing Flow — No Barangay Certificate
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
              {ALT_FLOW_TYPES.map(({ value, label, Icon, description, examples, route, badge }) => (
                <button
                  key={value}
                  onClick={() => navigate(route)}
                  style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.75rem 1.5rem', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
                  onMouseEnter={e => { ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(59,130,246,0.6)'; ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px rgba(59,130,246,0.4)' }}
                  onMouseLeave={e => { ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; ;(e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                >
                  {/* Icon + badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={22} color="var(--info, #60a5fa)" />
                    </div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--info, #60a5fa)', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 20, padding: '0.2rem 0.55rem', lineHeight: 1.4, textAlign: 'center' }}>
                      {badge}
                    </span>
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text)', marginBottom: '0.35rem' }}>{label}</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>{description}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Examples</p>
                    <ul style={{ margin: 0, paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {examples.map(ex => <li key={ex} style={{ fontSize: '0.79rem', color: 'var(--text-muted)' }}>{ex}</li>)}
                    </ul>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem', color: 'var(--info, #60a5fa)', fontSize: '0.82rem', fontWeight: 600 }}>
                    Select this type <ChevronRight size={15} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '1.75rem' }}>
            Criminal, corporate, administrative, immigration, intellectual property, tax, and constitutional cases
            require direct attorney engagement and cannot be self-initiated through this portal.
          </p>
        </div>
      </main>
    </div>
  )
}
