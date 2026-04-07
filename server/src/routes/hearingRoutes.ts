import { Router } from 'express'
import {
  getHearings,
  createHearing,
  updateHearing,
  deleteHearing,
} from '../controllers/hearingController'
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

export default router
