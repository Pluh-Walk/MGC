import { Router } from 'express'
import {
  createCase,
  getCases,
  getCaseById,
  updateCase,
  deleteCase,
  addNote,
  getClientList,
  getCaseDrafts,
  approveCaseDraft,
} from '../controllers/caseController'
import { getParties, addParty, updateParty, deleteParty } from '../controllers/partiesController'
import {
  getDeadlines, createDeadline, updateDeadline, completeDeadline, deleteDeadline,
  getDeadlineSummary,
} from '../controllers/deadlinesController'
import { getBillingEntries, addBillingEntry, updateBillingEntry, deleteBillingEntry } from '../controllers/billingController'
import {
  createInvoice, listInvoices, getInvoice, downloadInvoicePdf, sendInvoice, markInvoicePaid, voidInvoice,
} from '../controllers/invoiceController'
import { getRelations, addRelation, deleteRelation } from '../controllers/relationsController'
import { getCoCounsel, addCoCounsel, removeCoCounsel } from '../controllers/cocounselController'
import { listTags, createTag, deleteTag, getCaseTags, assignTag, removeTag } from '../controllers/tagsController'
import { exportCases, exportCaseDetail } from '../controllers/exportController'
import { runConflictCheck, acknowledgeConflict } from '../controllers/conflictController'
import {
  listTimeEntries, createTimeEntry, updateTimeEntry,
  deleteTimeEntry, convertToBilling, getTimeSummary,
} from '../controllers/timeTrackingController'
import { authMiddleware, requireRole, requireAttorneyScope } from '../middleware/auth'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Client list (attorneys + secretary — secretary sees only linked attorney's clients)
router.get('/clients', requireRole('attorney', 'secretary'), getClientList)

// Conflict of interest check (before case creation)
router.get('/conflict-check', requireRole('attorney', 'secretary', 'admin'), runConflictCheck)

// Tags (global — not case-scoped)
router.get('/tags',          requireRole('attorney', 'secretary', 'admin'), listTags)
router.post('/tags',         requireRole('attorney', 'secretary', 'admin'), createTag)
router.delete('/tags/:tagId', requireRole('attorney', 'admin'), deleteTag)

// Deadline summary for dashboard
router.get('/deadlines/summary', requireRole('attorney', 'secretary'), requireAttorneyScope, getDeadlineSummary)

// Export case list as CSV
router.get('/export', requireRole('attorney', 'secretary', 'admin'), exportCases)

// Cases CRUD
router.post('/', requireRole('attorney', 'secretary'), createCase)
router.get('/drafts', requireRole('attorney', 'secretary'), requireAttorneyScope, getCaseDrafts)
router.get('/', requireRole('attorney', 'client', 'admin', 'secretary'), requireAttorneyScope, getCases)
router.get('/:id', requireRole('attorney', 'client', 'admin', 'secretary'), requireAttorneyScope, getCaseById)
router.put('/:id/approve', requireRole('attorney'), approveCaseDraft)
router.put('/:id', requireRole('attorney', 'secretary'), requireAttorneyScope, updateCase)
router.delete('/:id', requireRole('attorney'), deleteCase)

// Notes (attorney + secretary)
router.post('/:id/notes', requireRole('attorney', 'secretary'), requireAttorneyScope, addNote)

// Export single case detail as HTML (print to PDF)
router.get('/:caseId/export', requireRole('attorney', 'client', 'admin', 'secretary'), requireAttorneyScope, exportCaseDetail)

// ─── Parties ──────────────────────────────────────────────────
router.get('/:caseId/parties', requireRole('attorney', 'client', 'secretary'), getParties)
router.post('/:caseId/parties', requireRole('attorney', 'secretary'), requireAttorneyScope, addParty)
router.put('/:caseId/parties/:partyId', requireRole('attorney', 'secretary'), requireAttorneyScope, updateParty)
router.delete('/:caseId/parties/:partyId', requireRole('attorney', 'secretary'), requireAttorneyScope, deleteParty)

// ─── Deadlines ────────────────────────────────────────────────
router.get('/:caseId/deadlines', requireRole('attorney', 'client', 'secretary'), getDeadlines)
router.post('/:caseId/deadlines', requireRole('attorney', 'secretary'), requireAttorneyScope, createDeadline)
router.put('/:caseId/deadlines/:deadlineId', requireRole('attorney', 'secretary'), requireAttorneyScope, updateDeadline)
router.put('/:caseId/deadlines/:deadlineId/complete', requireRole('attorney', 'secretary'), requireAttorneyScope, completeDeadline)
router.delete('/:caseId/deadlines/:deadlineId', requireRole('attorney'), deleteDeadline)

// ─── Billing ──────────────────────────────────────────────────
router.get('/:caseId/billing', requireRole('attorney', 'client', 'secretary', 'admin'), getBillingEntries)
router.post('/:caseId/billing', requireRole('attorney', 'secretary'), requireAttorneyScope, addBillingEntry)
router.patch('/:caseId/billing/:entryId', requireRole('attorney', 'secretary'), requireAttorneyScope, updateBillingEntry)
router.delete('/:caseId/billing/:entryId', requireRole('attorney'), deleteBillingEntry)

// ─── Related Cases ────────────────────────────────────────────
router.get('/:caseId/relations', requireRole('attorney', 'client', 'secretary', 'admin'), getRelations)
router.post('/:caseId/relations', requireRole('attorney', 'secretary'), requireAttorneyScope, addRelation)
router.delete('/:caseId/relations/:relationId', requireRole('attorney', 'secretary'), requireAttorneyScope, deleteRelation)

// ─── Co-Counsel ───────────────────────────────────────────────
router.get('/:caseId/cocounsel', requireRole('attorney', 'client', 'secretary', 'admin'), getCoCounsel)
router.post('/:caseId/cocounsel', requireRole('attorney', 'admin'), addCoCounsel)
router.delete('/:caseId/cocounsel/:entryId', requireRole('attorney', 'admin'), removeCoCounsel)

// ─── Tags (case-scoped) ───────────────────────────────────────
router.get('/:caseId/tags', requireRole('attorney', 'client', 'secretary', 'admin'), getCaseTags)
router.post('/:caseId/tags', requireRole('attorney', 'secretary'), requireAttorneyScope, assignTag)
router.delete('/:caseId/tags/:tagId', requireRole('attorney', 'secretary'), requireAttorneyScope, removeTag)

// ─── Invoices ─────────────────────────────────────────────────
router.post('/:caseId/invoices',                     requireRole('attorney', 'secretary'),                     requireAttorneyScope, createInvoice)
router.get('/:caseId/invoices',                      requireRole('attorney', 'client', 'secretary', 'admin'),                       listInvoices)
router.get('/:caseId/invoices/:invoiceId',           requireRole('attorney', 'client', 'secretary', 'admin'),                       getInvoice)
router.get('/:caseId/invoices/:invoiceId/pdf',       requireRole('attorney', 'client', 'secretary', 'admin'),                       downloadInvoicePdf)
router.post('/:caseId/invoices/:invoiceId/send',     requireRole('attorney', 'secretary'),                     requireAttorneyScope, sendInvoice)
router.post('/:caseId/invoices/:invoiceId/pay',      requireRole('attorney', 'secretary'),                     requireAttorneyScope, markInvoicePaid)
router.put('/:caseId/invoices/:invoiceId/void',      requireRole('attorney', 'admin'),                                              voidInvoice)

// ─── Conflict of Interest Acknowledgment ──────────────────────
router.post('/:caseId/conflict-check/acknowledge', requireRole('attorney', 'admin'), acknowledgeConflict)

// ─── Time Tracking ────────────────────────────────────────────
router.get('/:caseId/time/summary',            requireRole('attorney', 'secretary', 'admin'), getTimeSummary)
router.get('/:caseId/time',                    requireRole('attorney', 'secretary', 'admin'), listTimeEntries)
router.post('/:caseId/time',                   requireRole('attorney', 'secretary'),          requireAttorneyScope, createTimeEntry)
router.patch('/:caseId/time/:entryId',         requireRole('attorney', 'secretary'),          requireAttorneyScope, updateTimeEntry)
router.delete('/:caseId/time/:entryId',        requireRole('attorney', 'admin'),                                    deleteTimeEntry)
router.post('/:caseId/time/:entryId/bill',     requireRole('attorney', 'secretary'),          requireAttorneyScope, convertToBilling)

export default router
