/**
 * Deadline Reminder Job
 * Runs once on server start and then every 24 hours.
 * Queries for:
 *   - Deadlines due in 3 days (early warning)
 *   - Deadlines due tomorrow (24-hour notice)
 *   - Overdue deadlines (past due, not completed)
 * Sends in-app notifications to the case's attorney for each.
 */
import pool from '../config/db'
import { RowDataPacket } from 'mysql2'
import { notify } from '../utils/notify'

const INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

async function runDeadlineReminders(): Promise<void> {
  try {
    console.log('[DeadlineReminder] Running check at', new Date().toISOString())

    // Overdue deadlines (past due date, not completed, not yet notified today)
    const [overdue] = await pool.query<RowDataPacket[]>(
      `SELECT cd.id, cd.case_id, cd.title, cd.due_date,
              c.case_number, c.attorney_id
       FROM case_deadlines cd
       JOIN cases c ON c.id = cd.case_id AND c.deleted_at IS NULL
       WHERE cd.is_completed = 0
         AND cd.due_date < CURDATE()
         AND (
           cd.last_reminder_sent IS NULL
           OR DATE(cd.last_reminder_sent) < CURDATE()
         )
       LIMIT 100`
    )

    // Deadlines due in exactly 1 day
    const [due1] = await pool.query<RowDataPacket[]>(
      `SELECT cd.id, cd.case_id, cd.title, cd.due_date,
              c.case_number, c.attorney_id
       FROM case_deadlines cd
       JOIN cases c ON c.id = cd.case_id AND c.deleted_at IS NULL
       WHERE cd.is_completed = 0
         AND cd.due_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         AND (
           cd.last_reminder_sent IS NULL
           OR DATE(cd.last_reminder_sent) < CURDATE()
         )
       LIMIT 100`
    )

    // Deadlines due in exactly 3 days
    const [due3] = await pool.query<RowDataPacket[]>(
      `SELECT cd.id, cd.case_id, cd.title, cd.due_date,
              c.case_number, c.attorney_id
       FROM case_deadlines cd
       JOIN cases c ON c.id = cd.case_id AND c.deleted_at IS NULL
       WHERE cd.is_completed = 0
         AND cd.due_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
         AND (
           cd.last_reminder_sent IS NULL
           OR DATE(cd.last_reminder_sent) < CURDATE()
         )
       LIMIT 100`
    )

    const toNotify: { rows: RowDataPacket[]; message: (r: RowDataPacket) => string }[] = [
      {
        rows: overdue as RowDataPacket[],
        message: (r) => `OVERDUE: Deadline "${r.title}" for case ${r.case_number} was due on ${new Date(r.due_date).toLocaleDateString('en-PH')}.`
      },
      {
        rows: due1 as RowDataPacket[],
        message: (r) => `REMINDER: Deadline "${r.title}" for case ${r.case_number} is due TOMORROW.`
      },
      {
        rows: due3 as RowDataPacket[],
        message: (r) => `REMINDER: Deadline "${r.title}" for case ${r.case_number} is due in 3 days.`
      }
    ]

    let sent = 0
    for (const group of toNotify) {
      for (const row of group.rows) {
        await notify(row.attorney_id, 'deadline_reminder', group.message(row), row.case_id)
        // Update last_reminder_sent — only if column exists (migration 017 should have added it)
        try {
          await pool.query(
            `UPDATE case_deadlines SET last_reminder_sent = NOW() WHERE id = ?`,
            [row.id]
          )
        } catch {
          // Column may not exist in all environments — silently skip
        }
        sent++
      }
    }

    console.log(`[DeadlineReminder] Sent ${sent} notifications.`)
  } catch (err) {
    console.error('[DeadlineReminder] Error:', err)
  }
}

export function startDeadlineReminder(): void {
  // Run immediately on startup
  runDeadlineReminders()
  // Then run every 24 hours
  setInterval(runDeadlineReminders, INTERVAL_MS)
}
