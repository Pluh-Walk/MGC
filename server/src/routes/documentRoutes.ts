import { Router } from 'express'
import {
  uploadDocument,
  getCaseDocuments,
  downloadDocument,
  deleteDocument,
} from '../controllers/documentController'
import { authMiddleware, requireRole } from '../middleware/auth'
import upload from '../config/upload'

const router = Router()

router.use(authMiddleware)

// Upload — attorney only
router.post(
  '/cases/:caseId/documents',
  requireRole('attorney'),
  upload.single('file'),
  uploadDocument
)

// List documents for a case — both roles
router.get('/cases/:caseId/documents', getCaseDocuments)

// Download a document — both roles (controller enforces visibility)
router.get('/documents/:id/download', downloadDocument)

// Soft delete — attorney only
router.delete('/documents/:id', requireRole('attorney'), deleteDocument)

export default router
