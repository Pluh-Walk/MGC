/**
 * Migration runner — applies pending SQL migration files.
 * Usage: npx ts-node src/scripts/runMigrations.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
dotenv.config()
import pool from '../config/db'
import { RowDataPacket } from 'mysql2'

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../database/migrations')

async function main(): Promise<void> {
  // Ensure a migrations tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      filename   VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  const [applied] = await pool.query<RowDataPacket[]>('SELECT filename FROM _migrations')
  const appliedSet = new Set(applied.map((r) => r.filename))

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  let count = 0
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`[skip] ${file}`)
      continue
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    // Strip single-line SQL comments before splitting to avoid ';' inside comments
    const stripped = sql.replace(/--[^\n]*/g, '')
    const statements = stripped
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    for (const stmt of statements) {
      try {
        await pool.query(stmt)
      } catch (err: any) {
        // Skip errors expected when re-running migrations on a pre-existing DB:
        // 1062 = ER_DUP_ENTRY (seed data already inserted)
        // 1050 = ER_TABLE_EXISTS_ERROR (table already exists without IF NOT EXISTS)
        // 1060 = ER_DUP_FIELDNAME (column already added)
        // 1061 = ER_DUP_KEY (index already exists by name)
        // 1005 errno 121 = duplicate foreign key constraint name
        const ignored = [1050, 1060, 1061, 1062]
        const isDupFK = err.errno === 1005 && (err.sqlMessage || '').includes('121')
        if (!ignored.includes(err.errno) && !isDupFK) throw err
        // Still log it so the developer knows
        console.warn(`  [warn] ${err.sqlMessage?.slice(0, 80)}`)
      }
    }
    await pool.query('INSERT INTO _migrations (filename) VALUES (?)', [file])
    console.log(`[ok]   ${file}`)
    count++
  }

  if (count === 0) {
    console.log('All migrations already applied.')
  } else {
    console.log(`✅ Applied ${count} migration(s).`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Migration error:', err)
  process.exit(1)
})
