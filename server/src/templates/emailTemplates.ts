/**
 * Email HTML templates for all system notification events.
 * Each function returns a full HTML string ready for Nodemailer.
 * Style follows the existing MGC brand: #1a365d header, #2b6cb0 accent.
 */

const layout = (heading: string, body: string): string => `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .wrap { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; }
    .hdr  { background: #1a365d; padding: 24px 40px; }
    .hdr h1 { color: #fff; margin: 0; font-size: 20px; letter-spacing: 0.5px; }
    .hdr p  { color: #bee3f8; margin: 4px 0 0; font-size: 13px; }
    .body { padding: 32px 40px; color: #2d3748; line-height: 1.65; }
    .body h2 { color: #1a365d; margin-top: 0; font-size: 18px; }
    .info { background: #ebf8ff; border-left: 4px solid #2b6cb0; border-radius: 0 4px 4px 0; padding: 14px 18px; margin: 18px 0; font-size: 14px; }
    .info p { margin: 4px 0; }
    .info strong { color: #1a365d; }
    .info-warn { background: #fffaf0; border-left-color: #c05621; }
    .info-err  { background: #fff5f5; border-left-color: #c53030; }
    .btn { display: inline-block; padding: 11px 26px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; margin-top: 16px; }
    .btn-blue   { background: #2b6cb0; color: #ffffff !important; }
    .btn-orange { background: #c05621; color: #ffffff !important; }
    .btn-green  { background: #276749; color: #ffffff !important; }
    .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: bold; }
    .pill-red    { background: #fed7d7; color: #c53030; }
    .pill-orange { background: #feebc8; color: #c05621; }
    .pill-blue   { background: #bee3f8; color: #2b6cb0; }
    .pill-green  { background: #c6f6d5; color: #276749; }
    .ftr { padding: 16px 40px; background: #f7fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #a0aec0; text-align: center; }
  </style>
</head><body>
  <div class="wrap">
    <div class="hdr">
      <h1>MGC Law System</h1>
      <p>${heading}</p>
    </div>
    <div class="body">${body}</div>
    <div class="ftr">This is an automated notification from MGC Law System. Please do not reply to this email.</div>
  </div>
</body></html>`

// ─── 1. New case assigned to client ──────────────────────────────────────────
export const caseAssignedEmail = (
  recipientName: string,
  caseTitle: string,
  caseNumber: string,
  link: string
): string => layout('New Case Opened', `
  <h2>A new case has been opened for you</h2>
  <p>Hi ${recipientName},</p>
  <p>Your attorney has opened a new legal case on your behalf.</p>
  <div class="info">
    <p><strong>Case Title:</strong> ${caseTitle}</p>
    <p><strong>Case Number:</strong> ${caseNumber}</p>
  </div>
  <p>Log in to your dashboard to view the details and track its progress.</p>
  <a href="${link}" class="btn btn-blue">View Case</a>
`)

// ─── 2. Case status changed ───────────────────────────────────────────────────
export const caseStatusChangedEmail = (
  recipientName: string,
  caseTitle: string,
  caseNumber: string,
  newStatus: string,
  link: string
): string => layout('Case Status Updated', `
  <h2>Your case status has been updated</h2>
  <p>Hi ${recipientName},</p>
  <p>There has been a status update on your case.</p>
  <div class="info">
    <p><strong>Case:</strong> ${caseTitle}</p>
    <p><strong>Case Number:</strong> ${caseNumber}</p>
    <p><strong>New Status:</strong> <span class="pill pill-blue">${newStatus.toUpperCase()}</span></p>
  </div>
  <a href="${link}" class="btn btn-blue">View Case</a>
`)

// ─── 3. Case closed with outcome ─────────────────────────────────────────────
export const caseClosedEmail = (
  recipientName: string,
  caseTitle: string,
  caseNumber: string,
  outcome: string,
  link: string
): string => layout('Case Closed', `
  <h2>Your case has been closed</h2>
  <p>Hi ${recipientName},</p>
  <p>Your case has been officially closed by your attorney.</p>
  <div class="info">
    <p><strong>Case:</strong> ${caseTitle}</p>
    <p><strong>Case Number:</strong> ${caseNumber}</p>
    <p><strong>Outcome:</strong> ${outcome}</p>
  </div>
  <p>Please contact your attorney if you have any questions about the outcome.</p>
  <a href="${link}" class="btn btn-green">View Final Record</a>
`)

// ─── 4. Hearing scheduled ─────────────────────────────────────────────────────
export const hearingScheduledEmail = (
  recipientName: string,
  caseTitle: string,
  caseNumber: string,
  hearingTitle: string,
  scheduledAt: string,
  location: string | null,
  link: string
): string => layout('Hearing Scheduled', `
  <h2>A hearing has been scheduled</h2>
  <p>Hi ${recipientName},</p>
  <p>A new hearing has been scheduled for one of your cases. Please mark your calendar.</p>
  <div class="info">
    <p><strong>Hearing:</strong> ${hearingTitle}</p>
    <p><strong>Case:</strong> ${caseTitle} (${caseNumber})</p>
    <p><strong>Date &amp; Time:</strong> ${scheduledAt}</p>
    ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
  </div>
  <a href="${link}" class="btn btn-blue">View Hearing Details</a>
`)

// ─── 5. Hearing status updated ────────────────────────────────────────────────
export const hearingUpdatedEmail = (
  recipientName: string,
  caseTitle: string,
  caseNumber: string,
  hearingTitle: string,
  newStatus: string,
  link: string
): string => layout('Hearing Update', `
  <h2>A hearing has been updated</h2>
  <p>Hi ${recipientName},</p>
  <p>There is an update to a hearing on your case.</p>
  <div class="info">
    <p><strong>Hearing:</strong> ${hearingTitle}</p>
    <p><strong>Case:</strong> ${caseTitle} (${caseNumber})</p>
    <p><strong>New Status:</strong> <span class="pill pill-orange">${newStatus.toUpperCase()}</span></p>
  </div>
  <a href="${link}" class="btn btn-blue">View Updated Hearing</a>
`)

// ─── 6. Deadline reminder ─────────────────────────────────────────────────────
export const deadlineReminderEmail = (
  recipientName: string,
  deadlineTitle: string,
  caseTitle: string,
  caseNumber: string,
  dueDate: string,
  urgency: 'overdue' | 'tomorrow' | '3days',
  link: string
): string => {
  const urgMap = {
    overdue:  { label: 'OVERDUE',        pillClass: 'pill-red',    btnClass: 'btn-orange', infoClass: 'info-err',  msg: 'This deadline has <strong>already passed</strong> and requires immediate attention.' },
    tomorrow: { label: 'DUE TOMORROW',   pillClass: 'pill-orange', btnClass: 'btn-orange', infoClass: 'info-warn', msg: 'This deadline is due <strong>tomorrow</strong>. Please take action immediately.' },
    '3days':  { label: 'DUE IN 3 DAYS', pillClass: 'pill-blue',   btnClass: 'btn-blue',   infoClass: '',          msg: 'This deadline is due in <strong>3 days</strong>. Please ensure you are prepared.' },
  }
  const u = urgMap[urgency]
  return layout('Deadline Alert', `
    <h2>Deadline Reminder &mdash; <span class="pill ${u.pillClass}">${u.label}</span></h2>
    <p>Hi ${recipientName},</p>
    <p>${u.msg}</p>
    <div class="info ${u.infoClass}">
      <p><strong>Deadline:</strong> ${deadlineTitle}</p>
      <p><strong>Case:</strong> ${caseTitle} (${caseNumber})</p>
      <p><strong>Due Date:</strong> ${dueDate}</p>
    </div>
    <a href="${link}" class="btn ${u.btnClass}">View Case</a>
  `)
}

// ─── 7. Document uploaded and visible to client ───────────────────────────────
export const documentUploadedEmail = (
  recipientName: string,
  caseTitle: string,
  caseNumber: string,
  documentName: string,
  link: string
): string => layout('New Document Available', `
  <h2>A new document has been uploaded</h2>
  <p>Hi ${recipientName},</p>
  <p>A document has been shared with you on your case.</p>
  <div class="info">
    <p><strong>Document:</strong> ${documentName}</p>
    <p><strong>Case:</strong> ${caseTitle} (${caseNumber})</p>
  </div>
  <a href="${link}" class="btn btn-blue">View Document</a>
`)

// ─── 8. New message received ──────────────────────────────────────────────────
export const newMessageEmail = (
  recipientName: string,
  senderName: string,
  preview: string,
  link: string
): string => layout('New Message', `
  <h2>You have a new message</h2>
  <p>Hi ${recipientName},</p>
  <p><strong>${senderName}</strong> sent you a message.</p>
  <div class="info">
    <p style="font-style: italic; color: #4a5568;">&ldquo;${preview}&rdquo;</p>
  </div>
  <a href="${link}" class="btn btn-blue">View Message</a>
`)

// ─── 9. Identity verification approved ───────────────────────────────────────
export const verificationApprovedEmail = (
  recipientName: string,
  dashLink: string
): string => layout('Verification Approved', `
  <h2>Your verification has been approved</h2>
  <p>Hi ${recipientName},</p>
  <p>Your identity verification has been reviewed and <strong>approved</strong> by the system administrator.</p>
  <p>You now have full access to all features of MGC Law System.</p>
  <a href="${dashLink}" class="btn btn-green">Go to Dashboard</a>
`)

// ─── 10. Identity verification rejected ──────────────────────────────────────
export const verificationRejectedEmail = (
  recipientName: string,
  reason: string,
  dashLink: string
): string => layout('Verification Not Approved', `
  <h2>Verification could not be approved</h2>
  <p>Hi ${recipientName},</p>
  <p>Unfortunately, your identity verification was <strong>not approved</strong>.</p>
  <div class="info info-warn">
    <p><strong>Reason:</strong> ${reason}</p>
  </div>
  <p>Please log in and re-upload your verification documents, or contact support for assistance.</p>
  <a href="${dashLink}" class="btn btn-orange">Re-submit Verification</a>
`)

// ─── 11. Account suspended ────────────────────────────────────────────────────
export const accountSuspendedEmail = (
  recipientName: string,
  reason: string
): string => layout('Account Suspended', `
  <h2>Your account has been suspended</h2>
  <p>Hi ${recipientName},</p>
  <p>Your MGC Law System account has been suspended by an administrator.</p>
  <div class="info info-err">
    <p><strong>Reason:</strong> ${reason}</p>
  </div>
  <p>If you believe this is a mistake, please contact MGC Law System support directly.</p>
`)

// ─── 12. Account reactivated ──────────────────────────────────────────────────
export const accountReactivatedEmail = (
  recipientName: string,
  dashLink: string
): string => layout('Account Reactivated', `
  <h2>Your account has been reactivated</h2>
  <p>Hi ${recipientName},</p>
  <p>Your MGC Law System account has been reactivated and your access has been fully restored.</p>
  <a href="${dashLink}" class="btn btn-green">Log In Now</a>
`)

// ─── 13. Secretary joined (email to attorney) ─────────────────────────────────
export const secretaryJoinedEmail = (
  attorneyName: string,
  secretaryName: string,
  dashLink: string
): string => layout('Secretary Joined Your Account', `
  <h2>A secretary has joined your account</h2>
  <p>Hi ${attorneyName},</p>
  <p><strong>${secretaryName}</strong> has accepted your invitation and is now linked to your account as a secretary.</p>
  <p>They can now manage your cases, hearings, and client communications on your behalf.</p>
  <a href="${dashLink}" class="btn btn-blue">Manage Secretaries</a>
`)

export const secretaryRemovedEmail = (
  secretaryName: string
): string => layout('Account Access Removed', `
  <h2>Your account access has been removed</h2>
  <p>Hi ${secretaryName},</p>
  <p>Your role as secretary has been removed by the attorney you were linked to.</p>
  <p>Your account is now inactive. If you believe this was done in error, please contact the attorney directly.</p>
  <p style="color:#718096;font-size:13px;">This is an automated notification from the MGC Law Case Management System.</p>
`)
