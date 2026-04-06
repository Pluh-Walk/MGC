import pool from '../config/db'
import { ResultSetHeader } from 'mysql2'

export type NotificationType =
  | 'hearing_reminder'
  | 'case_update'
  | 'document_uploaded'
  | 'note_added'
  | 'announcement'
  | 'password_reset'
  | 'deadline_reminder'
  | 'message_received'
  | 'account_suspended'
  | 'account_reactivated'
  | 'secretary_removed'
  | 'invoice_sent'
  | 'payment_received'

/**
 * Creates a notification record for a user.
 */
export const notify = async (
  userId: number,
  type: NotificationType,
  message: string,
  referenceId?: number
): Promise<void> => {
  await pool.query<ResultSetHeader>(
    `INSERT INTO notifications (user_id, type, message, reference_id)
     VALUES (?, ?, ?, ?)`,
    [userId, type, message, referenceId ?? null]
  )
}
