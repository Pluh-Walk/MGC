import { Router } from 'express'
import {
  uploadDocument,
  getCaseDocuments,
  downloadDocument,
  deleteDocument,
} from '../controllers/documentController'
import {
  listDocumentVersions,
  uploadDocumentVersion,
  downloadDocumentVersion,
} from '../controllers/documentVersionController'
import { authMiddleware, requireRole, requireAttorneyScope } from '../middleware/auth'
import upload from '../config/upload'

const router = Router()

// Upload — attorney or secretary
router.post(
  '/cases/:caseId/documents',
  authMiddleware,
  requireRole('attorney', 'secretary'),
  requireAttorneyScope,
  upload.single('file'),
  uploadDocument
)

// List documents for a case — all roles
router.get('/cases/:caseId/documents', authMiddleware, requireAttorneyScope, getCaseDocuments)

// Download a document — all roles (controller enforces visibility)
router.get('/documents/:id/download', authMiddleware, requireAttorneyScope, downloadDocument)

// Soft delete — attorney only
router.delete('/documents/:id', authMiddleware, requireRole('attorney'), deleteDocument)

// ─── Document Versioning ─────────────────────────────────────────────
router.get('/cases/:caseId/documents/:docId/versions',
  authMiddleware, requireAttorneyScope, listDocumentVersions)
router.post('/cases/:caseId/documents/:docId/versions',
  authMiddleware, requireRole('attorney', 'secretary'), requireAttorneyScope,
  upload.single('file'), uploadDocumentVersion)
router.get('/cases/:caseId/documents/:docId/versions/:versionId',
  authMiddleware, requireAttorneyScope, downloadDocumentVersion)

export default router
