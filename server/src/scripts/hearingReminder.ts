/**
 * Hearing Reminder Job
 *
 * Runs once on startup then every 6 hours.
 * Checks for hearings scheduled within the next 24 hours and sends
 * reminder emails to the attorney, client, and secretary.
 * Uses `reminder_sent_at` on the hearings row to prevent duplicate sends.
 */
import pool from '../config/db'
import { RowDataPacket } from 'mysql2'
import { notify } from '../utils/notify'
import { sendMail } from '../config/mailer'
import { hearing24hReminderEmail } from '../templates/emailTemplates'
import logger from '../config/logger'

const INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours

async function runHearingReminders(): Promise<void> {
  try {
    logger.info('[HearingReminder] Running check at ' + new Date().toISOString())

    // Hearings scheduled in the next 24 hours that haven't been reminded yet
    const [hearings] = await pool.query<RowDataPacket[]>(
      `SELECT h.id, h.case_id, h.title AS hearing_title, h.hearing_type,
              h.scheduled_at, h.location,
              c.case_number, c.title AS case_title, c.attorney_id, c.client_id,
              ua.fullname AS attorney_name, ua.email AS attorney_email,
              uc.fullname AS client_name,  uc.email AS client_email,
              sec.id AS secretary_id, sec.fullname AS secretary_name, sec.email AS secretary_email
       FROM hearings h
       JOIN cases c ON c.id = h.case_id AND c.deleted_at IS NULL
       JOIN users ua ON ua.id = c.attorney_id
       LEFT JOIN users uc ON uc.id = c.client_id
       LEFT JOIN attorney_secretaries sa ON sa.attorney_id = c.attorney_id AND sa.status = 'active'
       LEFT JOIN users sec ON sec.id = sa.secretary_id
       WHERE h.status = 'scheduled'
         AND h.scheduled_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 24 HOUR)
         AND (h.reminder_sent_at IS NULL OR h.reminder_sent_at < DATE_SUB(NOW(), INTERVAL 23 HOUR))
       LIMIT 100`
    )

    const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
    let sent = 0

    for (const h of hearings as RowDataPacket[]) {
      const schedFormatted = new Date(h.scheduled_at).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'full',
        timeStyle: 'short',
      })
      const link = `${origin}/hearings`

      // ── Attorney notification ────────────────
      await notify(
        h.attorney_id,
        'hearing_reminder',
        `Reminder: Hearing "${h.hearing_title}" for case ${h.case_number} is scheduled for tomorrow.`,
        h.case_id
      )
      if (h.attorney_email && process.env.SMTP_USER) {
        await sendMail(
          h.attorney_email,
          `Hearing Tomorrow: ${h.hearing_title} — ${h.case_number}`,
          hearing24hReminderEmail(
            h.attorney_name, h.case_title, h.case_number,
            h.hearing_title, schedFormatted, h.location, link
          )
        ).catch(() => { /* non-fatal */ })
      }

      // ── Client notification ──────────────────
      if (h.client_id) {
        await notify(
          h.client_id,
          'hearing_reminder',
          `Reminder: Your hearing "${h.hearing_title}" for case ${h.case_number} is tomorrow.`,
          h.case_id
        )
        if (h.client_email && process.env.SMTP_USER) {
          await sendMail(
            h.client_email,
            `Hearing Tomorrow: ${h.hearing_title} — ${h.case_number}`,
            hearing24hReminderEmail(
              h.client_name, h.case_title, h.case_number,
              h.hearing_title, schedFormatted, h.location, link
            )
          ).catch(() => { /* non-fatal */ })
        }
      }

      // ── Secretary notification ───────────────
      if (h.secretary_id) {
        await notify(
          h.secretary_id,
          'hearing_reminder',
          `Reminder: Hearing "${h.hearing_title}" for case ${h.case_number} is tomorrow.`,
          h.case_id
        )
        if (h.secretary_email && process.env.SMTP_USER) {
          await sendMail(
            h.secretary_email,
            `Hearing Tomorrow: ${h.hearing_title} — ${h.case_number}`,
            hearing24hReminderEmail(
              h.secretary_name, h.case_title, h.case_number,
              h.hearing_title, schedFormatted, h.location, link
            )
          ).catch(() => { /* non-fatal */ })
        }
      }

      // Mark reminder sent
      await pool.query(
        'UPDATE hearings SET reminder_sent_at = NOW() WHERE id = ?',
        [h.id]
      )
      sent++
    }

    logger.info(`[HearingReminder] Sent ${sent} reminder(s).`)
  } catch (err) {
    logger.error('[HearingReminder] Error:', err)
  }
}

export function startHearingReminder(): void {
  runHearingReminders()
  setInterval(runHearingReminders, INTERVAL_MS)
}
