import { Server as HttpServer } from 'http'
import { Server as SocketServer, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import logger from './config/logger'

interface AuthSocket extends Socket {
  userId?: number
  userRole?: string
}

let io: SocketServer

export function initSocket(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
      credentials: true,
    },
  })

  // ─── Authentication middleware ──────────────────────────
  io.use((socket: AuthSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization as string)?.replace('Bearer ', '')

    if (!token) return next(new Error('Authentication required'))

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { id: number; role: string }
      socket.userId = payload.id
      socket.userRole = payload.role
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket: AuthSocket) => {
    const userId = socket.userId!
    logger.info(`Socket connected: user ${userId}`)

    // Each user joins their own private room
    socket.join(`user:${userId}`)

    // ── Typing indicator ──────────────────────────────────
    socket.on('typing:start', (data: { to: number }) => {
      io.to(`user:${data.to}`).emit('typing:start', { from: userId })
    })

    socket.on('typing:stop', (data: { to: number }) => {
      io.to(`user:${data.to}`).emit('typing:stop', { from: userId })
    })

    // ── Mark messages read ────────────────────────────────
    socket.on('messages:read', (data: { from: number }) => {
      io.to(`user:${data.from}`).emit('messages:read', { by: userId })
    })

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: user ${userId}`)
    })
  })

  return io
}

/**
 * Push a new-message event to a recipient's room.
 * Called from the message controller after saving the message.
 */
export function emitNewMessage(recipientId: number, message: object) {
  if (io) {
    io.to(`user:${recipientId}`).emit('message:new', message)
  }
}

export { io }
