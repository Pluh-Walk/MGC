import { Router } from 'express'
import { authMiddleware, requireRole } from '../middleware/auth'
import { getAttorneyReviews, getMyReview, submitReview, deleteReview } from '../controllers/reviewController'

const router = Router()

router.use(authMiddleware)

router.get('/attorneys/:id',       getAttorneyReviews)                          // any auth
router.get('/attorneys/:id/mine',  requireRole('client'), getMyReview)          // client only
router.post('/attorneys/:id',      requireRole('client'), submitReview)         // client only
router.delete('/attorneys/:id',    requireRole('client'), deleteReview)         // client only

export default router
