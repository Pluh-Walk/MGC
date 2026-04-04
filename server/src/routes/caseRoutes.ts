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
import { getRelations, addRelation, deleteRelation } from '../controllers/relationsController'
import { getCoCounsel, addCoCounsel, removeCoCounsel } from '../controllers/cocounselController'
import { listTags, createTag, deleteTag, getCaseTags, assignTag, removeTag } from '../controllers/tagsController'
import { exportCases, exportCaseDetail } from '../controllers/exportController'
import { authMiddleware, requireRole, requireAttorneyScope } from '../middleware/auth'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Client list (attorneys + secretary — secretary sees only linked attorney's clients)
router.get('/clients', requireRole('attorney', 'secretary'), getClientList)

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

export default router
