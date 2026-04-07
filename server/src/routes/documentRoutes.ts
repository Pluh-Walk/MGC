import { Router } from 'express'
import {
  uploadDocument,
  getCaseDocuments,
  downloadDocument,
  deleteDocument,
  exportPrivilegeLog,
  bulkDeleteDocuments,
  bulkDownloadDocuments,
} from '../controllers/documentController'
import {
  listDocumentVersions,
  uploadDocumentVersion,
  downloadDocumentVersion,
} from '../controllers/documentVersionController'
import {
  issueDocumentToken,
  issueVersionToken,
  downloadByToken,
} from '../controllers/downloadTokenController'
import { authMiddleware, requireRole, requireAttorneyScope } from '../middleware/auth'
import upload from '../config/upload'

const router = Router()

// ─── Signed download tokens (no auth — token IS the credential) ─────────────
router.get('/documents/by-token/:token', downloadByToken)

// Upload — attorney, secretary, or client (client can upload their own supporting docs)
router.post(
  '/cases/:caseId/documents',
  authMiddleware,
  requireRole('attorney', 'secretary', 'client'),
  requireAttorneyScope,
  (req: any, res: any, next: any) => {
    upload.single('file')(req, res, (err: any) => {
      if (err) {
        // MulterError (LIMIT_FILE_SIZE etc.) or unexpected stream errors
        return res.status(400).json({
          success: false,
          message: err.code === 'LIMIT_FILE_SIZE'
            ? `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 20} MB.`
            : err.message || 'File upload failed.',
        })
      }
      next()
    })
  },
  uploadDocument
)

// List documents for a case — all roles
router.get('/cases/:caseId/documents', authMiddleware, requireAttorneyScope, getCaseDocuments)

// Privilege log export — attorney/secretary/admin only
router.get('/cases/:caseId/documents/privilege-log', authMiddleware, requireRole('attorney', 'secretary', 'admin'), requireAttorneyScope, exportPrivilegeLog)

// Bulk download (zip) — attorney/secretary/admin
router.get('/cases/:caseId/documents/bulk-download', authMiddleware, requireRole('attorney', 'secretary', 'admin'), requireAttorneyScope, bulkDownloadDocuments)

// Bulk delete — attorney only
router.delete('/cases/:caseId/documents/bulk', authMiddleware, requireRole('attorney'), requireAttorneyScope, bulkDeleteDocuments)

// Download a document — all roles (controller enforces visibility)
router.get('/documents/:id/download', authMiddleware, requireAttorneyScope, downloadDocument)

// Issue a time-limited single-use download token
router.post('/documents/:id/token', authMiddleware, issueDocumentToken)

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

// Issue a download token for a specific version
router.post('/cases/:caseId/documents/:docId/versions/:versionId/token',
  authMiddleware, issueVersionToken)

export default router
