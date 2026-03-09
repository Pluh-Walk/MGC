import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import path from 'path'
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

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// ─── Middleware ────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ─── Rate Limiting ────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
})

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many reset requests. Please wait an hour.' },
})

// ─── Static Uploads (internal — auth enforced via /download) ─
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

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

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 404 fallback
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found.' })
})

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
})
