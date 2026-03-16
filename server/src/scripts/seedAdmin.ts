/**
 * Seed script to create the first System Administrator account.
 *
 * Usage:
 *   cd server
 *   npx ts-node src/scripts/seedAdmin.ts
 *
 * IMPORTANT: Change the default password immediately after first login.
 */

import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '../../.env') })

async function seedAdmin() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'law_system_auth',
  })

  try {
    // Check if an admin already exists
    const [existing] = await pool.query<any[]>(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    )

    if (existing.length > 0) {
      console.log('⚠️  An admin account already exists (id:', existing[0].id, '). Skipping seed.')
      process.exit(0)
    }

    const password = 'Admin@MGC2026'
    const hashed = await bcrypt.hash(password, 12)

    const [result] = await pool.query<any>(
      `INSERT INTO users (fullname, username, email, password, role, status)
       VALUES (?, ?, ?, ?, 'admin', 'active')`,
      ['System Administrator', 'admin', 'admin@mgclaw.com', hashed]
    )

    console.log('✅ Admin account created successfully!')
    console.log('   ID:', result.insertId)
    console.log('   Username: admin')
    console.log('   Email: admin@mgclaw.com')
    console.log('   Password: Admin@MGC2026')
    console.log('')
    console.log('⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!')
  } catch (err) {
    console.error('❌ Failed to seed admin:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seedAdmin()
