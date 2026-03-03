import pool from '../config/db'
import { RowDataPacket, ResultSetHeader } from 'mysql2'

/**
 * Generates a case number like MGC-2026-00042
 * Uses an atomic counter per year stored in case_number_seq.
 */
export const generateCaseNumber = async (): Promise<string> => {
  const year = new Date().getFullYear()

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Upsert the year row and increment
    await conn.query<ResultSetHeader>(
      `INSERT INTO case_number_seq (year, seq)
       VALUES (?, 1)
       ON DUPLICATE KEY UPDATE seq = seq + 1`,
      [year]
    )

    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT seq FROM case_number_seq WHERE year = ?`,
      [year]
    )

    await conn.commit()

    const seq = String(rows[0].seq).padStart(5, '0')
    return `MGC-${year}-${seq}`
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}
