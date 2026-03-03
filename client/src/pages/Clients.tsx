import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scale, ArrowLeft, Users, Search, ChevronRight } from 'lucide-react'
import SettingsDropdown from '../components/SettingsDropdown'
import { casesApi } from '../services/api'

interface Client {
  id: number
  fullname: string
  username: string
  email: string
  phone: string | null
  assigned_attorney_id: number | null
}

export default function Clients() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [filtered, setFiltered] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    casesApi.clientList()
      .then((res) => {
        setClients(res.data.data)
        setFiltered(res.data.data)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      clients.filter(
        (c) =>
          c.fullname.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.username.toLowerCase().includes(q)
      )
    )
  }, [search, clients])

  return (
    <div className="dashboard">
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className="role-badge attorney">Attorney</span>
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        <button className="btn-back" onClick={() => navigate('/dashboard/attorney')}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <div className="page-header-row">
          <div>
            <h2>Clients</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {filtered.length} registered client{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="filter-row">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              placeholder="Search by name, email or username…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading clients…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Users size={48} className="empty-icon" />
            <p>No clients found.</p>
          </div>
        ) : (
          <div className="cases-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="table-row-link"
                    onClick={() => navigate(`/clients/${c.id}`)}
                  >
                    <td><strong>{c.fullname}</strong></td>
                    <td>@{c.username}</td>
                    <td>{c.email}</td>
                    <td>{c.phone || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
