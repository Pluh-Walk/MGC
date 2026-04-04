import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { RowDataPacket } from 'mysql2'
import pool from '../config/db'

export type UserRole = 'attorney' | 'client' | 'admin' | 'secretary'

export interface JwtPayload {
  id: number
  fullname: string
  username: string
  role: UserRole
  attorneyId?: number  // Present only for secretary role
}

// Extend Express Request to carry decoded user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

// Alias used by newer routes
export const authMiddleware = (req: Request, res: Response, next: NextFunction) =>
  verifyToken(req, res, next)

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization
  // Allow token via query param for browser-opened URLs (e.g. print/export tabs)
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null

  if (!authHeader?.startsWith('Bearer ') && !queryToken) {
    res.status(401).json({ success: false, message: 'Access denied. No token provided.' })
    return
  }

  const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken!

  try {
    const decoded = jwt.verify(rawToken, process.env.JWT_SECRET as string) as JwtPayload

    // Verify user is still active in the database
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT status FROM users WHERE id = ?',
      [decoded.id]
    )
    if (rows.length === 0) {
      res.status(401).json({ success: false, message: 'User no longer exists.' })
      return
    }
    if (rows[0].status === 'suspended') {
      res.status(403).json({ success: false, message: 'Your account has been suspended.' })
      return
    }
    if (rows[0].status === 'inactive') {
      res.status(403).json({ success: false, message: 'Your account is inactive.' })
      return
    }

    req.user = decoded
    next()
  } catch (err: any) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, message: 'Invalid or expired token.' })
    } else {
      res.status(500).json({ success: false, message: 'Authentication error.' })
    }
  }
}

// SSE-safe version: also accepts ?token= query param (EventSource can't set headers)
export const sseVerifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization
  let token: string | undefined

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]
  } else if (typeof req.query.token === 'string') {
    token = req.query.token
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Access denied. No token provided.' })
    return
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload

    // Verify user is still active
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT status FROM users WHERE id = ?',
      [decoded.id]
    )
    if (rows.length === 0 || rows[0].status === 'suspended' || rows[0].status === 'inactive') {
      res.status(403).json({ success: false, message: 'Account is suspended or inactive.' })
      return
    }

    req.user = decoded
    next()
  } catch (err: any) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, message: 'Invalid or expired token.' })
    } else {
      res.status(500).json({ success: false, message: 'Authentication error.' })
    }
  }
}

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Forbidden. Insufficient role.' })
      return
    }
    next()
  }
}

/**
 * For secretary users, resolves and injects the linked attorney's ID.
 * Admin and attorney pass through. Client passes through (handled by query logic).
 * Must be placed AFTER verifyToken and requireRole.
 */
export const requireAttorneyScope = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated.' })
    return
  }

  if (req.user.role === 'admin' || req.user.role === 'attorney' || req.user.role === 'client') {
    return next()
  }

  if (req.user.role === 'secretary') {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT als.attorney_id
         FROM attorney_secretaries als
         JOIN users u ON u.id = als.attorney_id
         WHERE als.secretary_id = ? AND als.status = 'active' AND u.status = 'active'`,
        [req.user.id]
      )
      if (rows.length === 0) {
        res.status(403).json({ success: false, message: 'Secretary account is not linked to an active attorney.' })
        return
      }
      req.user.attorneyId = rows[0].attorney_id
      return next()
    } catch {
      res.status(500).json({ success: false, message: 'Server error resolving secretary scope.' })
      return
    }
  }

  res.status(403).json({ success: false, message: 'Unknown role.' })
}
