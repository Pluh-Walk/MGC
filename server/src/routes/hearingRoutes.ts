import { Router } from 'express'
import {
  getHearings,
  createHearing,
  updateHearing,
  deleteHearing,
} from '../controllers/hearingController'
import {
  getChecklist,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
} from '../controllers/hearingChecklistController'
import { exportIcal } from '../controllers/icalController'
import { authMiddleware, requireRole, requireAttorneyScope } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createHearingSchema, updateHearingSchema } from '../validators/schemas'

const router = Router()

router.use(authMiddleware)

router.get('/export/ical', requireRole('attorney', 'client', 'admin', 'secretary'), requireAttorneyScope, exportIcal)
router.get('/',            requireRole('attorney', 'client', 'admin', 'secretary'), requireAttorneyScope, getHearings)
router.post('/',           requireRole('attorney', 'secretary'), requireAttorneyScope, validate(createHearingSchema), createHearing)
router.put('/:id',         requireRole('attorney', 'secretary'), requireAttorneyScope, validate(updateHearingSchema), updateHearing)
router.delete('/:id',      requireRole('attorney'), deleteHearing)

// ── Hearing Preparation Checklist ──────────────────────────────
router.get('/:hearingId/checklist',                   requireRole('attorney', 'client', 'admin', 'secretary'), getChecklist)
router.post('/:hearingId/checklist',                  requireRole('attorney', 'secretary'), addChecklistItem)
router.patch('/:hearingId/checklist/:itemId/toggle',  requireRole('attorney', 'secretary'), toggleChecklistItem)
router.delete('/:hearingId/checklist/:itemId',        requireRole('attorney', 'secretary'), deleteChecklistItem)

export default router
