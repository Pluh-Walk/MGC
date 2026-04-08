import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import sanitizeFilename from 'sanitize-filename'
import { authMiddleware, requireRole } from '../middleware/auth'
import {
  listTemplates, uploadTemplate, downloadTemplate,
  updateTemplate, deleteTemplate,
} from '../controllers/templateController'

const router = Router()

// ─── Templates-specific multer (saves under uploads/templates/) ──
const templateStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'templates')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const safe = sanitizeFilename(path.basename(file.originalname), { replacement: '_' })
      .replace(/\s+/g, '_').replace(/[^\w.\-]/g, '_').slice(0, 200) || 'template'
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`)
  },
})

const TEMPLATE_ALLOWED = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

const templateUpload = multer({
  storage: templateStorage,
  fileFilter: (_req, file, cb) => {
    TEMPLATE_ALLOWED.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Templates must be PDF, Word, or Excel files.'))
  },
  limits: { fileSize: 20 * 1024 * 1024 },
})

// ─── Routes ──────────────────────────────────────────────────────
router.use(authMiddleware)

router.get(
  '/',
  requireRole('attorney', 'secretary', 'admin'),
  listTemplates
)

router.post(
  '/',
  requireRole('attorney', 'admin'),
  templateUpload.single('file'),
  (req, res, next) => {
    // Multer errors show as nice 400s
    uploadTemplate(req, res).catch(next)
  }
)

router.get(
  '/:id/download',
  requireRole('attorney', 'secretary', 'admin'),
  downloadTemplate
)

router.put(
  '/:id',
  requireRole('attorney', 'admin'),
  updateTemplate
)

router.delete(
  '/:id',
  requireRole('attorney', 'admin'),
  deleteTemplate
)

export default router
