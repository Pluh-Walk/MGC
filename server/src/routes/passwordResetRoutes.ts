import { Router } from 'express'
import { requestReset, resetPassword } from '../controllers/passwordResetController'

const router = Router()

router.post('/request', requestReset)
router.post('/reset', resetPassword)

export default router
