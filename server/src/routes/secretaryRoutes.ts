import { Router } from 'express'
import {
  inviteSecretary,
  validateInvitation,
  registerSecretary,
  listSecretaries,
  getSecretaryById,
  getLinkedAttorneyInfo,
  removeSecretary,
  revokeInvitation,
} from '../controllers/secretaryController'
import { authMiddleware, requireRole } from '../middleware/auth'

const router = Router()

// Public — invitation validation & registration
router.get('/invite/validate', validateInvitation)
router.post('/register', registerSecretary)

// Protected — attorney-only management
router.use(authMiddleware)
router.post('/invite', requireRole('attorney'), inviteSecretary)
router.get('/', requireRole('attorney'), listSecretaries)
router.get('/attorney-info', requireRole('secretary'), getLinkedAttorneyInfo)
router.get('/:id', requireRole('attorney'), getSecretaryById)
router.put('/:id/remove', requireRole('attorney'), removeSecretary)
router.delete('/invite/:id', requireRole('attorney'), revokeInvitation)

export default router
