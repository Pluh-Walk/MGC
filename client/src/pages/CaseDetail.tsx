import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Scale, ArrowLeft, FileText, Clock, StickyNote, Upload,
  CheckCircle, AlertCircle, Paperclip, Lock, Globe, Trash2,
  Pencil, CheckCircle2, X, Users, CalendarClock, AlertTriangle, Plus, Loader2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SettingsDropdown from '../components/SettingsDropdown'
import InvoiceManager from '../components/InvoiceManager'
import TimeTracker from '../components/TimeTracker'
import { casesApi, documentsApi, partiesApi, deadlinesApi, billingApi, relationsApi, cocounselApi, tagsApi } from '../services/api'

type Tab = 'info' | 'timeline' | 'notes' | 'documents' | 'parties' | 'deadlines' | 'billing' | 'relations' | 'cocounsel'

const STATUS_COLORS: Record<string, string> = {
  draft:    '#a78bfa',
  active:   '#22c55e',
  pending:  '#b8962e',
  closed:   '#3b82f6',
  archived: '#6b7280',
}

const CASE_TYPES = [
  'civil','criminal','family','corporate','administrative','labor',
  'property','immigration','intellectual_property','tax',
  'constitutional','probate','tort','contract','other',
] as const

const PARTY_TYPES = [
  'opposing_party','co_plaintiff','co_defendant','witness','respondent',
  'petitioner','intervenor','third_party','prosecutor','public_attorney','other',
] as const

const DEADLINE_TYPES = [
  'statute_of_limitations','filing_deadline','response_deadline','discovery_deadline',
  'trial_date','hearing_date','pleading_deadline','appeal_deadline','payment_deadline','other',
] as const

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [docs, setDocs] = useState<any[]>([])
  const [noteContent, setNoteContent] = useState('')
  const [notePrivate, setNotePrivate] = useState(true)
  const [noteSubmitting, setNoteSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [docVisible, setDocVisible] = useState(false)
  const [editStatus, setEditStatus] = useState('')

  // Inline edit state
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '', case_type: '', court_name: '', docket_number: '', judge_name: '', filing_date: '',
    description: '', priority: 'normal', opposing_party: '', opposing_counsel: '', retainer_amount: '',
  })
  const [editSaving, setEditSaving] = useState(false)
  const [approving, setApproving] = useState(false)

  // Outcome modal (required on close)
  const [showOutcomeModal, setShowOutcomeModal] = useState(false)
  const [pendingStatus, setPendingStatus] = useState('')
  const [outcomeForm, setOutcomeForm] = useState({ outcome: 'won', outcome_notes: '' })
  const [outcomeSaving, setOutcomeSaving] = useState(false)

  // Parties state
  const [showPartyForm, setShowPartyForm] = useState(false)
  const [partyForm, setPartyForm] = useState({ party_type: 'opposing_party', fullname: '', email: '', phone: '', organization: '', notes: '' })
  const [partySaving, setPartySaving] = useState(false)
  const [editParty, setEditParty] = useState<any>(null)

  // Deadlines state
  const [showDeadlineForm, setShowDeadlineForm] = useState(false)
  const [deadlineForm, setDeadlineForm] = useState({ title: '', deadline_type: 'filing_deadline', due_date: '', description: '', reminder_days: 7, notify_client: false })
  const [deadlineSaving, setDeadlineSaving] = useState(false)
  const [editDeadline, setEditDeadline] = useState<any>(null)

  // Billing state
  const [billingEntries, setBillingEntries] = useState<any[]>([])
  const [billingTotal, setBillingTotal] = useState(0)
  const [showBillingForm, setShowBillingForm] = useState(false)
  const [billingSaving, setBillingSaving] = useState(false)
  const [billingForm, setBillingForm] = useState({ entry_type: 'flat_fee', description: '', hours: '', rate: '', amount: '', billing_date: '', is_billed: false, invoice_number: '', notes: '' })

  // Relations state
  const [relations, setRelations] = useState<any[]>([])
  const [showRelationForm, setShowRelationForm] = useState(false)
  const [relationSaving, setRelationSaving] = useState(false)
  const [relationForm, setRelationForm] = useState({ related_case_id: '', relation_type: 'related_matter', notes: '' })

  // Co-counsel state
  const [cocounsel, setCocounsel] = useState<any[]>([])
  const [showCocounselForm, setShowCocounselForm] = useState(false)
  const [cocounselSaving, setCocounselSaving] = useState(false)
  const [cocounselForm, setCocounselForm] = useState({ attorney_email: '', attorney_id: '', role: 'co_counsel' })
  const [allAttorneys, setAllAttorneys] = useState<any[]>([])

  // Tags state
  const [caseTags, setCaseTags] = useState<any[]>([])
  const [allTags, setAllTags] = useState<any[]>([])
  const [showTagPicker, setShowTagPicker] = useState(false)

  // Document versioning state
  const [expandedDocId, setExpandedDocId] = useState<number | null>(null)
  const [docVersions, setDocVersions] = useState<Record<number, any[]>>({})
  const [versionsLoading, setVersionsLoading] = useState<Record<number, boolean>>({})
  const [uploadingVersion, setUploadingVersion] = useState<Record<number, boolean>>({})

  const fetchCase = async () => {
    try {
      const res = await casesApi.get(Number(id))
      setData(res.data.data)
      setEditStatus(res.data.data.status)
    } catch {
      navigate(-1)
    } finally {
      setLoading(false)
    }
  }

  const fetchDocs = async () => {
    try {
      const res = await documentsApi.list(Number(id))
      setDocs(res.data.data)
    } catch {}
  }

  useEffect(() => { fetchCase() }, [id])
  useEffect(() => { if (activeTab === 'documents') fetchDocs() }, [activeTab])
  useEffect(() => {
    if (activeTab === 'billing') {
      billingApi.list(Number(id)).then(r => { setBillingEntries(r.data.data); setBillingTotal(r.data.total) }).catch(() => {})
    }
    if (activeTab === 'relations') {
      relationsApi.list(Number(id)).then(r => setRelations(r.data.data)).catch(() => {})
    }
    if (activeTab === 'cocounsel') {
      cocounselApi.list(Number(id)).then(r => setCocounsel(r.data.data)).catch(() => {})
    }
  }, [activeTab, id])

  // ─── Party handlers ─────────────────────────────────────
  const handleAddParty = async () => {
    if (!partyForm.fullname.trim()) return
    setPartySaving(true)
    try {
      if (editParty) {
        await partiesApi.update(Number(id), editParty.id, partyForm)
      } else {
        await partiesApi.add(Number(id), partyForm)
      }
      setShowPartyForm(false)
      setEditParty(null)
      setPartyForm({ party_type: 'opposing_party', fullname: '', email: '', phone: '', organization: '', notes: '' })
      fetchCase()
    } catch {} finally {
      setPartySaving(false)
    }
  }

  const handleDeleteParty = async (partyId: number) => {
    if (!confirm('Remove this party from the case?')) return
    try {
      await partiesApi.delete(Number(id), partyId)
      fetchCase()
    } catch {}
  }

  const openEditParty = (p: any) => {
    setPartyForm({ party_type: p.party_type, fullname: p.fullname, email: p.email || '', phone: p.phone || '', organization: p.organization || '', notes: p.notes || '' })
    setEditParty(p)
    setShowPartyForm(true)
  }

  // ─── Deadline handlers ───────────────────────────────────
  const handleAddDeadline = async () => {
    if (!deadlineForm.title.trim() || !deadlineForm.due_date) return
    setDeadlineSaving(true)
    try {
      if (editDeadline) {
        await deadlinesApi.update(Number(id), editDeadline.id, deadlineForm)
      } else {
        await deadlinesApi.create(Number(id), deadlineForm)
      }
      setShowDeadlineForm(false)
      setEditDeadline(null)
      setDeadlineForm({ title: '', deadline_type: 'filing_deadline', due_date: '', description: '', reminder_days: 7, notify_client: false })
      fetchCase()
    } catch {} finally {
      setDeadlineSaving(false)
    }
  }

  const handleCompleteDeadline = async (deadlineId: number) => {
    if (!confirm('Mark this deadline as completed?')) return
    try {
      await deadlinesApi.complete(Number(id), deadlineId)
      fetchCase()
    } catch {}
  }

  const handleDeleteDeadline = async (deadlineId: number) => {
    if (!confirm('Delete this deadline?')) return
    try {
      await deadlinesApi.delete(Number(id), deadlineId)
      fetchCase()
    } catch {}
  }

  const openEditDeadline = (d: any) => {
    setDeadlineForm({
      title: d.title,
      deadline_type: d.deadline_type,
      due_date: d.due_date ? d.due_date.slice(0, 10) : '',
      description: d.description || '',
      reminder_days: d.reminder_days,
      notify_client: !!d.notify_client,
    })
    setEditDeadline(d)
    setShowDeadlineForm(true)
  }

  // ─── Billing handlers ────────────────────────────────────
  const handleAddBilling = async () => {
    if (!billingForm.description.trim() || !billingForm.amount) return
    setBillingSaving(true)
    try {
      await billingApi.add(Number(id), { ...billingForm, amount: Number(billingForm.amount), hours: billingForm.hours ? Number(billingForm.hours) : null, rate: billingForm.rate ? Number(billingForm.rate) : null })
      setShowBillingForm(false)
      setBillingForm({ entry_type: 'flat_fee', description: '', hours: '', rate: '', amount: '', billing_date: '', is_billed: false, invoice_number: '', notes: '' })
      billingApi.list(Number(id)).then(r => { setBillingEntries(r.data.data); setBillingTotal(r.data.total) })
    } catch {} finally { setBillingSaving(false) }
  }

  const handleDeleteBilling = async (entryId: number) => {
    if (!confirm('Delete this billing entry?')) return
    await billingApi.delete(Number(id), entryId)
    billingApi.list(Number(id)).then(r => { setBillingEntries(r.data.data); setBillingTotal(r.data.total) })
  }

  const handleMarkBillingPaid = async (entryId: number) => {
    await billingApi.update(Number(id), entryId, { is_paid: true, paid_at: new Date().toISOString().slice(0, 10) })
    billingApi.list(Number(id)).then(r => { setBillingEntries(r.data.data); setBillingTotal(r.data.total) })
  }

  // ─── Relations handlers ───────────────────────────────────
  const handleAddRelation = async () => {
    if (!relationForm.related_case_id) return
    setRelationSaving(true)
    try {
      await relationsApi.add(Number(id), { related_case_id: Number(relationForm.related_case_id), relation_type: relationForm.relation_type, notes: relationForm.notes || undefined })
      setShowRelationForm(false)
      setRelationForm({ related_case_id: '', relation_type: 'related_matter', notes: '' })
      relationsApi.list(Number(id)).then(r => setRelations(r.data.data))
    } catch {} finally { setRelationSaving(false) }
  }

  const handleDeleteRelation = async (relId: number) => {
    if (!confirm('Remove this case relation?')) return
    await relationsApi.delete(Number(id), relId)
    relationsApi.list(Number(id)).then(r => setRelations(r.data.data))
  }

  // ─── Co-counsel handlers ─────────────────────────────────
  const openCocounselTab = async () => {
    if (!allAttorneys.length) {
      try { const r = await import('../services/api').then(m => m.profileApi.listAttorneys()); setAllAttorneys(r.data.data) } catch {}
    }
  }

  const handleAddCocounsel = async () => {
    if (!cocounselForm.attorney_id) return
    setCocounselSaving(true)
    try {
      await cocounselApi.add(Number(id), { attorney_id: Number(cocounselForm.attorney_id), role: cocounselForm.role })
      setShowCocounselForm(false)
      setCocounselForm({ attorney_email: '', attorney_id: '', role: 'co_counsel' })
      cocounselApi.list(Number(id)).then(r => setCocounsel(r.data.data))
    } catch {} finally { setCocounselSaving(false) }
  }

  const handleRemoveCocounsel = async (entryId: number) => {
    if (!confirm('Remove this co-counsel?')) return
    await cocounselApi.remove(Number(id), entryId)
    cocounselApi.list(Number(id)).then(r => setCocounsel(r.data.data))
  }

  // ─── Tag handlers ─────────────────────────────────────────
  const loadTags = async () => {
    const [caseTagsRes, allTagsRes] = await Promise.all([tagsApi.getCaseTags(Number(id)), tagsApi.listAll()])
    setCaseTags(caseTagsRes.data.data)
    setAllTags(allTagsRes.data.data)
  }

  const handleAssignTag = async (tagId: number) => {
    await tagsApi.assign(Number(id), tagId)
    loadTags()
  }

  const handleRemoveTag = async (tagId: number) => {
    await tagsApi.remove(Number(id), tagId)
    loadTags()
  }

  const openEdit = () => {
    setEditForm({
      title:            data.title,
      case_type:        data.case_type,
      court_name:       data.court_name || '',
      docket_number:    data.docket_number || '',
      judge_name:       data.judge_name || '',
      filing_date:      data.filing_date ? data.filing_date.slice(0, 10) : '',
      description:      data.description || '',
      priority:         data.priority || 'normal',
      opposing_party:   data.opposing_party || '',
      opposing_counsel: data.opposing_counsel || '',
      retainer_amount:  data.retainer_amount != null ? String(data.retainer_amount) : '',
    })
    setShowEdit(true)
  }

  const handleEditSave = async () => {
    setEditSaving(true)
    try {
      await casesApi.update(Number(id), {
        ...editForm,
        retainer_amount: editForm.retainer_amount ? Number(editForm.retainer_amount) : null,
      })
      setShowEdit(false)
      fetchCase()
    } catch {} finally {
      setEditSaving(false)
    }
  }

  const handleApprove = async () => {
    if (!confirm('Approve this draft and make it active? The client will be notified.')) return
    setApproving(true)
    try {
      await casesApi.approveDraft(Number(id))
      fetchCase()
    } catch {} finally {
      setApproving(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    // Require outcome when closing
    if (newStatus === 'closed' && data.status !== 'closed') {
      setPendingStatus(newStatus)
      setOutcomeForm({ outcome: 'won', outcome_notes: '' })
      setShowOutcomeModal(true)
      return
    }
    try {
      await casesApi.update(Number(id), { status: newStatus })
      setEditStatus(newStatus)
      fetchCase()
    } catch {}
  }

  const handleOutcomeSubmit = async () => {
    setOutcomeSaving(true)
    try {
      await casesApi.update(Number(id), {
        status: pendingStatus,
        outcome: outcomeForm.outcome,
        outcome_notes: outcomeForm.outcome_notes,
      })
      setEditStatus(pendingStatus)
      setShowOutcomeModal(false)
      fetchCase()
    } catch {} finally {
      setOutcomeSaving(false)
    }
  }

  const handleAddNote = async () => {
    if (!noteContent.trim()) return
    setNoteSubmitting(true)
    try {
      await casesApi.addNote(Number(id), { content: noteContent, is_private: notePrivate })
      setNoteContent('')
      fetchCase()
    } catch {} finally {
      setNoteSubmitting(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('category', 'other')
    fd.append('is_client_visible', docVisible ? 'true' : 'false')
    try {
      await documentsApi.upload(Number(id), fd)
      fetchDocs()
    } catch {} finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteDoc = async (docId: number) => {
    if (!confirm('Remove this document?')) return
    try {
      await documentsApi.delete(docId)
      fetchDocs()
    } catch {}
  }

  const toggleVersions = async (docId: number) => {
    if (expandedDocId === docId) { setExpandedDocId(null); return }
    setExpandedDocId(docId)
    if (docVersions[docId]) return  // already loaded
    setVersionsLoading(v => ({ ...v, [docId]: true }))
    try {
      const res = await documentsApi.listVersions(Number(id), docId)
      setDocVersions(v => ({ ...v, [docId]: res.data.data }))
    } catch {}
    finally { setVersionsLoading(v => ({ ...v, [docId]: false })) }
  }

  const handleUploadVersion = async (docId: number, file: File, notes: string) => {
    setUploadingVersion(v => ({ ...v, [docId]: true }))
    const fd = new FormData()
    fd.append('file', file)
    if (notes) fd.append('notes', notes)
    try {
      await documentsApi.uploadVersion(Number(id), docId, fd)
      // Reload versions list
      const res = await documentsApi.listVersions(Number(id), docId)
      setDocVersions(v => ({ ...v, [docId]: res.data.data }))
      fetchDocs()  // refresh main list so filename updates
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Upload failed.')
    } finally {
      setUploadingVersion(v => ({ ...v, [docId]: false }))
    }
  }

  const handleDownloadVersion = async (docId: number, versionId: number, originalName: string) => {
    try {
      const res = await documentsApi.downloadVersion(Number(id), docId, versionId)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url; a.download = originalName; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Download failed.') }
  }

  if (loading) return <div className="dashboard"><main className="dash-content"><div className="loading-state">Loading case…</div></main></div>
  if (!data) return null

  return (
    <div className="dashboard">
      <nav className="dash-nav">
        <div className="dash-nav-brand">
          <Scale size={22} className="nav-icon" />
          MGC Law System
        </div>
        <div className="dash-nav-right">
          <span className={`role-badge ${user?.role}`}>
            {user?.role === 'attorney' ? 'Attorney' : user?.role === 'secretary' ? 'Secretary' : 'Client'}
          </span>
          <SettingsDropdown />
        </div>
      </nav>

      <main className="dash-content">
        <button className="btn-back" onClick={() => navigate('/cases')}>
          <ArrowLeft size={16} />
          Back to Cases
        </button>

        {/* Case Header */}
        <div className="case-header-card">
          <div className="case-header-left">
            <span className="mono case-number">{data.case_number}</span>
            <h2>{data.title}</h2>
            <div className="case-meta-row">
              <span style={{ textTransform: 'capitalize' }}>{data.case_type}</span>
              <span>·</span>
              <span>Client: <strong>{data.client_name}</strong></span>
              <span>·</span>
              <span>Attorney: <strong>{data.attorney_name}</strong></span>
            </div>
          </div>
          <div className="case-header-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            {user?.role === 'attorney' && data.status !== 'draft' ? (
              <select
                value={editStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="status-select"
                style={{ borderColor: STATUS_COLORS[editStatus] }}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            ) : user?.role === 'attorney' && data.status === 'draft' ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className="status-badge-lg" style={{ background: STATUS_COLORS.draft }}>Draft — Pending Review</span>
                <button className="btn-primary" onClick={handleApprove} disabled={approving} style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}>
                  <CheckCircle2 size={14} /> {approving ? 'Approving…' : 'Approve'}
                </button>
              </div>
            ) : data.status === 'draft' ? (
              <span className="status-badge-lg" style={{ background: STATUS_COLORS.draft }}>Draft — Pending Approval</span>
            ) : (
              <span className="status-badge-lg" style={{ background: STATUS_COLORS[data.status] }}>{data.status}</span>
            )}
            <button className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
              onClick={() => casesApi.exportCase(data.id)}>
              <FileText size={12} /> Print / Export
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          {(['info', 'timeline', 'notes', 'documents', 'parties', 'deadlines'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`tab-btn${activeTab === t ? ' active' : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t === 'info'      && <FileText size={14} />}
              {t === 'timeline'  && <Clock size={14} />}
              {t === 'notes'     && <StickyNote size={14} />}
              {t === 'documents' && <Paperclip size={14} />}
              {t === 'parties'   && <Users size={14} />}
              {t === 'deadlines' && (
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  <CalendarClock size={14} />
                  {data?.deadlines?.filter((d: any) => !d.is_completed && new Date(d.due_date) < new Date()).length > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -4, width: 7, height: 7, borderRadius: '50%', background: '#dc2626' }} />
                  )}
                </span>
              )}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          {/* Attorney-only extra tabs */}
          {(user?.role === 'attorney' || user?.role === 'secretary') && (
            <>
              {(['billing', 'relations', 'cocounsel'] as Tab[]).map(t => (
                <button key={t} className={`tab-btn${activeTab === t ? ' active' : ''}`}
                  onClick={() => { setActiveTab(t); if (t === 'cocounsel') openCocounselTab() }}>
                  {t === 'billing'   && <FileText size={14} />}
                  {t === 'relations' && <CheckCircle size={14} />}
                  {t === 'cocounsel' && <Users size={14} />}
                  {t === 'billing' ? 'Billing' : t === 'relations' ? 'Relations' : 'Co-Counsel'}
                </button>
              ))}
            </>
          )}
          {/* Tags button (attorney/secretary) */}
          {(user?.role === 'attorney' || user?.role === 'secretary') && (
            <button className="btn-small" style={{ marginLeft: 'auto', alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 4, padding: '0.3rem 0.7rem', borderRadius: 6 }}
              onClick={() => { loadTags(); setShowTagPicker(p => !p) }}>
              <Plus size={12} /> Tags
            </button>
          )}
        </div>

        {/* Tag picker popover */}
        {showTagPicker && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '0.75rem', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <strong style={{ fontSize: '0.87rem' }}>Case Tags</strong>
              <button className="modal-close" onClick={() => setShowTagPicker(false)}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
              {caseTags.map((t: any) => (
                <span key={t.id} style={{ background: t.color + '22', color: t.color, border: `1px solid ${t.color}`, borderRadius: 20, padding: '0.15rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {t.name}
                  <button onClick={() => handleRemoveTag(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.color, padding: 0, lineHeight: 1 }}>×</button>
                </span>
              ))}
              {caseTags.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No tags assigned.</span>}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Add tag:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {allTags.filter(t => !caseTags.find((ct: any) => ct.id === t.id)).map((t: any) => (
                <button key={t.id} onClick={() => handleAssignTag(t.id)} style={{ background: t.color + '22', color: t.color, border: `1px solid ${t.color}`, borderRadius: 20, padding: '0.15rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  + {t.name}
                </button>
              ))}
              {allTags.filter(t => !caseTags.find((ct: any) => ct.id === t.id)).length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>All tags assigned.</span>}
            </div>
          </div>
        )}

        {/* Tab: Info */}
        {activeTab === 'info' && (
          <div className="tab-content">
            {(user?.role === 'attorney' || user?.role === 'secretary') && !showEdit && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <button className="btn-secondary" style={{ fontSize: '0.82rem' }} onClick={openEdit}>
                  <Pencil size={13} /> Edit Details
                </button>
              </div>
            )}

            {showEdit ? (
              <div className="inline-edit-form">
                <div className="field-group">
                  <label>Title</label>
                  <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="field-group">
                  <label>Description</label>
                  <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Brief facts and legal basis…" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="field-group">
                    <label>Case Type</label>
                    <select value={editForm.case_type} onChange={e => setEditForm(f => ({ ...f, case_type: e.target.value }))}>
                      {CASE_TYPES.map(t => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <label>Priority</label>
                    <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="normal">Normal</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="field-group">
                    <label>Court Name</label>
                    <input value={editForm.court_name} onChange={e => setEditForm(f => ({ ...f, court_name: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <label>Docket Number</label>
                    <input value={editForm.docket_number} onChange={e => setEditForm(f => ({ ...f, docket_number: e.target.value }))} placeholder="Court-assigned docket no." />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="field-group">
                    <label>Judge Name</label>
                    <input value={editForm.judge_name} onChange={e => setEditForm(f => ({ ...f, judge_name: e.target.value }))} />
                  </div>
                  {user?.role === 'attorney' && (
                    <div className="field-group">
                      <label>Filing Date</label>
                      <input type="date" value={editForm.filing_date} onChange={e => setEditForm(f => ({ ...f, filing_date: e.target.value }))} />
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="field-group">
                    <label>Opposing Party</label>
                    <input value={editForm.opposing_party} onChange={e => setEditForm(f => ({ ...f, opposing_party: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <label>Opposing Counsel</label>
                    <input value={editForm.opposing_counsel} onChange={e => setEditForm(f => ({ ...f, opposing_counsel: e.target.value }))} />
                  </div>
                </div>
                {user?.role === 'attorney' && (
                  <div className="field-group">
                    <label>Retainer Amount (₱)</label>
                    <input type="number" value={editForm.retainer_amount} onChange={e => setEditForm(f => ({ ...f, retainer_amount: e.target.value }))} min="0" step="0.01" />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button className="btn-secondary" onClick={() => setShowEdit(false)} disabled={editSaving}>
                    <X size={13} /> Cancel
                  </button>
                  <button className="btn-primary" onClick={handleEditSave} disabled={editSaving}>
                    <CheckCircle2 size={13} /> {editSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="info-grid">
                {data.description && (
                  <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                    <label>Description</label>
                    <span style={{ whiteSpace: 'pre-wrap' }}>{data.description}</span>
                  </div>
                )}
                <div className="info-item"><label>Priority</label><span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{data.priority || 'Normal'}</span></div>
                <div className="info-item"><label>Court</label><span>{data.court_name || '—'}</span></div>
                <div className="info-item"><label>Docket Number</label><span>{data.docket_number || '—'}</span></div>
                <div className="info-item"><label>Judge</label><span>{data.judge_name || '—'}</span></div>
                <div className="info-item"><label>Filing Date</label><span>{data.filing_date ? new Date(data.filing_date).toLocaleDateString() : '—'}</span></div>
                <div className="info-item"><label>Opened On</label><span>{new Date(data.created_at).toLocaleDateString()}</span></div>
                <div className="info-item"><label>Opposing Party</label><span>{data.opposing_party || '—'}</span></div>
                <div className="info-item"><label>Opposing Counsel</label><span>{data.opposing_counsel || '—'}</span></div>
                {user?.role !== 'client' && (
                  <div className="info-item"><label>Retainer</label><span>{data.retainer_amount != null ? `₱ ${Number(data.retainer_amount).toLocaleString()}` : '—'}</span></div>
                )}
                {data.status === 'closed' && (
                  <>
                    <div className="info-item"><label>Outcome</label><span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{data.outcome || '—'}</span></div>
                    {data.outcome_notes && <div className="info-item" style={{ gridColumn: '1 / -1' }}><label>Outcome Notes</label><span>{data.outcome_notes}</span></div>}
                    <div className="info-item"><label>Closed On</label><span>{data.closed_at ? new Date(data.closed_at).toLocaleDateString() : '—'}</span></div>
                  </>
                )}
                <div className="info-item"><label>Client Email</label><span>{data.client_email}</span></div>
                <div className="info-item"><label>Attorney Email</label><span>{data.attorney_email}</span></div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Timeline */}
        {activeTab === 'timeline' && (
          <div className="tab-content">
            {data.timeline.length === 0 ? (
              <div className="empty-state"><Clock size={36} className="empty-icon" /><p>No timeline events yet.</p></div>
            ) : (
              <div className="timeline">
                {data.timeline.map((e: any) => (
                  <div key={e.id} className="timeline-item">
                    <div className="timeline-dot">
                      {e.event_type === 'status_change' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    </div>
                    <div className="timeline-body">
                      <p className="timeline-desc">{e.description}</p>
                      <span className="timeline-meta">
                        {new Date(e.event_date).toLocaleDateString()} · {e.created_by_name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Notes */}
        {activeTab === 'notes' && (
          <div className="tab-content">
            {(user?.role === 'attorney' || user?.role === 'secretary') && (
              <div className="note-composer">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Write a note…"
                  rows={4}
                  className="note-textarea"
                />
                <div className="note-footer">
                  {user?.role === 'attorney' ? (
                    <label className="toggle-row">
                      {notePrivate ? <Lock size={14} /> : <Globe size={14} />}
                      <input
                        type="checkbox"
                        checked={notePrivate}
                        onChange={(e) => setNotePrivate(e.target.checked)}
                      />
                      {notePrivate ? 'Private (attorney only)' : 'Visible to client'}
                    </label>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <Globe size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
                      Notes are visible to attorney and client
                    </span>
                  )}
                  <button
                    className="btn-primary"
                    onClick={handleAddNote}
                    disabled={noteSubmitting || !noteContent.trim()}
                  >
                    {noteSubmitting ? 'Saving…' : 'Add Note'}
                  </button>
                </div>
              </div>
            )}
            {data.notes.length === 0 ? (
              <div className="empty-state"><StickyNote size={36} className="empty-icon" /><p>No notes yet.</p></div>
            ) : (
              <div className="notes-list">
                {data.notes.map((n: any) => (
                  <div key={n.id} className="note-card">
                    <div className="note-card-header">
                      <span className="note-author">{n.author_name}</span>
                      {n.is_private && (
                        <span className="note-private-badge"><Lock size={11} /> Private</span>
                      )}
                      <span className="note-date">{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className="note-content">{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Documents */}
        {activeTab === 'documents' && (
          <div className="tab-content">
            {(user?.role === 'attorney' || user?.role === 'secretary') && (
              <div className="upload-row">
                <label className="btn-secondary upload-label">
                  <Upload size={15} />
                  {uploading ? 'Uploading…' : 'Upload Document'}
                  <input type="file" hidden onChange={handleUpload} disabled={uploading} />
                </label>
                <label className="toggle-row" style={{ fontSize: '0.83rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={docVisible}
                    onChange={e => setDocVisible(e.target.checked)}
                    style={{ marginRight: '0.35rem' }}
                  />
                  {docVisible ? <Globe size={13} /> : <Lock size={13} />}
                  {docVisible ? 'Visible to client' : 'Hidden from client'}
                </label>
              </div>
            )}
            {docs.length === 0 ? (
              <div className="empty-state"><Paperclip size={36} className="empty-icon" /><p>No documents uploaded.</p></div>
            ) : (
              <div className="doc-list">
                {docs.map((d: any) => (
                  <div key={d.id}>
                    <div className="doc-item">
                      <div className="doc-icon"><FileText size={18} /></div>
                      <div className="doc-info">
                        <span className="doc-name">{d.original_name}</span>
                        <span className="doc-meta">
                          {d.category} · {(d.file_size / 1024).toFixed(1)} KB · {new Date(d.uploaded_at).toLocaleDateString()}
                          {d.privilege_type && d.privilege_type !== 'none' && (
                            <span style={{ marginLeft: 6, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', borderRadius: 10, padding: '0 6px', fontSize: '0.75rem', fontWeight: 600 }}>
                              <Lock size={10} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} />
                              {d.privilege_type.replace(/_/g,' ')}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="doc-actions">
                        <a href={documentsApi.downloadUrl(d.id)} className="btn-small" target="_blank" rel="noreferrer">Download</a>
                        {(user?.role === 'attorney' || user?.role === 'secretary') && (
                          <button
                            className="btn-small"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => toggleVersions(d.id)}
                            title="Version history"
                          >
                            History {expandedDocId === d.id ? '▲' : '▼'}
                          </button>
                        )}
                        {user?.role === 'attorney' && (
                          <button className="btn-small btn-danger" onClick={() => handleDeleteDoc(d.id)}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── Version History Panel ── */}
                    {expandedDocId === d.id && (
                      <div style={{ background: 'var(--bg-sidebar, #1a1f2e)', border: '1px solid var(--border)', borderRadius: 8, margin: '0 0 0.5rem 2.5rem', padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Version History</span>
                          <label style={{ cursor: 'pointer' }}>
                            <input
                              type="file"
                              hidden
                              disabled={uploadingVersion[d.id]}
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                const notes = window.prompt('Notes for this version (optional):', '') ?? ''
                                await handleUploadVersion(d.id, file, notes)
                                e.target.value = ''
                              }}
                            />
                            <span className="btn-small" style={{ pointerEvents: 'none' }}>
                              {uploadingVersion[d.id] ? <><Loader2 size={12} className="spin" /> Uploading…</> : <><Upload size={12} /> Upload New Version</>}
                            </span>
                          </label>
                        </div>

                        {versionsLoading[d.id] ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                            <Loader2 size={14} className="spin" /> Loading versions…
                          </div>
                        ) : !docVersions[d.id]?.length ? (
                          <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', margin: 0 }}>No versions recorded yet. Upload a new version above to start tracking.</p>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem', fontWeight: 600 }}>Ver.</th>
                                <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem', fontWeight: 600 }}>Filename</th>
                                <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem', fontWeight: 600 }}>Uploaded by</th>
                                <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem', fontWeight: 600 }}>Date</th>
                                <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem', fontWeight: 600 }}>Notes</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {docVersions[d.id].map((v: any) => (
                                <tr key={v.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '0.4rem 0.5rem', fontWeight: 700 }}>v{v.version_number}</td>
                                  <td style={{ padding: '0.4rem 0.5rem' }}>{v.original_name}</td>
                                  <td style={{ padding: '0.4rem 0.5rem' }}>{v.uploader_name}</td>
                                  <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'nowrap' }}>{new Date(v.uploaded_at).toLocaleDateString()}</td>
                                  <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)' }}>{v.notes ?? '—'}</td>
                                  <td style={{ padding: '0.4rem 0.5rem' }}>
                                    <button className="btn-small" onClick={() => handleDownloadVersion(d.id, v.id, v.original_name)}>↓</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Tab: Parties */}
        {activeTab === 'parties' && (
          <div className="tab-content">
            {(user?.role === 'attorney' || user?.role === 'secretary') && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <button className="btn-primary" style={{ fontSize: '0.82rem' }} onClick={() => {
                  setEditParty(null)
                  setPartyForm({ party_type: 'opposing_party', fullname: '', email: '', phone: '', organization: '', notes: '' })
                  setShowPartyForm(true)
                }}>
                  <Plus size={14} /> Add Party
                </button>
              </div>
            )}

            {showPartyForm && (
              <div className="inline-edit-form" style={{ marginBottom: '1rem' }}>
                <h4 style={{ marginBottom: '0.75rem', fontWeight: 600 }}>{editParty ? 'Edit Party' : 'Add Party'}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="field-group">
                    <label>Party Type</label>
                    <select value={partyForm.party_type} onChange={e => setPartyForm(f => ({ ...f, party_type: e.target.value }))}>
                      {PARTY_TYPES.map(t => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <label>Full Name *</label>
                    <input value={partyForm.fullname} onChange={e => setPartyForm(f => ({ ...f, fullname: e.target.value }))} placeholder="Full name" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="field-group">
                    <label>Email</label>
                    <input type="email" value={partyForm.email} onChange={e => setPartyForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <label>Phone</label>
                    <input value={partyForm.phone} onChange={e => setPartyForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
                <div className="field-group">
                  <label>Organization / Law Firm</label>
                  <input value={partyForm.organization} onChange={e => setPartyForm(f => ({ ...f, organization: e.target.value }))} />
                </div>
                <div className="field-group">
                  <label>Notes</label>
                  <textarea value={partyForm.notes} onChange={e => setPartyForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => { setShowPartyForm(false); setEditParty(null) }} disabled={partySaving}>
                    <X size={13} /> Cancel
                  </button>
                  <button className="btn-primary" onClick={handleAddParty} disabled={partySaving || !partyForm.fullname.trim()}>
                    <CheckCircle2 size={13} /> {partySaving ? 'Saving…' : editParty ? 'Update' : 'Add Party'}
                  </button>
                </div>
              </div>
            )}

            {(!data.parties || data.parties.length === 0) ? (
              <div className="empty-state"><Users size={36} className="empty-icon" /><p>No parties recorded yet.</p></div>
            ) : (
              <div className="parties-list">
                {data.parties.map((p: any) => (
                  <div key={p.id} className="party-card">
                    <div className="party-card-header">
                      <div>
                        <span className="party-name">{p.fullname}</span>
                        <span className="note-private-badge" style={{ marginLeft: '0.5rem', textTransform: 'capitalize' }}>
                          {p.party_type.replace(/_/g, ' ')}
                        </span>
                        {p.organization && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>· {p.organization}</span>}
                      </div>
                      {(user?.role === 'attorney' || user?.role === 'secretary') && (
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button className="btn-small" onClick={() => openEditParty(p)}><Pencil size={12} /></button>
                          <button className="btn-small btn-danger" onClick={() => handleDeleteParty(p.id)}><Trash2 size={12} /></button>
                        </div>
                      )}
                    </div>
                    <div className="note-date">
                      {p.email && <span>{p.email}</span>}
                      {p.phone && <span> · {p.phone}</span>}
                    </div>
                    {p.notes && <p className="note-content" style={{ marginTop: '0.35rem' }}>{p.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Deadlines */}
        {activeTab === 'deadlines' && (
          <div className="tab-content">
            {(user?.role === 'attorney' || user?.role === 'secretary') && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <button className="btn-primary" style={{ fontSize: '0.82rem' }} onClick={() => {
                  setEditDeadline(null)
                  setDeadlineForm({ title: '', deadline_type: 'filing_deadline', due_date: '', description: '', reminder_days: 7, notify_client: false })
                  setShowDeadlineForm(true)
                }}>
                  <Plus size={14} /> Add Deadline
                </button>
              </div>
            )}

            {showDeadlineForm && (
              <div className="inline-edit-form" style={{ marginBottom: '1rem' }}>
                <h4 style={{ marginBottom: '0.75rem', fontWeight: 600 }}>{editDeadline ? 'Edit Deadline' : 'Add Deadline'}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="field-group">
                    <label>Title *</label>
                    <input value={deadlineForm.title} onChange={e => setDeadlineForm(f => ({ ...f, title: e.target.value }))} placeholder="Deadline name" />
                  </div>
                  <div className="field-group">
                    <label>Type</label>
                    <select value={deadlineForm.deadline_type} onChange={e => setDeadlineForm(f => ({ ...f, deadline_type: e.target.value }))}>
                      {DEADLINE_TYPES.map(t => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="field-group">
                    <label>Due Date *</label>
                    <input type="date" value={deadlineForm.due_date} onChange={e => setDeadlineForm(f => ({ ...f, due_date: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <label>Remind (days before)</label>
                    <input type="number" min={1} max={90} value={deadlineForm.reminder_days} onChange={e => setDeadlineForm(f => ({ ...f, reminder_days: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="field-group">
                  <label>Description</label>
                  <textarea value={deadlineForm.description} onChange={e => setDeadlineForm(f => ({ ...f, description: e.target.value }))} rows={2} />
                </div>
                <label className="toggle-row" style={{ fontSize: '0.85rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
                  <input type="checkbox" checked={deadlineForm.notify_client} onChange={e => setDeadlineForm(f => ({ ...f, notify_client: e.target.checked }))} style={{ marginRight: '0.35rem' }} />
                  Notify client about this deadline
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => { setShowDeadlineForm(false); setEditDeadline(null) }} disabled={deadlineSaving}>
                    <X size={13} /> Cancel
                  </button>
                  <button className="btn-primary" onClick={handleAddDeadline} disabled={deadlineSaving || !deadlineForm.title.trim() || !deadlineForm.due_date}>
                    <CheckCircle2 size={13} /> {deadlineSaving ? 'Saving…' : editDeadline ? 'Update' : 'Add Deadline'}
                  </button>
                </div>
              </div>
            )}

            {(!data.deadlines || data.deadlines.length === 0) ? (
              <div className="empty-state"><CalendarClock size={36} className="empty-icon" /><p>No deadlines set yet.</p></div>
            ) : (
              <div className="deadlines-list">
                {data.deadlines.map((d: any) => {
                  const isOverdue = !d.is_completed && new Date(d.due_date) < new Date()
                  return (
                    <div key={d.id} className={`deadline-card${d.is_completed ? ' completed' : isOverdue ? ' overdue' : ''}`}>
                      <div className="deadline-card-header">
                        <div>
                          {isOverdue && <AlertTriangle size={14} style={{ color: '#dc2626', marginRight: 6, verticalAlign: 'text-bottom' }} />}
                          <span className="party-name" style={{ textDecoration: d.is_completed ? 'line-through' : 'none' }}>{d.title}</span>
                          <span className="note-private-badge" style={{ marginLeft: '0.5rem', textTransform: 'capitalize' }}>
                            {d.deadline_type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          {!d.is_completed && (user?.role === 'attorney' || user?.role === 'secretary') && (
                            <button className="btn-small" style={{ color: '#16a34a' }} title="Mark complete" onClick={() => handleCompleteDeadline(d.id)}>
                              <CheckCircle size={13} />
                            </button>
                          )}
                          {(user?.role === 'attorney' || user?.role === 'secretary') && !d.is_completed && (
                            <button className="btn-small" onClick={() => openEditDeadline(d)}><Pencil size={12} /></button>
                          )}
                          {user?.role === 'attorney' && (
                            <button className="btn-small btn-danger" onClick={() => handleDeleteDeadline(d.id)}><Trash2 size={12} /></button>
                          )}
                        </div>
                      </div>
                      <div className="note-date">
                        Due: <strong style={{ color: isOverdue ? '#dc2626' : 'inherit' }}>{new Date(d.due_date).toLocaleDateString()}</strong>
                        {d.is_completed && d.completed_by_name && <span> · Completed by {d.completed_by_name}</span>}
                        {d.notify_client && <span> · <Globe size={11} style={{ verticalAlign: 'text-bottom' }} /> Client notified</span>}
                      </div>
                      {d.description && <p className="note-content" style={{ marginTop: '0.35rem' }}>{d.description}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ Tab: Billing ═══════════════════════════════════════ */}
        {activeTab === 'billing' && (
          <div className="tab-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <strong>Total Billed: </strong>
                <span style={{ color: '#2563eb', fontWeight: 700 }}>
                  ₱{Number(billingTotal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {(user?.role === 'attorney' || user?.role === 'secretary') && (
                <button className="btn-primary" style={{ fontSize: '0.82rem' }} onClick={() => setShowBillingForm(true)}>
                  <Plus size={14} /> Add Entry
                </button>
              )}
            </div>

            {showBillingForm && (
              <div className="inline-edit-form" style={{ marginBottom: '1rem' }}>
                <h4 style={{ marginBottom: '0.75rem', fontWeight: 600 }}>New Billing Entry</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="field-group"><label>Entry Type</label>
                    <select value={billingForm.entry_type} onChange={e => setBillingForm(f => ({ ...f, entry_type: e.target.value }))}>
                      {['hourly','flat_fee','court_fee','filing_fee','expense','retainer_deduction','other'].map(t => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group"><label>Date</label>
                    <input type="date" value={billingForm.billing_date} onChange={e => setBillingForm(f => ({ ...f, billing_date: e.target.value }))} />
                  </div>
                </div>
                <div className="field-group"><label>Description *</label>
                  <input value={billingForm.description} onChange={e => setBillingForm(f => ({ ...f, description: e.target.value }))} placeholder="Service description" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="field-group"><label>Hours</label>
                    <input type="number" min="0" step="0.25" value={billingForm.hours} onChange={e => setBillingForm(f => ({ ...f, hours: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div className="field-group"><label>Rate (₱/hr)</label>
                    <input type="number" min="0" value={billingForm.rate} onChange={e => setBillingForm(f => ({ ...f, rate: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div className="field-group"><label>Amount (₱) *</label>
                    <input type="number" min="0" step="0.01" value={billingForm.amount} onChange={e => setBillingForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="field-group"><label>Invoice No.</label>
                    <input value={billingForm.invoice_number} onChange={e => setBillingForm(f => ({ ...f, invoice_number: e.target.value }))} />
                  </div>
                  <div className="field-group" style={{ justifyContent: 'flex-end', paddingTop: '1.5rem' }}>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={billingForm.is_billed} onChange={e => setBillingForm(f => ({ ...f, is_billed: e.target.checked }))} />
                      Mark as billed
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => setShowBillingForm(false)} disabled={billingSaving}><X size={13} /> Cancel</button>
                  <button className="btn-primary" onClick={handleAddBilling} disabled={billingSaving || !billingForm.description.trim() || !billingForm.amount}>
                    <CheckCircle2 size={13} /> {billingSaving ? 'Saving…' : 'Add Entry'}
                  </button>
                </div>
              </div>
            )}

            {billingEntries.length === 0 ? (
              <div className="empty-state"><FileText size={36} className="empty-icon" /><p>No billing entries yet.</p></div>
            ) : (
              <div className="cases-table-wrap">
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Hours</th><th>Amount</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {billingEntries.map((b: any) => (
                      <tr key={b.id}>
                        <td>{b.billing_date ? new Date(b.billing_date).toLocaleDateString() : '—'}</td>
                        <td style={{ textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{b.entry_type.replace(/_/g,' ')}</td>
                        <td>{b.description}</td>
                        <td>{b.hours ?? '—'}</td>
                        <td><strong>₱{Number(b.amount).toLocaleString('en-PH',{minimumFractionDigits:2})}</strong></td>
                        <td>
                          {b.is_paid ? (
                            <span className="status-badge icon-green">Paid</span>
                          ) : b.is_billed ? (
                            <span className="status-badge icon-gold">Billed</span>
                          ) : (
                            <span className="status-badge">Pending</span>
                          )}
                        </td>
                        <td>
                          {(user?.role === 'attorney' || user?.role === 'secretary') && !b.is_paid && (
                            <button className="btn-small" style={{ color: '#16a34a' }} title="Mark paid" onClick={() => handleMarkBillingPaid(b.id)}>
                              <CheckCircle size={13} />
                            </button>
                          )}
                          {user?.role === 'attorney' && (
                            <button className="btn-small btn-danger" onClick={() => handleDeleteBilling(b.id)}><Trash2 size={12} /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ textAlign: 'right', padding: '0.75rem 1rem', fontWeight: 600, borderTop: '1px solid #e2e8f0' }}>
                  Total: ₱{Number(billingTotal).toLocaleString('en-PH',{minimumFractionDigits:2})}
                </div>
              </div>
            )}

            {/* ── Invoices ────────────────────────────── */}
            <InvoiceManager
              caseId={Number(id)}
              billingEntries={billingEntries}
              onRefreshBilling={() => billingApi.list(Number(id)).then(r => {
                const entries = r.data.data ?? []
                setBillingEntries(entries)
                setBillingTotal(entries.reduce((s: number, e: any) => s + Number(e.amount), 0))
              })}
            />

            {/* ── Time Tracking ───────────────────────── */}
            {(user?.role === 'attorney' || user?.role === 'secretary') && (
              <TimeTracker caseId={Number(id)} onBillingCreated={() =>
                billingApi.list(Number(id)).then(r => {
                  const entries = r.data.data ?? []
                  setBillingEntries(entries)
                  setBillingTotal(entries.reduce((s: number, e: any) => s + Number(e.amount), 0))
                })
              } />
            )}
          </div>
        )}

        {/* ═══ Tab: Related Cases ═══════════════════════════════════ */}
        {activeTab === 'relations' && (
          <div className="tab-content">
            {(user?.role === 'attorney' || user?.role === 'secretary') && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <button className="btn-primary" style={{ fontSize: '0.82rem' }} onClick={() => setShowRelationForm(f => !f)}>
                  <Plus size={14} /> Link Case
                </button>
              </div>
            )}
            {showRelationForm && (
              <div className="inline-edit-form" style={{ marginBottom: '1rem' }}>
                <h4 style={{ marginBottom: '0.75rem', fontWeight: 600 }}>Link Related Case</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="field-group"><label>Case ID *</label>
                    <input type="number" placeholder="Enter case ID number" value={relationForm.related_case_id}
                      onChange={e => setRelationForm(f => ({ ...f, related_case_id: e.target.value }))} />
                  </div>
                  <div className="field-group"><label>Relation Type</label>
                    <select value={relationForm.relation_type} onChange={e => setRelationForm(f => ({ ...f, relation_type: e.target.value }))}>
                      {['consolidated','appealed_from','related_matter','cross_claim','counterclaim','companion','other'].map(v => (
                        <option key={v} value={v}>{v.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field-group"><label>Notes</label>
                  <textarea rows={2} value={relationForm.notes} onChange={e => setRelationForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => setShowRelationForm(false)} disabled={relationSaving}><X size={13} /> Cancel</button>
                  <button className="btn-primary" onClick={handleAddRelation} disabled={relationSaving || !relationForm.related_case_id}>
                    <CheckCircle2 size={13} /> {relationSaving ? 'Linking…' : 'Link Case'}
                  </button>
                </div>
              </div>
            )}
            {relations.length === 0 ? (
              <div className="empty-state"><CheckCircle size={36} className="empty-icon" /><p>No related cases linked.</p></div>
            ) : (
              <div className="parties-list">
                {relations.map((r: any) => (
                  <div key={r.id} className="party-card">
                    <div className="party-card-header">
                      <div>
                        <span className="mono" style={{ marginRight: 8, color: '#2563eb', cursor: 'pointer' }} onClick={() => navigate(`/cases/${r.related_case_id}`)}>
                          {r.case_number}
                        </span>
                        <span className="party-name">{r.title}</span>
                        <span className="note-private-badge" style={{ marginLeft: 8, textTransform: 'capitalize' }}>
                          {r.relation_type.replace(/_/g,' ')}
                        </span>
                        <span className="status-badge" style={{ marginLeft: 8 }}>{r.status}</span>
                      </div>
                      {(user?.role === 'attorney' || user?.role === 'secretary') && (
                        <button className="btn-small btn-danger" onClick={() => handleDeleteRelation(r.id)}><Trash2 size={12} /></button>
                      )}
                    </div>
                    {r.notes && <p className="note-content" style={{ marginTop: '0.25rem' }}>{r.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ Tab: Co-Counsel ══════════════════════════════════════ */}
        {activeTab === 'cocounsel' && (
          <div className="tab-content">
            {user?.role === 'attorney' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                <button className="btn-primary" style={{ fontSize: '0.82rem' }} onClick={() => setShowCocounselForm(f => !f)}>
                  <Plus size={14} /> Add Co-Counsel
                </button>
              </div>
            )}
            {showCocounselForm && (
              <div className="inline-edit-form" style={{ marginBottom: '1rem' }}>
                <h4 style={{ marginBottom: '0.75rem', fontWeight: 600 }}>Add Co-Counsel</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="field-group"><label>Select Attorney *</label>
                    <select value={cocounselForm.attorney_id} onChange={e => setCocounselForm(f => ({ ...f, attorney_id: e.target.value }))}>
                      <option value="">-- Select Attorney --</option>
                      {allAttorneys.filter((a: any) => a.id !== data.attorney_id).map((a: any) => (
                        <option key={a.id} value={a.id}>{a.fullname} ({a.email})</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group"><label>Role</label>
                    <select value={cocounselForm.role} onChange={e => setCocounselForm(f => ({ ...f, role: e.target.value }))}>
                      {['lead','co_counsel','supervisor','associate','paralegal'].map(v => (
                        <option key={v} value={v}>{v.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button className="btn-secondary" onClick={() => setShowCocounselForm(false)} disabled={cocounselSaving}><X size={13} /> Cancel</button>
                  <button className="btn-primary" onClick={handleAddCocounsel} disabled={cocounselSaving || !cocounselForm.attorney_id}>
                    <CheckCircle2 size={13} /> {cocounselSaving ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>
            )}
            {cocounsel.length === 0 ? (
              <div className="empty-state"><Users size={36} className="empty-icon" /><p>No co-counsel assigned.</p></div>
            ) : (
              <div className="parties-list">
                {cocounsel.map((c: any) => (
                  <div key={c.id} className="party-card">
                    <div className="party-card-header">
                      <div>
                        <span className="party-name">{c.fullname}</span>
                        <span className="note-private-badge" style={{ marginLeft: 8, textTransform: 'capitalize' }}>
                          {c.role.replace(/_/g,' ')}
                        </span>
                        <div className="note-date" style={{ marginTop: 2 }}>{c.email}</div>
                      </div>
                      {user?.role === 'attorney' && (
                        <button className="btn-small btn-danger" onClick={() => handleRemoveCocounsel(c.id)}><Trash2 size={12} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Outcome Modal — required when closing a case */}
      {showOutcomeModal && (
        <div className="modal-overlay" onClick={() => setShowOutcomeModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Case Outcome</h3>
              <button className="modal-close" onClick={() => setShowOutcomeModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-form">
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                An outcome is required before closing this case.
              </p>
              <div className="form-group">
                <label>Outcome *</label>
                <select value={outcomeForm.outcome} onChange={e => setOutcomeForm(f => ({ ...f, outcome: e.target.value }))}>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="settled">Settled</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="withdrawn">Withdrawn</option>
                  <option value="transferred">Transferred</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Outcome Notes</label>
                <textarea value={outcomeForm.outcome_notes} onChange={e => setOutcomeForm(f => ({ ...f, outcome_notes: e.target.value }))} rows={3} placeholder="Summary of how the case concluded…" />
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowOutcomeModal(false)} disabled={outcomeSaving}>Cancel</button>
                <button className="btn-primary" onClick={handleOutcomeSubmit} disabled={outcomeSaving}>
                  {outcomeSaving ? 'Closing…' : 'Close Case'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
