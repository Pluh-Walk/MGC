import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Briefcase, Users, FileText, Loader2 } from 'lucide-react'
import api from '../services/api'

interface SearchResult {
  cases: Array<{ id: number; title: string; status: string; docket_number: string | null }>
  users: Array<{ id: number; fullname: string; email: string; role: string }>
  documents: Array<{ id: number; original_name: string; case_id: number; case_title: string }>
  total: number
}

interface Props {
  /** When true, renders only the keyboard shortcut listener (no trigger button). */
  globalOnly?: boolean
}

export default function GlobalSearch({ globalOnly = false }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResults(null)
      setError('')
    }
  }, [open])

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.get<SearchResult>('/api/search', { params: { q } })
      setResults(res.data)
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(q), 350)
  }

  const go = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  // globalOnly mode: just install keyboard listener + render modal overlay
  if (globalOnly) {
    if (!open) return null
    return <SearchModal
      inputRef={inputRef} query={query} results={results}
      loading={loading} error={error}
      onClose={() => setOpen(false)} onChange={handleChange} go={go}
    />
  }

  return (
    <>
      <button
        className="icon-btn global-search-trigger"
        onClick={() => setOpen(true)}
        title="Search (Ctrl+K)"
      >
        <Search size={18} />
      </button>
      {open && (
        <SearchModal
          inputRef={inputRef} query={query} results={results}
          loading={loading} error={error}
          onClose={() => setOpen(false)} onChange={handleChange} go={go}
        />
      )}
    </>
  )
}

interface ModalProps {
  inputRef: React.RefObject<HTMLInputElement>
  query: string
  results: SearchResult | null
  loading: boolean
  error: string
  onClose: () => void
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  go: (path: string) => void
}

function SearchModal({ inputRef, query, results, loading, error, onClose, onChange, go }: ModalProps) {
  return (
    <div className="gs-overlay" onClick={onClose}>
      <div className="gs-modal" onClick={e => e.stopPropagation()}>
        <div className="gs-input-row">
          <Search size={18} className="gs-icon" />
          <input
            ref={inputRef}
            className="gs-input"
            placeholder="Search cases, people, documents…"
            value={query}
            onChange={onChange}
            autoComplete="off"
          />
          {loading && <Loader2 size={16} className="gs-spin" />}
          <button className="gs-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="gs-results">
          {error && <p className="gs-error">{error}</p>}

          {!results && !loading && query.length < 2 && (
            <p className="gs-hint">
              Type at least 2 characters&ensp;·&ensp;<kbd>Esc</kbd> to close
            </p>
          )}

          {results && results.total === 0 && (
            <p className="gs-hint">No results for <strong>"{query}"</strong></p>
          )}

          {results && results.cases.length > 0 && (
            <section className="gs-section">
              <h4 className="gs-section-title"><Briefcase size={13} /> Cases</h4>
              {results.cases.map(c => (
                <button key={c.id} className="gs-item" onClick={() => go(`/cases/${c.id}`)}>
                  <span className="gs-item-main">{c.title}</span>
                  <span className="gs-item-sub">
                    {c.docket_number && <>{c.docket_number} · </>}
                    <span className={`case-badge ${c.status}`}>{c.status}</span>
                  </span>
                </button>
              ))}
            </section>
          )}

          {results && results.users.length > 0 && (
            <section className="gs-section">
              <h4 className="gs-section-title"><Users size={13} /> People</h4>
              {results.users.map(u => (
                <button key={u.id} className="gs-item"
                  onClick={() => go(u.role === 'client' ? `/clients/${u.id}` : `/attorneys/${u.id}`)}>
                  <span className="gs-item-main">{u.fullname}</span>
                  <span className="gs-item-sub">{u.email} · {u.role}</span>
                </button>
              ))}
            </section>
          )}

          {results && results.documents.length > 0 && (
            <section className="gs-section">
              <h4 className="gs-section-title"><FileText size={13} /> Documents</h4>
              {results.documents.map(d => (
                <button key={d.id} className="gs-item" onClick={() => go(`/cases/${d.case_id}`)}>
                  <span className="gs-item-main">{d.original_name}</span>
                  <span className="gs-item-sub">in {d.case_title}</span>
                </button>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
