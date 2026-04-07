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
  getFinancialReport,
  getWorkloadReport,
  impersonateUser,
  endImpersonation,
  getSuspensionHistory,
  getUserLoginAttempts,
  resetUser2FA,
} from '../controllers/adminController'
import { dsarExport, eraseUserData, getPrivacyNotice } from '../controllers/privacyController'
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
router.post('/users/:id/reset-2fa',    resetUser2FA)
router.post('/users/:id/impersonate',  impersonateUser)
router.post('/impersonation/:logId/end', endImpersonation)

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
router.get('/reports/financial',      getFinancialReport)
router.get('/reports/workload',        getWorkloadReport)

// Data Privacy (RA 10173)
router.get('/privacy/notice',          getPrivacyNotice)
router.get('/privacy/dsar/:userId',   dsarExport)
router.post('/privacy/erase/:userId', eraseUserData)

export default router
