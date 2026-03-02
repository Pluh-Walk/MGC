import { Router } from 'express'
import { register, login, getMe } from '../controllers/authController'
import { verifyToken } from '../middleware/auth'

const router = Router()

// Public
router.post('/register', register)
router.post('/login', login)

// Protected
router.get('/me', verifyToken, getMe)

export default router
