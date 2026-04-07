import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

const COOKIE_NAME = 'XSRF-TOKEN'
const HEADER_NAME = 'x-csrf-token'

/**
 * Set a readable (non-httpOnly) XSRF-TOKEN cookie that the frontend can read
 * and attach as the X-CSRF-Token request header.
 * Call this whenever a new session is issued (login, token refresh, 2FA verify).
 */
export function setCsrfCookie(res: Response): void {
  const token = crypto.randomBytes(32).toString('hex')
  res.cookie(COOKIE_NAME, token, {
    httpOnly: false,          // Must be readable by JS
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days — mirrors refresh token lifetime
  })
}

/**
 * Middleware: validate that the X-CSRF-Token header matches the XSRF-TOKEN cookie.
 * Apply to state-changing routes that rely on the httpOnly refresh-token cookie
 * (e.g. POST /api/auth/refresh) to prevent CSRF.
 */
export function csrfProtect(req: Request, res: Response, next: NextFunction): void {
  const cookieToken = req.cookies?.[COOKIE_NAME] as string | undefined
  const headerToken = req.headers[HEADER_NAME] as string | undefined

  if (!cookieToken || !headerToken) {
    res.status(403).json({ success: false, message: 'CSRF token missing.' })
    return
  }

  // Constant-time comparison to prevent timing attacks
  const cookie = Buffer.from(cookieToken)
  const header = Buffer.from(headerToken)
  const safe   = cookie.length === header.length && crypto.timingSafeEqual(cookie, header)

  if (!safe) {
    res.status(403).json({ success: false, message: 'CSRF token mismatch.' })
    return
  }

  next()
}
