import { Router } from 'express'
import {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} from '../controllers/announcementController'
import { authMiddleware, requireRole, requireAttorneyScope } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createAnnouncementSchema } from '../validators/schemas'

const router = Router()

router.use(authMiddleware)
router.use(requireAttorneyScope)

router.get('/',    getAnnouncements)
router.post('/',   requireRole('attorney', 'admin', 'secretary'), validate(createAnnouncementSchema), createAnnouncement)
router.delete('/:id', requireRole('attorney', 'admin'), deleteAnnouncement)

export default router
