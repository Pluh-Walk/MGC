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

// Upload — attorney only
router.post(
  '/cases/:caseId/documents',
  authMiddleware,
  requireRole('attorney'),
  upload.single('file'),
  uploadDocument
)

// List documents for a case — both roles
router.get('/cases/:caseId/documents', authMiddleware, getCaseDocuments)

// Download a document — both roles (controller enforces visibility)
router.get('/documents/:id/download', authMiddleware, downloadDocument)

// Soft delete — attorney only
router.delete('/documents/:id', authMiddleware, requireRole('attorney'), deleteDocument)

export default router
