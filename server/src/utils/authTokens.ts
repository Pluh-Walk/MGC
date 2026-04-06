/**
 * Auth token utilities — shared between login, secretary registration, and the refresh endpoint.
 *
 * Strategy:
 *   - Access token  : short-lived JWT (15 min by default) sent in Authorization header
 *   - Refresh token : long-lived opaque token (7 days) stored in an httpOnly cookie
 *                     Its SHA-256 hash is persisted in the refresh_tokens table.
 *                     On each successful refresh the old token is revoked and a new
 *                     one is issued (rotation).
 */
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { Request, Response } from 'express'
import pool from '../config/db'
import { JwtPayload } from '../middleware/auth'

const ACCESS_TTL  = process.env.JWT_EXPIRES_IN || '15m'
const REFRESH_TTL = 7 * 24 * 60 * 60 * 1000   // 7 days in ms
const COOKIE_PATH = '/api/auth'

/** Sign and return a short-lived access JWT. */
export const signAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string =>
  jwt.sign(
    payload as Record<string, unknown>,
    process.env.JWT_SECRET as string,
    { expiresIn: ACCESS_TTL as `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}` }
  )

/** Issue a refresh token: persist hash in DB, set httpOnly cookie on the response. */
export const issueRefreshToken = async (
  userId: number,
  req: Request,
  res: Response
): Promise<void> => {
  const raw       = crypto.randomBytes(48).toString('hex')
  const hash      = crypto.createHash('sha256').update(raw).digest('hex')
  const expiresAt = new Date(Date.now() + REFRESH_TTL)
  const ip        = req.ip || req.socket?.remoteAddress || 'unknown'
  const ua        = (req.headers['user-agent'] || '').slice(0, 500)

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, hash, expiresAt, ip, ua]
  )

  res.cookie('refresh_token', raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: REFRESH_TTL,
    path: COOKIE_PATH,
  })
}

/** Revoke all unexpired refresh tokens for a user (e.g. on password change / suspension). */
export const revokeAllUserTokens = async (userId: number): Promise<void> => {
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = ? AND revoked_at IS NULL`,
    [userId]
  )
}

/** Clear the refresh token cookie from the response. */
export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie('refresh_token', { path: COOKIE_PATH })
}
