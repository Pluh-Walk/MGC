import { Router } from 'express'
import {
  createCase,
  getCases,
  getCaseById,
  updateCase,
  deleteCase,
  addNote,
  getClientList,
} from '../controllers/caseController'
import { authMiddleware, requireRole, requireAttorneyScope } from '../middleware/auth'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Client list (attorneys only — used when creating a case)
router.get('/clients', requireRole('attorney'), getClientList)

// Cases CRUD
router.post('/', requireRole('attorney'), createCase)
router.get('/', requireRole('attorney', 'client', 'admin', 'secretary'), requireAttorneyScope, getCases)
router.get('/:id', requireRole('attorney', 'client', 'admin', 'secretary'), requireAttorneyScope, getCaseById)
router.put('/:id', requireRole('attorney', 'secretary'), requireAttorneyScope, updateCase)
router.delete('/:id', requireRole('attorney'), deleteCase)

// Notes (attorney + secretary)
router.post('/:id/notes', requireRole('attorney', 'secretary'), requireAttorneyScope, addNote)

export default router
