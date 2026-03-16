import { Router } from 'express'
import {
  getAuditLogs,
  exportAuditLogs,
  getAuditStats,
} from '../controllers/auditController'
import { authMiddleware, requireRole } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)
router.use(requireRole('admin'))

router.get('/',         getAuditLogs)
router.get('/export',   exportAuditLogs)
router.get('/stats',    getAuditStats)

export default router
