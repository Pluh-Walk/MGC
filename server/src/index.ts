// ─── Env validation must run before anything else ─────────
import dotenv from 'dotenv'
dotenv.config()
import './config/env'

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import hpp from 'hpp'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import path from 'path'
import os from 'os'
import logger from './config/logger'
import { maintenanceGuard } from './middleware/maintenance'
import authRoutes from './routes/authRoutes'
import caseRoutes from './routes/caseRoutes'
import profileRoutes from './routes/profileRoutes'
import documentRoutes from './routes/documentRoutes'
import notificationRoutes from './routes/notificationRoutes'
import passwordResetRoutes from './routes/passwordResetRoutes'
import hearingRoutes from './routes/hearingRoutes'
import announcementRoutes from './routes/announcementRoutes'
import messageRoutes from './routes/messageRoutes'
import reviewRoutes from './routes/reviewRoutes'
import secretaryRoutes from './routes/secretaryRoutes'
import adminRoutes from './routes/adminRoutes'
import settingsRoutes from './routes/settingsRoutes'
import auditRoutes from './routes/auditRoutes'
import twoFactorRoutes from './routes/twoFactorRoutes'
import templateRoutes from './routes/templateRoutes'
import { globalSearch } from './controllers/searchController'
import { startDeadlineReminder } from './scripts/deadlineReminder'
import { startHearingReminder } from './scripts/hearingReminder'
import { startDbBackup } from './scripts/dbBackup'
import { createServer } from 'http'
import { initSocket } from './socket'
import pool from './config/db'

const app = express()
const PORT = process.env.PORT || 5000
const startTime = Date.now()

// ─── Security Headers (helmet) ────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))

// ─── Middleware ────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(hpp())

// ─── Request logging (skip /api/health to reduce noise) ──
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path !== '/api/health') {
    logger.info(`${req.method} ${req.path}`, { ip: req.ip })
  }
  next()
})

// ─── Rate Limiting ────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
})

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many reset requests. Please wait an hour.' },
})

// ─── Static Uploads ───────────────────────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// ─── Maintenance Mode Guard ───────────────────────────────
app.use(maintenanceGuard)

// ─── Routes ───────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/password-reset', resetLimiter, passwordResetRoutes)
app.use('/api/cases', caseRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api', documentRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/hearings', hearingRoutes)
app.use('/api/announcements', announcementRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/secretaries', secretaryRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin/settings', settingsRoutes)
app.use('/api/admin/audit', auditRoutes)
app.use('/api/2fa', twoFactorRoutes)
app.use('/api/templates', templateRoutes)
app.get('/api/search', globalSearch)

// ─── Health Check ─────────────────────────────────────────
app.get('/api/health', async (_req: Request, res: Response) => {
  let dbOk = false
  try {
    await pool.query('SELECT 1')
    dbOk = true
  } catch { /* db unreachable */ }

  const mem     = process.memoryUsage()
  const uptimeS = Math.floor((Date.now() - startTime) / 1000)

  res.status(dbOk ? 200 : 503).json({
    status:    dbOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime:    uptimeS,
    database:  dbOk ? 'connected' : 'unreachable',
    memory: {
      heapUsedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB:       Math.round(mem.rss       / 1024 / 1024),
    },
    system: {
      platform: process.platform,
      cpus:     os.cpus().length,
      freeMemMB: Math.round(os.freemem() / 1024 / 1024),
    },
  })
})

// ─── Global Error Handler ─────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.message || 'Unexpected error', { stack: err.stack })
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server error.' })
})

// ─── 404 fallback ─────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found.' })
})

// ─── Unhandled rejection safety net ──────────────────────
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Promise Rejection', { reason: reason?.message ?? reason, stack: reason?.stack })
})

const httpServer = createServer(app)
initSocket(httpServer)

httpServer.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`)
  startDeadlineReminder()
  startHearingReminder()
  startDbBackup()
})
