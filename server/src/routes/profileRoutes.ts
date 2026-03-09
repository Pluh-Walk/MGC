import { Router } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import {
  getMyProfile,
  updateMyProfile,
  getClientProfile,
  getClientCases,
  updateClientNotes,
  getAttorneyStats,
  getAttorneyActivity,
  changePassword,
  uploadProfilePhoto,
  serveProfilePhoto,
  getClientStats,
  getClientActivity,
  getClientDocuments,
  clientUploadDocument,
  getAttorneyPublicProfile,
  getAttorneyPublicStats,
  listAttorneys,
} from '../controllers/profileController'
import { authMiddleware, requireRole } from '../middleware/auth'

const router = Router()

// Photo upload storage
const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'profiles')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e5)}${ext}`)
  },
})
const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only JPEG, PNG, or WebP images accepted.'))
  },
})

// Client document upload storage
const clientDocStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'client_docs')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`)
  },
})
const clientDocUpload = multer({
  storage: clientDocStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ALLOWED = [
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (ALLOWED.includes(file.mimetype)) cb(null, true)
    else cb(new Error('File type not allowed.'))
  },
})

// Public: serve profile photo
router.get('/photo/:userId', serveProfilePhoto)

router.use(authMiddleware)

// Self profile
router.get('/me', getMyProfile)
router.put('/me', updateMyProfile)
router.put('/password', changePassword)
router.post('/photo', photoUpload.single('photo'), uploadProfilePhoto)

// Attorney stats & activity
router.get('/attorney/stats',    requireRole('attorney'), getAttorneyStats)
router.get('/attorney/activity', requireRole('attorney'), getAttorneyActivity)

// Client stats, activity, documents
router.get('/client/stats',     requireRole('client'), getClientStats)
router.get('/client/activity',  requireRole('client'), getClientActivity)
router.get('/client/documents', requireRole('client'), getClientDocuments)
router.post('/client/documents', requireRole('client'), clientDocUpload.single('file'), clientUploadDocument)

// Client: browse all verified attorneys
router.get('/attorneys', requireRole('client'), listAttorneys)
// Client: view attorney public stats
router.get('/attorneys/:id/stats', requireRole('client'), getAttorneyPublicStats)
// Client: view assigned attorney's public profile
router.get('/attorneys/:id', requireRole('client'), getAttorneyPublicProfile)

// Attorney-only: view/edit a client's profile
router.get('/clients/:id',        requireRole('attorney'), getClientProfile)
router.get('/clients/:id/cases',  requireRole('attorney'), getClientCases)
router.put('/clients/:id',        requireRole('attorney'), updateClientNotes)

export default router
