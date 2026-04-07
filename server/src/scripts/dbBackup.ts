/**
 * Database Backup Script (§11.6)
 *
 * Runs a mysqldump, gzips the output, and saves it to the backups/ directory.
 * Backup files are rotated after RETENTION_DAYS (default: 30).
 * Scheduled once daily at midnight.
 */
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import zlib from 'zlib'
import logger from '../config/logger'

const BACKUP_DIR     = path.join(process.cwd(), 'backups')
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 30)
const INTERVAL_MS    = 24 * 60 * 60 * 1000   // 24 hours

// ─── Run a single backup ──────────────────────────────────────────
async function runBackup(): Promise<void> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })

  const ts       = new Date().toISOString().slice(0, 10)                          // YYYY-MM-DD
  const filename = `mgc_backup_${ts}.sql.gz`
  const filePath = path.join(BACKUP_DIR, filename)

  const dbHost = process.env.DB_HOST     || 'localhost'
  const dbPort = process.env.DB_PORT     || '3306'
  const dbUser = process.env.DB_USER     || 'root'
  const dbPass = process.env.DB_PASSWORD || ''
  const dbName = process.env.DB_NAME     || 'law_system_auth'

  const args = [
    `--host=${dbHost}`,
    `--port=${dbPort}`,
    `--user=${dbUser}`,
    `--single-transaction`,
    `--routines`,
    `--triggers`,
    dbName,
  ]

  if (dbPass) {
    // Pass password via env variable to avoid command-line exposure
    process.env.MYSQL_PWD = dbPass
  }

  logger.info(`[DBBackup] Starting backup → ${filename}`)

  await new Promise<void>((resolve, reject) => {
    const dump   = spawn('mysqldump', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const gzip   = zlib.createGzip({ level: 6 })
    const output = fs.createWriteStream(filePath)

    dump.stdout.pipe(gzip).pipe(output)

    let stderr = ''
    dump.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    dump.on('error', err => {
      logger.error('[DBBackup] mysqldump not found or error:', err.message)
      reject(err)
    })

    dump.on('close', code => {
      // Unset password from env
      delete process.env.MYSQL_PWD

      if (code !== 0) {
        fs.existsSync(filePath) && fs.unlinkSync(filePath)
        const msg = `mysqldump exited with code ${code}. stderr: ${stderr.trim()}`
        logger.error('[DBBackup]', msg)
        reject(new Error(msg))
        return
      }

      output.on('finish', () => {
        const stat = fs.statSync(filePath)
        logger.info(`[DBBackup] Backup complete: ${filename} (${(stat.size / 1024).toFixed(1)} KB)`)
        resolve()
      })
      output.on('error', reject)
    })
  })

  // Rotate old backups
  rotateOldBackups()
}

// ─── Delete backups older than RETENTION_DAYS ─────────────────────
function rotateOldBackups(): void {
  try {
    const now     = Date.now()
    const cutoff  = RETENTION_DAYS * 24 * 60 * 60 * 1000

    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('mgc_backup_') && f.endsWith('.sql.gz'))
    for (const file of files) {
      const full = path.join(BACKUP_DIR, file)
      const stat = fs.statSync(full)
      if (now - stat.mtimeMs > cutoff) {
        fs.unlinkSync(full)
        logger.info(`[DBBackup] Rotated old backup: ${file}`)
      }
    }
  } catch (err) {
    logger.warn('[DBBackup] Rotation error:', err)
  }
}

// ─── Schedule the backup ─────────────────────────────────────────
export function startDbBackup(): void {
  // Calculate ms until next midnight
  const now       = new Date()
  const midnight  = new Date(now)
  midnight.setHours(24, 0, 5, 0)         // 00:00:05 next day
  const msToMidnight = midnight.getTime() - now.getTime()

  logger.info(`[DBBackup] First backup scheduled in ${Math.round(msToMidnight / 60000)} min`)

  setTimeout(() => {
    runBackup().catch(err => logger.warn('[DBBackup] Scheduled backup failed:', err))
    setInterval(() => {
      runBackup().catch(err => logger.warn('[DBBackup] Backup failed:', err))
    }, INTERVAL_MS)
  }, msToMidnight)
}

export { runBackup }
