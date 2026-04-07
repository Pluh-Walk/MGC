import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Plus, Send, DollarSign, Ban, Download,
  ChevronDown, ChevronUp, Loader2, CheckCircle2, X,
} from 'lucide-react'
import { invoiceApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface BillingEntry {
  id: number
  description: string
  amount: string | number
  entry_type: string
  billing_date: string | null
  is_billed: boolean
  is_paid: boolean
}

interface Invoice {
  id: number
  invoice_number: string
  status: 'draft' | 'sent' | 'paid' | 'disputed' | 'void'
  total_amount: string | number
  due_date: string | null
  created_at: string
  sent_at: string | null
  paid_at: string | null
  paid_reference: string | null
}

interface Props {
  caseId: number
  billingEntries: BillingEntry[]
  onRefreshBilling: () => void
}

const STATUS_COLOR: Record<string, string> = {
  draft: '#64748b',
  sent: '#2563eb',
  paid: '#16a34a',
  disputed: '#dc2626',
  void: '#94a3b8',
}

export default function InvoiceManager({ caseId, billingEntries, onRefreshBilling }: Props) {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedEntries, setSelectedEntries] = useState<number[]>([])
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [taxRate, setTaxRate] = useState('12')
  const [payRef, setPayRef] = useState('')
  const [payingId, setPayingId] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const isAtty = user?.role === 'attorney' || user?.role === 'secretary'

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await invoiceApi.list(caseId)
      setInvoices(res.data.data ?? [])
    } catch { setInvoices([]) }
    finally { setLoading(false) }
  }, [caseId])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  const unbilledEntries = billingEntries.filter(e => !e.is_billed && !e.is_paid)

  const toggleEntry = (id: number) =>
    setSelectedEntries(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const selectedTotal = selectedEntries
    .map(id => billingEntries.find(e => e.id === id))
    .filter(Boolean)
    .reduce((s, e) => s + Number(e!.amount), 0)

  const handleCreate = async () => {
    if (!selectedEntries.length) return
    setCreating(true)
    try {
      await invoiceApi.create(caseId, {
        entry_ids: selectedEntries,
        due_date: dueDate || undefined,
        notes: notes || undefined,
        tax_rate: taxRate ? Number(taxRate) : undefined,
      })
      setShowCreate(false)
      setSelectedEntries([])
      setDueDate('')
      setNotes('')
      setTaxRate('12')
      await loadInvoices()
      onRefreshBilling()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create invoice.')
    } finally { setCreating(false) }
  }

  const handleSend = async (inv: Invoice) => {
    if (!window.confirm(`Send invoice ${inv.invoice_number} to client?`)) return
    setActionLoading(inv.id)
    try {
      await invoiceApi.send(caseId, inv.id)
      await loadInvoices()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to send invoice.')
    } finally { setActionLoading(null) }
  }

  const handlePay = async (inv: Invoice) => {
    setActionLoading(inv.id)
    try {
      await invoiceApi.pay(caseId, inv.id, { paid_reference: payRef || undefined })
      setPayingId(null)
      setPayRef('')
      await loadInvoices()
      onRefreshBilling()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to mark as paid.')
    } finally { setActionLoading(null) }
  }

  const handleVoid = async (inv: Invoice) => {
    if (!window.confirm(`Void invoice ${inv.invoice_number}? This cannot be undone.`)) return
    setActionLoading(inv.id)
    try {
      await invoiceApi.void_(caseId, inv.id)
      await loadInvoices()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to void invoice.')
    } finally { setActionLoading(null) }
  }

  const fmt = (n: string | number) =>
    `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  return (
    <div className="invoice-manager">
      <div className="invoice-manager-header" onClick={() => setExpanded(p => !p)}>
        <span className="invoice-manager-title">
          <FileText size={15} />
          Invoices
          {invoices.length > 0 && (
            <span className="invoice-count-badge">{invoices.length}</span>
          )}
        </span>
        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </div>

      {expanded && (
        <div className="invoice-manager-body">
          {/* Create Invoice Button */}
          {isAtty && (
            <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => setShowCreate(true)}>
                <Plus size={13} /> Create Invoice
              </button>
            </div>
          )}

          {/* Create Invoice Form */}
          {showCreate && (
            <div className="inline-edit-form" style={{ marginBottom: '1rem' }}>
              <h4 style={{ marginBottom: '0.75rem' }}>New Invoice</h4>

              {unbilledEntries.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No unbilled entries available.</p>
              ) : (
                <>
                  <p style={{ fontSize: '0.82rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                    Select billing entries to include:
                  </p>
                  <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: '0.75rem' }}>
                    {unbilledEntries.map(e => (
                      <label key={e.id} className="invoice-entry-row">
                        <input
                          type="checkbox"
                          checked={selectedEntries.includes(e.id)}
                          onChange={() => toggleEntry(e.id)}
                        />
                        <span style={{ flex: 1, fontSize: '0.82rem' }}>{e.description}</span>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{fmt(e.amount)}</span>
                      </label>
                    ))}
                  </div>
                  {selectedEntries.length > 0 && (
                    <p style={{ fontSize: '0.82rem', marginBottom: '0.75rem', color: '#2563eb' }}>
                      Subtotal: <strong>{fmt(selectedTotal)}</strong>
                    </p>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="field-group">
                      <label>Due Date</label>
                      <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                    </div>
                    <div className="field-group">
                      <label>Tax Rate (%)</label>
                      <input type="number" min="0" max="100" step="0.5" value={taxRate}
                        onChange={e => setTaxRate(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                  <div className="field-group" style={{ marginBottom: '0.75rem' }}>
                    <label>Notes</label>
                    <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes on invoice" />
                  </div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" onClick={() => setShowCreate(false)} disabled={creating}>
                      <X size={13} /> Cancel
                    </button>
                    <button className="btn-primary" onClick={handleCreate}
                      disabled={creating || selectedEntries.length === 0}>
                      {creating ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />}
                      {creating ? 'Creating…' : 'Create Invoice'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Invoice List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>
              <Loader2 size={20} className="spin" />
            </div>
          ) : invoices.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '0.75rem' }}>
              No invoices yet.
            </p>
          ) : (
            <div className="invoice-list">
              {invoices.map(inv => (
                <div key={inv.id} className="invoice-card">
                  <div className="invoice-card-left">
                    <span className="invoice-number">{inv.invoice_number}</span>
                    <span className="invoice-status" style={{ color: STATUS_COLOR[inv.status] }}>
                      {inv.status.toUpperCase()}
                    </span>
                    <span className="invoice-date">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </span>
                    {inv.due_date && (
                      <span className="invoice-due">
                        Due {new Date(inv.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="invoice-card-right">
                    <strong>{fmt(inv.total_amount)}</strong>

                    {/* Pay modal inline */}
                    {payingId === inv.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          style={{ fontSize: '0.78rem', padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', width: 140 }}
                          placeholder="Reference # (optional)"
                          value={payRef}
                          onChange={e => setPayRef(e.target.value)}
                        />
                        <button className="btn-small" style={{ color: '#16a34a' }}
                          onClick={() => handlePay(inv)}
                          disabled={actionLoading === inv.id}>
                          {actionLoading === inv.id ? <Loader2 size={12} className="spin" /> : <CheckCircle2 size={12} />}
                        </button>
                        <button className="btn-small" onClick={() => setPayingId(null)}><X size={12} /></button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {/* Download PDF — must go through axios to send JWT */}
                        <button
                          className="btn-small"
                          title="Download PDF"
                          disabled={actionLoading === inv.id}
                          onClick={async () => {
                            setActionLoading(inv.id)
                            try {
                              const res = await invoiceApi.downloadPdf(caseId, inv.id)
                              const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `${inv.invoice_number}.pdf`
                              a.click()
                              URL.revokeObjectURL(url)
                            } catch {
                              alert('Failed to download PDF.')
                            } finally {
                              setActionLoading(null)
                            }
                          }}
                        >
                          {actionLoading === inv.id ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
                        </button>

                        {isAtty && inv.status === 'draft' && (
                          <button className="btn-small" title="Send to client"
                            onClick={() => handleSend(inv)}
                            disabled={actionLoading === inv.id}>
                            {actionLoading === inv.id ? <Loader2 size={13} className="spin" /> : <Send size={13} />}
                          </button>
                        )}

                        {isAtty && (inv.status === 'sent' || inv.status === 'disputed') && (
                          <button className="btn-small" style={{ color: '#16a34a' }} title="Mark paid"
                            onClick={() => setPayingId(inv.id)}>
                            <DollarSign size={13} />
                          </button>
                        )}

                        {/* Download Receipt (paid invoices only) */}
                        {inv.status === 'paid' && (
                          <a
                            href={invoiceApi.receiptUrl(caseId, inv.id)}
                            download={`receipt_${inv.invoice_number}.pdf`}
                            className="btn-small"
                            title="Download Receipt"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}
                          >
                            <Download size={13} /> Receipt
                          </a>
                        )}

                        {isAtty && inv.status !== 'paid' && inv.status !== 'void' && (
                          <button className="btn-small btn-danger" title="Void invoice"
                            onClick={() => handleVoid(inv)}
                            disabled={actionLoading === inv.id}>
                            <Ban size={13} />
                          </button>
                        )}
                      </div>
                    )}
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
