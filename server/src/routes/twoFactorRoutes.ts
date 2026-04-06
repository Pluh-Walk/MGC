import { Router } from 'express'
import {
  setup2FA,
  confirmSetup2FA,
  disable2FA,
  listBackupCodes,
  regenerateBackupCodes,
  get2FAStatus,
} from '../controllers/twoFactorController'
import { verifyToken } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { z } from 'zod'

const router = Router()

// All 2FA routes require authentication
router.use(verifyToken)

const otpSchema     = z.object({ otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits.') })
const disableSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
  otp:      z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits.'),
})

router.get( '/status',                  get2FAStatus)
router.post('/setup',                   setup2FA)
router.post('/confirm-setup',           validate(otpSchema), confirmSetup2FA)
router.post('/disable',                 validate(disableSchema), disable2FA)
router.get( '/backup-codes',            listBackupCodes)
router.post('/regenerate-backup-codes', validate(otpSchema), regenerateBackupCodes)

export default router
