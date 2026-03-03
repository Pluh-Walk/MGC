import { Router } from 'express'
import {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} from '../controllers/announcementController'
import { authMiddleware, requireRole } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

router.get('/',    getAnnouncements)
router.post('/',   requireRole('attorney'), createAnnouncement)
router.delete('/:id', requireRole('attorney'), deleteAnnouncement)

export default router
