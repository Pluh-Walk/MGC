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
import { authMiddleware, requireRole } from '../middleware/auth'

const router = Router()

// All routes require authentication
router.use(authMiddleware)

// Client list (attorneys only — used when creating a case)
router.get('/clients', requireRole('attorney'), getClientList)

// Cases CRUD
router.post('/', requireRole('attorney'), createCase)
router.get('/', getCases)                              // both roles
router.get('/:id', getCaseById)                        // both roles
router.put('/:id', requireRole('attorney'), updateCase)
router.delete('/:id', requireRole('attorney'), deleteCase)

// Notes
router.post('/:id/notes', requireRole('attorney'), addNote)

export default router
