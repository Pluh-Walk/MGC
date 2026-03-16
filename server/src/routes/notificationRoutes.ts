import { Router } from 'express'
import {
  getNotifications,
  markAllRead,
  markOneRead,
  notificationStream,
} from '../controllers/notificationController'
import { authMiddleware, sseVerifyToken, requireAttorneyScope } from '../middleware/auth'

const router = Router()

router.get('/stream', sseVerifyToken, notificationStream) // SSE — uses query-param token
router.use(authMiddleware)
router.use(requireAttorneyScope)

router.get('/', getNotifications)
router.put('/read-all', markAllRead)
router.put('/:id/read', markOneRead)

export default router
