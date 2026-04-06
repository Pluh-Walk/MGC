/**
 * notifyWithEmail — Creates an in-app notification AND sends an email.
 *
 * Email is best-effort: SMTP failures are caught silently. The in-app
 * notification is always persisted regardless of email outcome.
 *
 * Email is skipped entirely if SMTP_USER is not set in the environment
 * (e.g. local development without a configured mail server).
 *
 * The emailHtmlFactory receives the recipient's fullname pulled from the DB,
 * so call sites don't need a separate query just for the greeting.
 */
import pool from '../config/db'
import { RowDataPacket } from 'mysql2'
import { notify, NotificationType } from './notify'
import { sendMail } from '../config/mailer'

export const notifyWithEmail = async (
  userId: number,
  type: NotificationType,
  notifMessage: string,
  referenceId: number | undefined,
  emailSubject: string,
  emailHtmlFactory: (recipientName: string) => string
): Promise<void> => {
  // Always create the in-app notification first
  await notify(userId, type, notifMessage, referenceId)

  // Skip email if SMTP is not configured (dev / local environment)
  if (!process.env.SMTP_USER) return

  try {
    const [[user]] = await pool.query<RowDataPacket[]>(
      'SELECT email, fullname FROM users WHERE id = ?',
      [userId]
    )
    if (user?.email) {
      await sendMail(user.email, emailSubject, emailHtmlFactory(user.fullname))
    }
  } catch {
    // Email failure is non-fatal — the in-app notification was already persisted
  }
}
