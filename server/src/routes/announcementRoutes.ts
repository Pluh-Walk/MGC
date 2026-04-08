import { Router } from 'express'
import {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  acknowledgeAnnouncement,
  getAcknowledgmentStatus,
  listAcknowledgments,
} from '../controllers/announcementController'
import { authMiddleware, requireRole, requireAttorneyScope } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createAnnouncementSchema } from '../validators/schemas'

const router = Router()

router.use(authMiddleware)
router.use(requireAttorneyScope)

router.get('/',       getAnnouncements)
router.post('/',      requireRole('attorney', 'admin', 'secretary'), validate(createAnnouncementSchema), createAnnouncement)
router.delete('/:id', requireRole('attorney', 'admin'), deleteAnnouncement)

// ── Acknowledgment ──────────────────────────────────────────────
router.post('/:id/acknowledge',         acknowledgeAnnouncement)
router.get('/acknowledgment-status',    getAcknowledgmentStatus)
router.get('/:id/acknowledgments',      requireRole('admin', 'attorney'), listAcknowledgments)

export default router
