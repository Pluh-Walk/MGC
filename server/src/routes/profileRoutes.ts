import { Router } from 'express'
import {
  getMyProfile,
  updateMyProfile,
  getClientProfile,
  updateClientNotes,
} from '../controllers/profileController'
import { authMiddleware, requireRole } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

// Self profile
router.get('/me', getMyProfile)
router.put('/me', updateMyProfile)

// Attorney-only: view/edit a client's profile
router.get('/clients/:id', requireRole('attorney'), getClientProfile)
router.put('/clients/:id', requireRole('attorney'), updateClientNotes)

export default router
