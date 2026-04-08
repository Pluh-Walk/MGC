/**
 * Weekly Report Email Job (§9.4)
 *
 * Runs once on startup and then every Monday at 08:00 local time.
 * Sends each attorney (and their secretary) a weekly summary:
 *   - Active cases count
 *   - Upcoming hearings this week
 *   - Deadlines due this week
 *   - Open tasks due this week
 */
import pool from '../config/db'
import { RowDataPacket } from 'mysql2'
import { sendMail } from '../config/mailer'
import logger from '../config/logger'

// ─── Email template ──────────────────────────────────────────────
function weeklyReportEmail(
  name: string,
  activeCases: number,
  hearings: RowDataPacket[],
  deadlines: RowDataPacket[],
  tasks: RowDataPacket[],
  link: string
): string {
  const format = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })

  const hearingRows = hearings.map(h =>
    `<tr>
       <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${format(h.scheduled_at)}</td>
       <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${h.hearing_title}</td>
       <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${h.case_number}</td>
     </tr>`
  ).join('')

  const deadlineRows = deadlines.map(d =>
    `<tr>
       <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${format(d.due_date)}</td>
       <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${d.title}</td>
       <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${d.case_number}</td>
     </tr>`
  ).join('')

  const taskRows = tasks.map(t =>
    `<tr>
       <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${t.due_date ? format(t.due_date) : '—'}</td>
       <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${t.title}</td>
       <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${t.case_number || '—'}</td>
     </tr>`
  ).join('')

  const tableStyle = 'width:100%;border-collapse:collapse;font-size:13px;margin:8px 0 18px'
  const thStyle    = 'padding:6px 8px;background:#ebf8ff;color:#1a365d;text-align:left;border-bottom:2px solid #2b6cb0'

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden}
  .hdr{background:#1a365d;padding:24px 40px}
  .hdr h1{color:#fff;margin:0;font-size:20px}
  .hdr p{color:#bee3f8;margin:4px 0 0;font-size:13px}
  .body{padding:32px 40px;color:#2d3748;line-height:1.65}
  .stat{display:inline-block;background:#ebf8ff;border-radius:8px;padding:12px 20px;margin:0 8px 12px 0;text-align:center}
  .stat .num{font-size:28px;font-weight:bold;color:#1a365d}
  .stat .lbl{font-size:11px;color:#718096;margin-top:2px}
  .btn{display:inline-block;padding:11px 26px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;margin-top:16px;background:#2b6cb0;color:#fff !important}
  .ftr{padding:16px 40px;background:#f7fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#a0aec0;text-align:center}
</style></head><body>
<div class="wrap">
  <div class="hdr">
    <h1>MGC Law System</h1>
    <p>Weekly Summary — ${new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
  <div class="body">
    <h2 style="color:#1a365d;margin-top:0">Good morning, ${name}!</h2>
    <p>Here is your weekly case summary for the next 7 days.</p>

    <div>
      <div class="stat"><div class="num">${activeCases}</div><div class="lbl">Active Cases</div></div>
      <div class="stat"><div class="num">${hearings.length}</div><div class="lbl">Hearings This Week</div></div>
      <div class="stat"><div class="num">${deadlines.length}</div><div class="lbl">Deadlines This Week</div></div>
      <div class="stat"><div class="num">${tasks.length}</div><div class="lbl">Tasks Due This Week</div></div>
    </div>

    ${hearings.length > 0 ? `
    <h3 style="color:#1a365d;margin-bottom:4px">Upcoming Hearings</h3>
    <table style="${tableStyle}">
      <tr><th style="${thStyle}">Date</th><th style="${thStyle}">Hearing</th><th style="${thStyle}">Case</th></tr>
      ${hearingRows}
    </table>` : ''}

    ${deadlines.length > 0 ? `
    <h3 style="color:#1a365d;margin-bottom:4px">Deadlines This Week</h3>
    <table style="${tableStyle}">
      <tr><th style="${thStyle}">Due</th><th style="${thStyle}">Deadline</th><th style="${thStyle}">Case</th></tr>
      ${deadlineRows}
    </table>` : ''}

    ${tasks.length > 0 ? `
    <h3 style="color:#1a365d;margin-bottom:4px">Tasks Due This Week</h3>
    <table style="${tableStyle}">
      <tr><th style="${thStyle}">Due</th><th style="${thStyle}">Task</th><th style="${thStyle}">Case</th></tr>
      ${taskRows}
    </table>` : ''}

    <a href="${link}/cases" class="btn">Go to My Cases</a>
  </div>
  <div class="ftr">
    You are receiving this weekly summary because you are registered as an attorney on MGC Law System.
    To unsubscribe, adjust your notification preferences in Account Settings.
  </div>
</div>
</body></html>`
}

// ─── Main job ────────────────────────────────────────────────────
async function runWeeklyReport(): Promise<void> {
  try {
    logger.info('[WeeklyReport] Generating weekly summaries…')
    const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

    // Fetch all active attorneys who have opted in (or have no preference set — default opted-in)
    const [attorneys] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.fullname, u.email
       FROM users u
       WHERE u.role = 'attorney' AND u.status = 'active' AND u.email IS NOT NULL`
    )

    for (const atty of attorneys) {
      try {
        // Active cases count
        const [[{ activeCases }]] = await pool.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS activeCases FROM cases
           WHERE attorney_id = ? AND status = 'active' AND deleted_at IS NULL`,
          [atty.id]
        )

        // Hearings this week
        const [hearings] = await pool.query<RowDataPacket[]>(
          `SELECT h.title AS hearing_title, h.scheduled_at, c.case_number
           FROM hearings h
           JOIN cases c ON c.id = h.case_id
           WHERE c.attorney_id = ? AND h.status = 'scheduled'
             AND h.scheduled_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
             AND c.deleted_at IS NULL
           ORDER BY h.scheduled_at ASC`,
          [atty.id]
        )

        // Deadlines due this week
        const [deadlines] = await pool.query<RowDataPacket[]>(
          `SELECT cd.title, cd.due_date, c.case_number
           FROM case_deadlines cd
           JOIN cases c ON c.id = cd.case_id
           WHERE c.attorney_id = ? AND cd.is_completed = 0
             AND cd.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
             AND c.deleted_at IS NULL
           ORDER BY cd.due_date ASC`,
          [atty.id]
        )

        // Tasks due this week
        const [tasks] = await pool.query<RowDataPacket[]>(
          `SELECT ct.title, ct.due_date, c.case_number
           FROM case_tasks ct
           JOIN cases c ON c.id = ct.case_id
           WHERE (ct.assigned_to = ? OR ct.created_by = ?)
             AND ct.status NOT IN ('done', 'cancelled')
             AND (ct.due_date IS NULL OR ct.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY))
             AND c.deleted_at IS NULL
           ORDER BY ct.due_date ASC
           LIMIT 10`,
          [atty.id, atty.id]
        )

        const html = weeklyReportEmail(
          atty.fullname, activeCases,
          hearings as RowDataPacket[],
          deadlines as RowDataPacket[],
          tasks as RowDataPacket[],
          origin
        )

        await sendMail(
          atty.email,
          `MGC Weekly Summary — ${new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })}`,
          html
        )

        // Also send to the attorney's active secretary (if any)
        const [[sec]] = await pool.query<RowDataPacket[]>(
          `SELECT u.fullname, u.email FROM attorney_secretaries ats
           JOIN users u ON u.id = ats.secretary_id
           WHERE ats.attorney_id = ? AND ats.status = 'active' AND u.email IS NOT NULL
           LIMIT 1`,
          [atty.id]
        )
        if (sec) {
          const secHtml = weeklyReportEmail(
            sec.fullname, activeCases,
            hearings as RowDataPacket[],
            deadlines as RowDataPacket[],
            tasks as RowDataPacket[],
            origin
          )
          await sendMail(
            sec.email,
            `MGC Weekly Summary (${atty.fullname}) — ${new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })}`,
            secHtml
          )
        }

        logger.info(`[WeeklyReport] Sent to ${atty.email}`)
      } catch (innerErr: any) {
        logger.error(`[WeeklyReport] Failed for attorney ${atty.id}: ${innerErr.message}`)
      }
    }
  } catch (err: any) {
    logger.error('[WeeklyReport] Job failed: ' + err.message)
  }
}

// ─── Scheduler: fire every Monday at 08:00 ───────────────────────
function msUntilNextMonday(): number {
  const now  = new Date()
  const next = new Date(now)
  // Day 1 = Monday in ISO, but JS: 0=Sun, 1=Mon,...
  const day     = now.getDay()  // 0=Sun
  const daysAhd = day === 1 ? 7 : (8 - day) % 7  // days until next Monday
  next.setDate(now.getDate() + daysAhd)
  next.setHours(8, 0, 0, 0)
  return next.getTime() - now.getTime()
}

export function startWeeklyReport(): void {
  const delay = msUntilNextMonday()
  logger.info(`[WeeklyReport] First run in ${Math.round(delay / 3600000)}h (next Monday 08:00)`)

  setTimeout(function tick() {
    runWeeklyReport()
    setTimeout(tick, 7 * 24 * 60 * 60 * 1000) // repeat every 7 days
  }, delay)
}
