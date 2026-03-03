import { Router } from 'express'
import {
  getHearings,
  createHearing,
  updateHearing,
  deleteHearing,
} from '../controllers/hearingController'
import { authMiddleware, requireRole } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

router.get('/',          getHearings)
router.post('/',         requireRole('attorney'), createHearing)
router.put('/:id',       requireRole('attorney'), updateHearing)
router.delete('/:id',    requireRole('attorney'), deleteHearing)

export default router
