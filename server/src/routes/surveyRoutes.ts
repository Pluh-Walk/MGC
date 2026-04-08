import { Router } from 'express'
import {
  getSurveyByToken,
  submitSurvey,
  listSurveysAdmin,
  listSurveysAttorney,
} from '../controllers/surveyController'
import { authMiddleware, requireRole } from '../middleware/auth'

const router = Router()

// Public routes (no auth — accessed via emailed link)
router.get('/:token',  getSurveyByToken)
router.post('/:token', submitSurvey)

// Authenticated routes
router.get('/', authMiddleware, requireRole('attorney', 'secretary'), listSurveysAttorney)

export default router
