import { Router } from 'express'
import {
  getAllSettings,
  getSetting,
  updateSetting,
  bulkUpdateSettings,
} from '../controllers/settingsController'
import { authMiddleware, requireRole } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)
router.use(requireRole('admin'))

router.get('/',          getAllSettings)
router.get('/:key',      getSetting)
router.put('/:key',      updateSetting)
router.put('/',          bulkUpdateSettings)

export default router
