import { useNavigate } from 'react-router-dom'
import {
  Scale,
  ShieldCheck,
  FileText,
  Users,
  Calendar,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Star,
  Phone,
  Mail,
  MapPin,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

const NAV_LINKS = ['Features', 'About', 'Services', 'Testimonials', 'Contact']

const FEATURES = [
  {
    icon: <ShieldCheck size={24} />,
    cls: 'icon-gold',
    title: 'Role-Based Access',
    desc: 'Separate secure portals for Attorneys and Clients with JWT-protected routes.',
  },
  {
    icon: <FileText size={24} />,
    cls: 'icon-blue',
    title: 'Case Management',
    desc: 'Centralized case tracking, document filing, and status updates in one place.',
  },
  {
    icon: <Calendar size={24} />,
    cls: 'icon-green',
    title: 'Hearing Schedules',
    desc: 'Manage court hearings, client meetings, and critical legal deadlines effortlessly.',
  },
  {
    icon: <Users size={24} />,
    cls: 'icon-purple',
    title: 'Client Portal',
    desc: 'Clients get real-time visibility into their case progress and documents.',
  },
  {
    icon: <MessageSquare size={24} />,
    cls: 'icon-gold',
    title: 'Secure Messaging',
    desc: 'Encrypted communication channel between attorneys and their clients.',
  },
  {
    icon: <Scale size={24} />,
    cls: 'icon-blue',
    title: 'Legal Compliance',
    desc: 'Built with security best-practices: bcrypt, SQL injection prevention, and input validation.',
  },
]

const SERVICES = [
  { title: 'Civil Litigation',       desc: 'Expert representation in civil disputes, property matters, and contract issues.' },
  { title: 'Corporate Law',          desc: 'Business formation, mergers, acquisitions, and corporate governance.' },
  { title: 'Family Law',             desc: 'Compassionate guidance for family disputes, custody, and estate planning.' },
  { title: 'Criminal Defense',       desc: 'Aggressive and thorough defense strategies for criminal proceedings.' },
]

const TESTIMONIALS = [
  { name: 'Maria Santos',    role: 'Client',   text: 'The portal made it so easy to track my case. I always knew what was happening without having to call my attorney.' },
  { name: 'Atty. Jose Reyes', role: 'Attorney', text: 'Managing multiple clients and cases has never been smoother. The system saves me hours every week.' },
  { name: 'Ana Gonzales',    role: 'Client',   text: 'Secure, professional, and easy to use. I feel confident knowing my documents are safe.' },
]

export default function Landing() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  return (
    <div className="landing">

      {/* ── Navbar ──────────────────────────────────── */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <Scale size={22} className="nav-icon" />
            <span>MGC <strong>Law</strong></span>
          </div>

          <nav className={`landing-nav-links${menuOpen ? ' open' : ''}`}>
            {NAV_LINKS.map((l) => (
              <button key={l} onClick={() => scrollTo(l.toLowerCase())}>
                {l}
              </button>
            ))}
          </nav>

          <div className="landing-nav-cta">
            <button className="btn-outline" onClick={() => navigate('/login')}>Sign In</button>
            <button className="btn-hero-cta" onClick={() => navigate('/register')}>Get Started</button>
          </div>

          <button className="landing-hamburger" onClick={() => setMenuOpen((v) => !v)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-hero-bg" />
        <div className="landing-hero-content">
          <span className="hero-badge"><ShieldCheck size={13} /> Trusted Legal Management Platform</span>
          <h1>
            Modern Legal Solutions<br />
            <span className="hero-accent">For Attorneys & Clients</span>
          </h1>
          <p>
            MGC Law System streamlines case management, client communication, and
            document handling — all secured with enterprise-grade authentication.
          </p>
          <div className="hero-actions">
            <button className="btn-hero-cta large" onClick={() => navigate('/register')}>
              Create Free Account <ArrowRight size={18} />
            </button>
            <button className="btn-outline large" onClick={() => navigate('/login')}>
              Sign In
            </button>
          </div>
          <div className="hero-trust">
            {['Role-Based Access', 'JWT Secured', 'bcrypt Encrypted'].map((t) => (
              <span key={t}><CheckCircle2 size={13} /> {t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────── */}
      <section className="landing-section" id="features">
        <div className="landing-container">
          <div className="section-label">Features</div>
          <h2>Everything your legal team needs</h2>
          <p className="section-sub">
            A complete platform built specifically for the Philippine legal industry.
          </p>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.title}>
                <div className={`dash-card-icon ${f.cls}`}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ───────────────────────────────────── */}
      <section className="landing-section alt-bg" id="about">
        <div className="landing-container two-col">
          <div className="about-text">
            <div className="section-label">About MGC</div>
            <h2>Justice, delivered digitally.</h2>
            <p>
              MGC Law System is a purpose-built platform that bridges the gap between
              attorneys and their clients. We digitize the entire case lifecycle — from
              onboarding to resolution — with a secure, transparent, and intuitive interface.
            </p>
            <ul className="about-list">
              {[
                'Separate, secured portals per role',
                'Real-time case status tracking',
                'Encrypted document management',
                'Audit trail and activity logs',
              ].map((item) => (
                <li key={item}><CheckCircle2 size={15} /> {item}</li>
              ))}
            </ul>
            <button className="btn-hero-cta" onClick={() => navigate('/register')}>
              Get Started <ArrowRight size={16} />
            </button>
          </div>
          <div className="about-visual">
            <div className="about-card-stack">
              <div className="about-stat-card">
                <span className="stat-number">100%</span>
                <span className="stat-label">Secure Authentication</span>
              </div>
              <div className="about-stat-card accent">
                <span className="stat-number">2</span>
                <span className="stat-label">Dedicated Role Portals</span>
              </div>
              <div className="about-stat-card">
                <span className="stat-number">24/7</span>
                <span className="stat-label">Platform Availability</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Services ────────────────────────────────── */}
      <section className="landing-section" id="services">
        <div className="landing-container">
          <div className="section-label">Services</div>
          <h2>Areas of Legal Practice</h2>
          <p className="section-sub">Our platform supports attorneys across a wide range of practice areas.</p>
          <div className="services-grid">
            {SERVICES.map((s, i) => (
              <div className="service-card" key={s.title}>
                <div className="service-number">0{i + 1}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────── */}
      <section className="landing-section alt-bg" id="testimonials">
        <div className="landing-container">
          <div className="section-label">Testimonials</div>
          <h2>Trusted by attorneys and clients</h2>
          <div className="testimonials-grid">
            {TESTIMONIALS.map((t) => (
              <div className="testimonial-card" key={t.name}>
                <div className="testimonial-stars">
                  {Array(5).fill(0).map((_, i) => <Star key={i} size={13} fill="currentColor" />)}
                </div>
                <p>"{t.text}"</p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">
                    {t.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <strong>{t.name}</strong>
                    <span>{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────── */}
      <section className="cta-banner">
        <div className="landing-container cta-inner">
          <h2>Ready to modernize your legal practice?</h2>
          <p>Join MGC Law System — register today and experience the difference.</p>
          <div className="hero-actions">
            <button className="btn-hero-cta large" onClick={() => navigate('/register')}>
              Create Free Account <ArrowRight size={18} />
            </button>
            <button className="btn-outline large" onClick={() => navigate('/login')}>
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* ── Contact ─────────────────────────────────── */}
      <section className="landing-section" id="contact">
        <div className="landing-container">
          <div className="section-label">Contact</div>
          <h2>Get in Touch</h2>
          <p className="section-sub">Have questions? Reach out to the MGC Law team.</p>
          <div className="contact-grid">
            <div className="contact-info">
              <div className="contact-item">
                <div className="dash-card-icon icon-gold"><Phone size={18} /></div>
                <div><label>Phone</label><span>+63 (2) 8123-4567</span></div>
              </div>
              <div className="contact-item">
                <div className="dash-card-icon icon-blue"><Mail size={18} /></div>
                <div><label>Email</label><span>info@mgclaw.ph</span></div>
              </div>
              <div className="contact-item">
                <div className="dash-card-icon icon-green"><MapPin size={18} /></div>
                <div><label>Address</label><span>BGC, Taguig City, Metro Manila</span></div>
              </div>
            </div>
            <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
              <input type="text"  placeholder="Your Name" />
              <input type="email" placeholder="Email Address" />
              <textarea rows={4}  placeholder="Your Message" />
              <button type="submit" className="btn-hero-cta">Send Message <ArrowRight size={16} /></button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-container footer-inner">
          <div className="landing-brand">
            <Scale size={20} className="nav-icon" />
            <span>MGC <strong>Law</strong> System</span>
          </div>
          <p>© {new Date().getFullYear()} MGC Law System. All rights reserved.</p>
          <div className="footer-links">
            <button onClick={() => navigate('/login')}>Login</button>
            <button onClick={() => navigate('/register')}>Register</button>
          </div>
        </div>
      </footer>

    </div>
  )
}
