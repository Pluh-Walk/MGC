import { useState, useEffect, useRef, useCallback } from 'react'
import { Timer, Square, Plus, Trash2, DollarSign, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { timeTrackingApi } from '../services/api'

interface TimeEntry {
  id: number
  description: string | null
  started_at: string
  ended_at: string | null
  duration_sec: number | null
  is_billable: boolean
  billing_id: number | null
}

interface Props {
  caseId: number
  onBillingCreated?: () => void
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TimeTracker({ caseId, onBillingCreated }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [description, setDescription] = useState('')
  const [isBillable, setIsBillable] = useState(true)
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [billRate, setBillRate] = useState('')
  const [billingEntryId, setBillingEntryId] = useState<number | null>(null)
  const [billing, setBilling] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await timeTrackingApi.list(caseId)
      const data: TimeEntry[] = res.data.data ?? []
      setEntries(data)
      // Find any running entry (no ended_at)
      const running = data.find(e => !e.ended_at)
      if (running) setActiveEntry(running)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [caseId])

  useEffect(() => { loadEntries() }, [loadEntries])

  // Tick timer for running entry
  useEffect(() => {
    if (activeEntry && !activeEntry.ended_at) {
      const base = Math.floor((Date.now() - new Date(activeEntry.started_at).getTime()) / 1000)
      setElapsed(base)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setElapsed(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [activeEntry])

  const handleStart = async () => {
    setStarting(true)
    try {
      const res = await timeTrackingApi.start(caseId, {
        description: description.trim() || undefined,
        is_billable: isBillable,
      })
      const entry: TimeEntry = res.data.data
      setActiveEntry(entry)
      setEntries(prev => [entry, ...prev])
      setDescription('')
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to start timer.')
    } finally { setStarting(false) }
  }

  const handleStop = async () => {
    if (!activeEntry) return
    setStopping(true)
    const endedAt = new Date().toISOString()
    try {
      await timeTrackingApi.stop(caseId, activeEntry.id, endedAt)
      const durationSec = Math.floor((Date.now() - new Date(activeEntry.started_at).getTime()) / 1000)
      setEntries(prev => prev.map(e =>
        e.id === activeEntry.id ? { ...e, ended_at: endedAt, duration_sec: durationSec } : e
      ))
      setActiveEntry(null)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to stop timer.')
    } finally { setStopping(false) }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this time entry?')) return
    try {
      await timeTrackingApi.delete_(caseId, id)
      setEntries(prev => prev.filter(e => e.id !== id))
      if (activeEntry?.id === id) setActiveEntry(null)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete.')
    }
  }

  const handleBill = async (entryId: number) => {
    if (!billRate || Number(billRate) <= 0) {
      alert('Enter a valid hourly rate.')
      return
    }
    setBilling(true)
    try {
      await timeTrackingApi.bill(caseId, entryId, {
        rate: Number(billRate),
        description: entries.find(e => e.id === entryId)?.description ?? undefined,
      })
      await loadEntries()
      setBillingEntryId(null)
      setBillRate('')
      onBillingCreated?.()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to convert to billing entry.')
    } finally { setBilling(false) }
  }

  const totalBillable = entries
    .filter(e => e.is_billable && e.duration_sec)
    .reduce((s, e) => s + (e.duration_sec ?? 0), 0)

  return (
    <div className="time-tracker">
      <div className="time-tracker-header" onClick={() => setExpanded(p => !p)}>
        <span className="time-tracker-title">
          <Timer size={15} />
          Time Tracking
          {totalBillable > 0 && (
            <span className="time-tracker-badge">{formatDuration(totalBillable)} billable</span>
          )}
        </span>
        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </div>

      {expanded && (
        <div className="time-tracker-body">
          {/* Timer Controls */}
          <div className="timer-controls">
            {!activeEntry ? (
              <>
                <input
                  className="timer-desc-input"
                  placeholder="What are you working on?"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !starting && handleStart()}
                />
                <label className="timer-billable-toggle">
                  <input type="checkbox" checked={isBillable} onChange={e => setIsBillable(e.target.checked)} />
                  <span>Billable</span>
                </label>
                <button className="btn-primary timer-start-btn" onClick={handleStart} disabled={starting}>
                  {starting ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                  Start
                </button>
              </>
            ) : (
              <>
                <div className="timer-running">
                  <span className="timer-display">{formatDuration(elapsed)}</span>
                  <span className="timer-running-desc">
                    {activeEntry.description || 'Running…'}
                  </span>
                </div>
                <button className="btn-danger timer-stop-btn" onClick={handleStop} disabled={stopping}>
                  {stopping ? <Loader2 size={14} className="spin" /> : <Square size={14} />}
                  Stop
                </button>
              </>
            )}
          </div>

          {/* Entries List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '0.75rem', color: '#64748b' }}>
              <Loader2 size={18} className="spin" />
            </div>
          ) : entries.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.83rem', textAlign: 'center', padding: '0.5rem' }}>
              No time entries yet.
            </p>
          ) : (
            <div className="time-entries-list">
              {entries.map(entry => (
                <div key={entry.id} className={`time-entry-row ${!entry.ended_at ? 'time-entry-running' : ''}`}>
                  <div className="time-entry-info">
                    <span className="time-entry-desc">
                      {entry.description || <em style={{ color: '#94a3b8' }}>No description</em>}
                    </span>
                    <span className="time-entry-meta">
                      {entry.started_at ? new Date(entry.started_at).toLocaleDateString() : ''}
                      {entry.is_billable && <span className="badge-billable">Billable</span>}
                      {entry.billing_id && <span className="badge-billed">Billed</span>}
                    </span>
                  </div>
                  <div className="time-entry-right">
                    <span className="time-entry-duration">
                      {entry.ended_at
                        ? formatDuration(entry.duration_sec ?? 0)
                        : <span className="timer-live">{formatDuration(elapsed)}</span>}
                    </span>

                    {/* Convert to billing */}
                    {entry.ended_at && !entry.billing_id && entry.is_billable && (
                      <>
                        {billingEntryId === entry.id ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input
                              style={{ width: 80, fontSize: '0.78rem', padding: '3px 6px', borderRadius: 4, border: '1px solid #cbd5e1' }}
                              type="number" min="0" placeholder="₱/hr"
                              value={billRate}
                              onChange={e => setBillRate(e.target.value)}
                            />
                            <button className="btn-small" style={{ color: '#16a34a' }}
                              onClick={() => handleBill(entry.id)} disabled={billing}>
                              {billing ? <Loader2 size={11} className="spin" /> : <DollarSign size={11} />}
                            </button>
                            <button className="btn-small" onClick={() => setBillingEntryId(null)}>✕</button>
                          </div>
                        ) : (
                          <button className="btn-small" style={{ color: '#2563eb' }} title="Convert to billing"
                            onClick={() => setBillingEntryId(entry.id)}>
                            <DollarSign size={12} />
                          </button>
                        )}
                      </>
                    )}

                    <button className="btn-small btn-danger" onClick={() => handleDelete(entry.id)}
                      title="Delete" disabled={!entry.ended_at}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
