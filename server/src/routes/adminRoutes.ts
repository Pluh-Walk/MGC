import { Router } from 'express'
import {
  listUsers,
  getUserDetail,
  createUser,
  updateUser,
  suspendUser,
  reactivateUser,
  resetUserPassword,
  deleteUser,
  getVerificationQueue,
  handleVerification,
  getAllCases,
  reassignCase,
  forceArchiveCase,
  getDashboardStats,
  getUserReport,
  getCaseReport,
  getSuspensionHistory,
  getUserLoginAttempts,
} from '../controllers/adminController'
import { authMiddleware, requireRole } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)
router.use(requireRole('admin'))

// Dashboard
router.get('/dashboard', getDashboardStats)

// User management
router.get('/users',                  listUsers)
router.post('/users',                 createUser)
router.get('/users/:id',              getUserDetail)
router.put('/users/:id',              updateUser)
router.put('/users/:id/suspend',      suspendUser)
router.put('/users/:id/reactivate',   reactivateUser)
router.put('/users/:id/reset-password', resetUserPassword)
router.delete('/users/:id',           deleteUser)
router.get('/users/:id/suspensions',  getSuspensionHistory)
router.get('/users/:id/login-attempts', getUserLoginAttempts)

// Verification
router.get('/verifications',          getVerificationQueue)
router.put('/verifications/:id',      handleVerification)

// Cases
router.get('/cases',                  getAllCases)
router.put('/cases/:id/reassign',     reassignCase)
router.put('/cases/:id/archive',      forceArchiveCase)

// Reports
router.get('/reports/users',          getUserReport)
router.get('/reports/cases',          getCaseReport)

export default router
