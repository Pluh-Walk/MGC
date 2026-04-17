import { Router } from 'express'
import { receiptUpload } from '../config/upload'
import {
  createCase,
  getCases,
  getCaseById,
  updateCase,
  deleteCase,
  addNote, deleteNote,
  getClientList,
  getCaseDrafts,
  approveCaseDraft,
  placeLegalHold,
  liftLegalHold,
} from '../controllers/caseController'
import { getParties, addParty, updateParty, deleteParty } from '../controllers/partiesController'
import {
  getDeadlines, createDeadline, updateDeadline, completeDeadline, deleteDeadline,
  getDeadlineSummary, acknowledgeSolDeadline,
} from '../controllers/deadlinesController'
import { getTasks, createTask, updateTask, completeTask, deleteTask, getMyTasks } from '../controllers/tasksController'
import { getStageTemplates, getCaseStages, initCaseStages, advanceCaseStage, updateCaseStage } from '../controllers/stagesController'
import { getBillingEntries, addBillingEntry, updateBillingEntry, deleteBillingEntry, getRetainerSummary, exportRetainerStatement, uploadExpenseReceipt } from '../controllers/billingController'
import {
  createInvoice, listInvoices, getInvoice, downloadInvoicePdf, sendInvoice, markInvoicePaid, voidInvoice, downloadReceipt,
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
import { validate } from '../middleware/validate'
import {
  createCaseSchema, updateCaseSchema, addNoteSchema,
  addBillingSchema, updateBillingSchema,
  createDeadlineSchema, updateDeadlineSchema,
  createTaskSchema, updateTaskSchema,
  addPartySchema, createTagSchema, createTimeEntrySchema,
} from '../validators/schemas'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Client list (attorneys + secretary — secretary sees only linked attorney's clients)
router.get('/clients', requireRole('attorney', 'secretary'), getClientList)

// Conflict of interest check (before case creation)
router.get('/conflict-check', requireRole('attorney', 'secretary', 'admin'), runConflictCheck)

// Task Management — global (mine)
router.get('/tasks/mine', requireRole('attorney', 'secretary'), requireAttorneyScope, getMyTasks)

// Stage templates (global reference)
router.get('/stages/templates', requireRole('attorney', 'secretary', 'admin', 'client'), getStageTemplates)

// Tags (global — not case-scoped)
router.get('/tags',          requireRole('attorney', 'secretary', 'admin'), listTags)
router.post('/tags',         requireRole('attorney', 'secretary', 'admin'), validate(createTagSchema), createTag)
router.delete('/tags/:tagId', requireRole('attorney', 'admin'), deleteTag)

// Deadline summary for dashboard
router.get('/deadlines/summary', requireRole('attorney', 'secretary'), requireAttorneyScope, getDeadlineSummary)

// Export case list as CSV
router.get('/export', requireRole('attorney', 'secretary', 'admin'), exportCases)

// Cases CRUD
router.post('/', requireRole('attorney', 'secretary'), validate(createCaseSchema), createCase)
router.get('/drafts', requireRole('attorney', 'secretary'), requireAttorneyScope, getCaseDrafts)
router.get('/', requireRole('attorney', 'client', 'admin', 'secretary'), requireAttorneyScope, getCases)
router.get('/:id', requireRole('attorney', 'client', 'admin', 'secretary'), requireAttorneyScope, getCaseById)
router.put('/:id/approve', requireRole('attorney'), approveCaseDraft)
router.put('/:id', requireRole('attorney', 'secretary'), requireAttorneyScope, validate(updateCaseSchema), updateCase)
router.delete('/:id', requireRole('attorney'), deleteCase)

// Legal hold (attorney + admin)
router.post('/:id/legal-hold', requireRole('attorney', 'admin'), placeLegalHold)
router.delete('/:id/legal-hold', requireRole('attorney', 'admin'), liftLegalHold)

// Notes (attorney + secretary)
router.post('/:id/notes', requireRole('attorney', 'secretary'), requireAttorneyScope, validate(addNoteSchema), addNote)
router.delete('/:id/notes/:noteId', requireRole('attorney', 'secretary'), requireAttorneyScope, deleteNote)

// Export single case detail as HTML (print to PDF)
router.get('/:caseId/export', requireRole('attorney', 'client', 'admin', 'secretary'), requireAttorneyScope, exportCaseDetail)

// ─── Parties ──────────────────────────────────────────────────
router.get('/:caseId/parties', requireRole('attorney', 'client', 'secretary'), getParties)
router.post('/:caseId/parties', requireRole('attorney', 'secretary'), requireAttorneyScope, validate(addPartySchema), addParty)
router.put('/:caseId/parties/:partyId', requireRole('attorney', 'secretary'), requireAttorneyScope, updateParty)
router.delete('/:caseId/parties/:partyId', requireRole('attorney', 'secretary'), requireAttorneyScope, deleteParty)

// ─── Deadlines ────────────────────────────────────────────────
router.get('/:caseId/deadlines', requireRole('attorney', 'client', 'secretary'), getDeadlines)
router.post('/:caseId/deadlines', requireRole('attorney', 'secretary'), requireAttorneyScope, validate(createDeadlineSchema), createDeadline)
router.put('/:caseId/deadlines/:deadlineId', requireRole('attorney', 'secretary'), requireAttorneyScope, validate(updateDeadlineSchema), updateDeadline)
router.put('/:caseId/deadlines/:deadlineId/complete', requireRole('attorney', 'secretary'), requireAttorneyScope, completeDeadline)
router.post('/:caseId/deadlines/:deadlineId/sol-acknowledge', requireRole('attorney', 'secretary'), requireAttorneyScope, acknowledgeSolDeadline)
router.delete('/:caseId/deadlines/:deadlineId', requireRole('attorney'), deleteDeadline)

// ─── Billing ──────────────────────────────────────────────────
router.get('/:caseId/billing/retainer/statement', requireRole('attorney', 'client', 'secretary', 'admin'), exportRetainerStatement)
router.get('/:caseId/billing/retainer', requireRole('attorney', 'client', 'secretary', 'admin'), getRetainerSummary)
router.get('/:caseId/billing', requireRole('attorney', 'client', 'secretary', 'admin'), getBillingEntries)
router.post('/:caseId/billing', requireRole('attorney', 'secretary'), requireAttorneyScope, validate(addBillingSchema), addBillingEntry)
router.patch('/:caseId/billing/:entryId', requireRole('attorney', 'secretary'), requireAttorneyScope, validate(updateBillingSchema), updateBillingEntry)
router.put('/:caseId/billing/:entryId/receipt', requireRole('attorney', 'secretary'), requireAttorneyScope, receiptUpload.single('receipt'), uploadExpenseReceipt)
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
router.get('/:caseId/invoices/:invoiceId/receipt',   requireRole('attorney', 'client', 'secretary', 'admin'),                       downloadReceipt)
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

// ─── Tasks ────────────────────────────────────────────────────
router.get('/:caseId/tasks',              requireRole('attorney', 'client', 'secretary', 'admin'),   getTasks)
router.post('/:caseId/tasks',             requireRole('attorney', 'secretary'), requireAttorneyScope, validate(createTaskSchema), createTask)
router.put('/:caseId/tasks/:taskId',      requireRole('attorney', 'secretary'), requireAttorneyScope, validate(updateTaskSchema), updateTask)
router.post('/:caseId/tasks/:taskId/complete', requireRole('attorney', 'secretary'), requireAttorneyScope, completeTask)
router.delete('/:caseId/tasks/:taskId',   requireRole('attorney', 'secretary'), requireAttorneyScope, deleteTask)

// ─── Stages (Case Progress Workflow) ─────────────────────────
router.get('/:caseId/stages',                             requireRole('attorney', 'client', 'secretary', 'admin'),   getCaseStages)
router.post('/:caseId/stages/init',                       requireRole('attorney', 'secretary'), requireAttorneyScope, initCaseStages)
router.put('/:caseId/stages/:stageId/advance',            requireRole('attorney', 'secretary'), requireAttorneyScope, advanceCaseStage)
router.put('/:caseId/stages/:stageId',                    requireRole('attorney', 'secretary'), requireAttorneyScope, updateCaseStage)

export default router
