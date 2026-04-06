/**
 * iCal / Calendar Export Controller
 *
 * GET /api/hearings/export/ical        — downloadable .ics for all upcoming hearings
 * GET /api/hearings/export/ical/feed   — subscribable feed (token in URL query param)
 */
import { Request, Response } from 'express'
import { RowDataPacket } from 'mysql2'
import ical, { ICalCalendarMethod } from 'ical-generator'
import pool from '../config/db'
import { getCaseScope } from '../utils/scope'

function buildCalendar(hearings: RowDataPacket[], userName: string) {
  const cal = ical({
    name:     'MGC Law — Hearings',
    timezone: 'Asia/Manila',
    method:   ICalCalendarMethod.PUBLISH,
    prodId:   '//MGC Law System//Hearings//EN',
  })

  for (const h of hearings) {
    const start = new Date(h.scheduled_at)
    // Default 2-hour hearing duration
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)

    const event = cal.createEvent({
      start,
      end,
      summary:  `[${h.case_number}] ${h.hearing_type || 'Hearing'} — ${h.case_title}`,
      location: [h.court_name, h.location].filter(Boolean).join(', ') || undefined,
      description: [
        `Case: ${h.case_number} — ${h.case_title}`,
        h.case_judge ? `Judge: ${h.case_judge}` : null,
        h.notes      ? `Notes: ${h.notes}`      : null,
      ].filter(Boolean).join('\n'),
      organizer: { name: userName, email: 'noreply@mgclaw.local' },
    })

    // 24h reminder alarm
    event.createAlarm({
      type: 'display' as any,
      trigger: 24 * 60 * 60,  // seconds before event
      description: `Upcoming hearing: ${h.case_number}`,
    })
  }

  return cal
}

// GET /api/hearings/export/ical
export const exportIcal = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user
  const scope = getCaseScope(user)

  try {
    const [hearings] = await pool.query<RowDataPacket[]>(
      `SELECT h.*, c.case_number, c.title AS case_title,
              c.court_name, c.judge_name AS case_judge
       FROM hearings h
       JOIN cases c ON h.case_id = c.id
       WHERE ${scope.clause}
         AND c.deleted_at IS NULL
         AND h.scheduled_at >= NOW()
       ORDER BY h.scheduled_at ASC`,
      scope.params
    )

    const cal = buildCalendar(hearings as RowDataPacket[], user.fullname)

    res
      .header('Content-Type',        'text/calendar; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="mgc-hearings.ics"')
      .send(cal.toString())
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
