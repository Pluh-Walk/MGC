/**
 * Environment variable validation — runs at startup.
 * If any required variable is missing or invalid, the server exits with a clear error.
 */
import { z } from 'zod'

const envSchema = z.object({
  PORT:                z.string().default('5000'),
  CLIENT_ORIGIN:       z.string().min(1, 'CLIENT_ORIGIN is required.'),
  DB_HOST:             z.string().min(1, 'DB_HOST is required.'),
  DB_PORT:             z.string().default('3306'),
  DB_USER:             z.string().min(1, 'DB_USER is required.'),
  DB_PASSWORD:         z.string(),
  DB_NAME:             z.string().min(1, 'DB_NAME is required.'),
  JWT_SECRET:          z.string().min(32, 'JWT_SECRET must be at least 32 characters.'),
  JWT_EXPIRES_IN:      z.string().default('15m'),
  UPLOAD_DIR:          z.string().default('uploads'),
  MAX_FILE_SIZE_MB:    z.string().default('20'),
  // Optional — email may be unconfigured in dev
  SMTP_HOST:           z.string().optional(),
  SMTP_PORT:           z.string().optional(),
  SMTP_USER:           z.string().optional(),
  SMTP_PASS:           z.string().optional(),
  SMTP_FROM:           z.string().optional(),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('❌ Invalid or missing environment variables:')
  result.error.issues.forEach((e) => {
    console.error(`   ${String(e.path.join('.'))}: ${e.message}`)
  })
  process.exit(1)
}

export const env = result.data
