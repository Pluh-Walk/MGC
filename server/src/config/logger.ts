import winston from 'winston'
import path from 'path'
import fs from 'fs'

const LOG_DIR = path.join(process.cwd(), 'logs')
fs.mkdirSync(LOG_DIR, { recursive: true })

const { combine, timestamp, printf, colorize, errors } = winston.format

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
  return `${timestamp} [${level}] ${stack || message}${metaStr}`
})

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),
  transports: [
    // Console — coloured in development
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        errors({ stack: true }),
        timestamp({ format: 'HH:mm:ss' }),
        logFormat,
      ),
      silent: process.env.NODE_ENV === 'test',
    }),
    // Rotating daily log file — errors only
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level:    'error',
      maxsize:  10 * 1024 * 1024, // 10 MB
      maxFiles: 14,               // 14 days
    }),
    // Combined log — all levels
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize:  20 * 1024 * 1024,
      maxFiles: 7,
    }),
  ],
})

export default logger
