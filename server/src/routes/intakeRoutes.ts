import { Router } from 'express'
import multer from 'multer'
import { authMiddleware, requireRole } from '../middleware/auth'
import { intakeUpload } from '../config/upload'
import {
  submitIntake,
  listIntakes,
  getIntake,
  acceptIntake,
  rejectIntake,
  convertIntake,
  withdrawIntake,
  verifyBarangayCert,
} from '../controllers/intakeController'

const router = Router()

// Memory-storage multer for Barangay Certificate OCR (image only, 10 MB)
const certUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only JPEG, PNG, or WebP images are accepted for the certificate.'))
  },
})

router.use(authMiddleware)

// OCR verification of the Barangay Conciliation Certificate (called before form submit)
router.post(
  '/verify-barangay-cert',
  requireRole('client'),
  certUpload.single('cert_image'),
  verifyBarangayCert
)

// Client submits a new intake (up to 10 supporting documents)
router.post(
  '/',
  requireRole('client'),
  intakeUpload.array('attachments', 10),
  submitIntake
)

// List intakes — clients see their own; attorneys/secretaries see their queue
router.get('/', requireRole('client', 'attorney', 'secretary', 'admin'), listIntakes)

// Single intake detail
router.get('/:id', requireRole('client', 'attorney', 'secretary', 'admin'), getIntake)

// Attorney workflow
router.put('/:id/accept',  requireRole('attorney'), acceptIntake)
router.put('/:id/reject',  requireRole('attorney'), rejectIntake)
router.post('/:id/convert', requireRole('attorney'), convertIntake)

// Client withdraws a pending intake
router.delete('/:id', requireRole('client'), withdrawIntake)

export default router
