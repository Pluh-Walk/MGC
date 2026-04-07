import { Router } from 'express'
import { requestReset, resetPassword } from '../controllers/passwordResetController'
import { validate } from '../middleware/validate'
import { forgotPasswordSchema, resetPasswordSchema } from '../validators/schemas'

const router = Router()

router.post('/request', validate(forgotPasswordSchema), requestReset)
router.post('/reset',   validate(resetPasswordSchema),  resetPassword)

export default router
