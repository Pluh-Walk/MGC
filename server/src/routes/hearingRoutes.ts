import { Router } from 'express'
import {
  getHearings,
  createHearing,
  updateHearing,
  deleteHearing,
} from '../controllers/hearingController'
import { authMiddleware, requireRole, requireAttorneyScope } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

router.get('/',          requireRole('attorney', 'client', 'admin', 'secretary'), requireAttorneyScope, getHearings)
router.post('/',         requireRole('attorney', 'secretary'), requireAttorneyScope, createHearing)
router.put('/:id',       requireRole('attorney', 'secretary'), requireAttorneyScope, updateHearing)
router.delete('/:id',    requireRole('attorney'), deleteHearing)

export default router
