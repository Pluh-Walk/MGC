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
import { sendMail } from '../config/mailer'
import { deadlineReminderEmail, solReminderEmail } from '../templates/emailTemplates'

const INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

async function runDeadlineReminders(): Promise<void> {
  try {
    console.log('[DeadlineReminder] Running check at', new Date().toISOString())

    // Overdue deadlines (past due date, not completed, not yet notified today)
    const [overdue] = await pool.query<RowDataPacket[]>(
      `SELECT cd.id, cd.case_id, cd.title, cd.due_date,
              c.case_number, c.title AS case_title, c.attorney_id,
              u.fullname AS attorney_name, u.email AS attorney_email
       FROM case_deadlines cd
       JOIN cases c ON c.id = cd.case_id AND c.deleted_at IS NULL
       JOIN users u ON u.id = c.attorney_id
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
              c.case_number, c.title AS case_title, c.attorney_id,
              u.fullname AS attorney_name, u.email AS attorney_email
       FROM case_deadlines cd
       JOIN cases c ON c.id = cd.case_id AND c.deleted_at IS NULL
       JOIN users u ON u.id = c.attorney_id
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
              c.case_number, c.title AS case_title, c.attorney_id,
              u.fullname AS attorney_name, u.email AS attorney_email
       FROM case_deadlines cd
       JOIN cases c ON c.id = cd.case_id AND c.deleted_at IS NULL
       JOIN users u ON u.id = c.attorney_id
       WHERE cd.is_completed = 0
         AND cd.due_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY)
         AND (
           cd.last_reminder_sent IS NULL
           OR DATE(cd.last_reminder_sent) < CURDATE()
         )
       LIMIT 100`
    )

    const toNotify: { rows: RowDataPacket[]; urgency: 'overdue' | 'tomorrow' | '3days'; message: (r: RowDataPacket) => string }[] = [
      {
        rows: overdue as RowDataPacket[],
        urgency: 'overdue',
        message: (r) => `OVERDUE: Deadline "${r.title}" for case ${r.case_number} was due on ${new Date(r.due_date).toLocaleDateString('en-PH')}.`
      },
      {
        rows: due1 as RowDataPacket[],
        urgency: 'tomorrow',
        message: (r) => `REMINDER: Deadline "${r.title}" for case ${r.case_number} is due TOMORROW.`
      },
      {
        rows: due3 as RowDataPacket[],
        urgency: '3days',
        message: (r) => `REMINDER: Deadline "${r.title}" for case ${r.case_number} is due in 3 days.`
      }
    ]

    const _origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
    let sent = 0
    for (const group of toNotify) {
      for (const row of group.rows) {
        await notify(row.attorney_id, 'deadline_reminder', group.message(row), row.case_id)
        // Send email if SMTP is configured
        if (process.env.SMTP_USER && row.attorney_email) {
          const dueFormatted = new Date(row.due_date).toLocaleDateString('en-PH', { dateStyle: 'long' })
          const link = `${_origin}/cases/${row.case_id}`
          try {
            await sendMail(
              row.attorney_email,
              group.urgency === 'overdue' ? `OVERDUE: ${row.title} — MGC Law` : `Deadline Reminder: ${row.title} — MGC Law`,
              deadlineReminderEmail(row.attorney_name, row.title, row.case_title, row.case_number, dueFormatted, group.urgency, link)
            )
          } catch { /* non-fatal */ }
        }
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

    // ─── SOL Multi-Tier Reminders ──────────────────────────────────────────
    // Extra reminder cadence for statute_of_limitations deadlines that are
    // not yet acknowledged: 90 days, 30 days, 7 days, 1 day before due date.
    const solTiers: { days: number; label: string }[] = [
      { days: 90, label: '90 days' },
      { days: 30, label: '30 days' },
      { days: 7,  label: '7 days'  },
      { days: 1,  label: '1 day'   },
    ]

    let solSent = 0
    for (const tier of solTiers) {
      const [solRows] = await pool.query<RowDataPacket[]>(
        `SELECT cd.id, cd.case_id, cd.title, cd.due_date,
                c.case_number, c.title AS case_title, c.attorney_id,
                u.fullname AS attorney_name, u.email AS attorney_email
         FROM case_deadlines cd
         JOIN cases c ON c.id = cd.case_id AND c.deleted_at IS NULL
         JOIN users u ON u.id = c.attorney_id
         WHERE cd.deadline_type = 'statute_of_limitations'
           AND cd.is_completed = 0
           AND cd.sol_acknowledged_at IS NULL
           AND cd.due_date = DATE_ADD(CURDATE(), INTERVAL ? DAY)
         LIMIT 100`,
        [tier.days]
      )

      for (const row of solRows as RowDataPacket[]) {
        const msg = `⚠ SOL WARNING (${tier.label} remaining): "${row.title}" for case ${row.case_number}. Due: ${new Date(row.due_date).toLocaleDateString('en-PH')}.`
        await notify(row.attorney_id, 'sol_reminder', msg, row.case_id)

        if (process.env.SMTP_USER && row.attorney_email) {
          const dueFormatted = new Date(row.due_date).toLocaleDateString('en-PH', { dateStyle: 'long' })
          const link = `${_origin}/cases/${row.case_id}`
          try {
            await sendMail(
              row.attorney_email,
              `⚠ URGENT: SOL Deadline in ${tier.label} — ${row.case_number}`,
              solReminderEmail(row.attorney_name, row.title, row.case_title, row.case_number, dueFormatted, tier.days, link)
            )
          } catch { /* non-fatal */ }
        }
        solSent++
      }
    }

    if (solSent > 0) {
      console.log(`[DeadlineReminder] Sent ${solSent} SOL tier notifications.`)
    }
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
