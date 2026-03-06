import { Router } from 'express'
import multer from 'multer'
import { register, login, getMe, verifyIBP, verifyClientID } from '../controllers/authController'
import { verifyToken } from '../middleware/auth'

const router = Router()

// Memory-storage multer for image uploads
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only JPEG, PNG, or WebP images are accepted.'))
  },
})

// Public
router.post('/register', register)
router.post('/login', login)
router.post('/verify-ibp', imageUpload.single('ibp_card'), verifyIBP)
router.post('/verify-client-id', imageUpload.single('id_image'), verifyClientID)

// Protected
router.get('/me', verifyToken, getMe)

export default router
