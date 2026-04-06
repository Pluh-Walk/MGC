# MGC Legal Case Management System — Production Readiness Features & Suggestions

> **How to use this document:**
> Review each section and mark features as ✅ Keep, ❌ Skip, or 🔄 Modify to fit your needs.
> Features are grouped by domain and ordered by priority within each group.
>
> **Tool policy:** All tools listed in this document are **free and open source**. No paid services are required.

---

## Table of Contents

1. [Security Hardening](#1-security-hardening)
2. [Email & Notification System](#2-email--notification-system)
3. [Document Management](#3-document-management)
4. [Case Management Enhancements](#4-case-management-enhancements)
5. [Billing & Payments](#5-billing--payments)
6. [Calendar & Scheduling](#6-calendar--scheduling)
7. [Client Portal](#7-client-portal)
8. [Communication](#8-communication)
9. [Reporting & Analytics](#9-reporting--analytics)
10. [Compliance & Legal Standards](#10-compliance--legal-standards)
11. [Performance & Infrastructure](#11-performance--infrastructure)
12. [Admin & Operations](#12-admin--operations)
13. [UI/UX Polish](#13-uiux-polish)
14. [Integrations](#14-integrations)

---

## 1. Security Hardening

> Current state: JWT auth, bcrypt (12 rounds), rate limiting on auth, login attempt lockout, role-based middleware, status re-check on every request, audit logging with IP.

### 1.1 Two-Factor Authentication (2FA)
**Priority: HIGH**

Attorneys handle sensitive legal data. 2FA is a baseline expectation for any production legal system.

- **TOTP-based 2FA** (Google Authenticator, Authy) using `speakeasy` or `otplib`
- **Backup codes** — generate 8 one-time backup codes on 2FA enrollment
- **Recovery flow** — admin can reset 2FA for a user (audit-logged)
- **Enforcement policy** — admin can require 2FA for attorney accounts system-wide via settings
- Apply to: attorneys and admins (mandatory); secretaries and clients (optional)

**DB addition:** `users.totp_secret`, `users.totp_enabled`, `two_factor_backup_codes` table

---

### 1.2 JWT Refresh Token Strategy
**Priority: HIGH**

Currently access tokens have a configurable expiry (default 7 days). Long-lived tokens are a risk.

- **Short-lived access tokens** (15–30 minutes)
- **Refresh tokens** stored in `httpOnly`, `Secure`, `SameSite=Strict` cookies
- **Refresh token rotation** — old token is revoked on each refresh
- **Token revocation table** — allows immediate logout/suspension to take effect without waiting for token expiry

**DB addition:** `refresh_tokens` table (user_id, token_hash, expires_at, revoked_at, ip_address, user_agent)

---

### 1.3 File Upload Security
**Priority: HIGH**

Currently Multer accepts uploads with basic size limits. Production needs stricter validation.

- **MIME type verification** — verify actual file bytes (magic bytes), not just the `Content-Type` header. Use `file-type` npm package (free)
- **Allowed extension whitelist** — `pdf, doc, docx, jpg, jpeg, png, xlsx, csv` only
- **Antivirus scanning** — use **ClamAV** (free, self-hosted open-source AV) via the `clamscan` npm wrapper
- **File name sanitization** — strip special characters, prevent path traversal attacks
- **Signed download URLs** — generate time-limited tokens in the DB instead of serving files directly (prevents link sharing, no external service needed)

---

### 1.4 HTTPS & Transport Security
**Priority: HIGH**

- **Force HTTPS** — redirect all HTTP traffic to HTTPS in production
- **HSTS header** — `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- **Content Security Policy (CSP)** — restrict script, style, and media sources
- **X-Frame-Options: DENY** — prevent clickjacking
- **Referrer-Policy: strict-origin-when-cross-origin**
- **CORS hardening** — whitelist only the production frontend origin; remove wildcard origins

Library: `helmet` npm package (free) covers most of these in one call.

---

### 1.5 SQL Injection & Input Validation
**Priority: HIGH**

- **Parameterized queries** — audit every raw query call to ensure no string interpolation
- **Input validation middleware** — use `zod` or `express-validator` on all request bodies
- **Output encoding** — ensure HTML exports sanitize stored content before rendering
- **Prototype pollution protection** — `npm install --save hpp` for Express HTTP Parameter Pollution prevention

---

### 1.6 Session & Cookie Security
**Priority: MEDIUM**

- **CSRF protection** — use `csurf` or double-submit cookie pattern (important for any form that changes state)
- **Cookie flags** — `httpOnly`, `Secure`, `SameSite=Strict` on refresh token cookies
- **Idle session timeout** — force re-authentication after configurable idle time (already in settings, needs enforcement on frontend)

---

### 1.7 Secrets Management
**Priority: MEDIUM**

- Keep all secrets in `.env` files — **never commit them to Git**
- Ensure `.env` is always listed in `.gitignore`
- Use `envalid` or `zod` (both free) to validate required env vars on startup and crash early with a clear message if any are missing
- For a future production server, **HashiCorp Vault** has a completely free self-hosted Community Edition

---

## 2. Email & Notification System

> Current state: In-app notifications (SSE-powered badge), email only for password reset and secretary invitations.

### 2.1 Transactional Email Notifications
**Priority: HIGH**

The system has the notification infrastructure but most events don't trigger emails. Production legal software must notify users via email because they won't always be logged in.

| Event | Recipients | Priority |
|-------|-----------|---------|
| New case assigned | Client | High |
| Case status changed | Client, Attorney | High |
| Hearing scheduled / rescheduled | Client, Attorney | High |
| Hearing reminder (24h before) | Client, Attorney, Secretary | High |
| Deadline due tomorrow | Attorney, Secretary | High |
| Deadline overdue | Attorney, Secretary | High |
| New document uploaded | Attorney (if by client), Client (if visible) | High |
| New message received | Recipient | Medium |
| IBP/ID verification approved or rejected | Attorney / Client | High |
| Account suspended / reactivated | User | High |
| Secretary joined / removed | Attorney | Medium |
| New announcement posted | All affected users | Medium |
| Case closed with outcome | Client | High |
| Password changed successfully | User (security alert) | High |
| New login from unrecognized device | User (security alert) | Medium |

**Technical approach:**
- Use a **job queue** (`bull` + Redis, both free/open source) for reliable email delivery — don't send emails synchronously in request handlers
- Use **Gmail SMTP** (free, already compatible with Nodemailer) as the email sender for development and small-scale production
- Implement **email templates** using `handlebars` (free) for firm branding (logo, colors)
- **Unsubscribe links** in all non-critical emails (legal requirement in many jurisdictions)
- **Per-user notification preferences** — each user can turn off specific email types

---

### 2.2 Notification Preferences
**Priority: MEDIUM**

Currently no per-user email preference controls exist.

- Each user can configure which events trigger: **in-app only**, **email + in-app**, or **none**
- Admin can set system-wide defaults
- Separate preferences for: case updates, hearing reminders, deadline alerts, messages, announcements

**DB addition:** `notification_preferences` table (user_id, event_type, in_app BOOLEAN, email BOOLEAN)

---

### 2.3 Push Notifications (No SMS)
**Priority: LOW (future)**

- **Web Push Notifications** via the browser's built-in Push API (completely free, no third party) — users get phone/desktop notifications even when the app is not open
- Requires implementing a PWA first (see section 13.2)
- **Skip SMS entirely** — Web Push covers the same use case at zero cost
- Important for clients who may not check email regularly

---

## 3. Document Management

> Current state: File upload per case, categories (pleading, motion, etc.), privilege markers, client visibility flag, soft-delete, download with auth check.

### 3.1 Document Versioning
**Priority: HIGH**

Legal documents are frequently revised. Without versioning, previous versions are permanently lost.

- Keep all versions of a document when a new version is uploaded
- Show version history panel (v1, v2, v3... with uploader name and date)
- Allow downloading any prior version
- Mark the latest version as **current** with visual indicator
- **DB addition:** `document_versions` table linked to `documents.id`

---

### 3.2 Document Templates Library
**Priority: HIGH**

Attorneys reuse the same document structures (demand letters, retainer agreements, pleading formats).

- Admin or attorney can upload **templates** (`.docx` files with placeholders)
- Templates can be pre-populated with case data (client name, case number, court, judge, etc.)
- Generate a draft document from a template, download as `.docx` or `.pdf`
- Template categories: Contracts, Pleadings, Motions, Letters, Affidavits

**DB addition:** `document_templates` table (title, category, file_path, created_by, is_system_wide)

---

### 3.3 Document Full-Text Search
**Priority: MEDIUM**

With dozens of documents per case, attorneys need to search within documents.

- OCR-generated text index for scanned PDFs
- Full-text search across document names and (optionally) extracted content
- Search scoped to a single case or across all of the attorney's cases

**Technical approach:** MySQL `FULLTEXT` index (built into MySQL, free) on document metadata; `pdf-parse` npm (free) for PDF content extraction.

---

### 3.4 Bulk Document Operations
**Priority: MEDIUM**

- **Bulk upload** — drag-and-drop multiple files at once
- **Bulk download** — select multiple documents → download as a single `.zip` file
- **Bulk delete** (attorney only) — select and soft-delete multiple documents

---

### 3.5 Document Expiry & Retention Policy
**Priority: MEDIUM**

Legal documents have mandatory retention periods (varies by case type, jurisdiction).

- Set a **retention period** per document category (e.g., 7 years for contracts)
- System warns admin when documents are approaching their retention expiry
- **Legal hold** flag — prevent deletion of documents flagged for litigation hold
- Export document inventory per case for compliance audits

---

### 3.6 E-Signature Support
**Priority: LOW (future)**

- Build a **canvas-based signature pad** using `signature_pad` npm (free, open source)
- Client or attorney draws their signature in the browser; it is saved as a PNG attached to the document
- Track signature status per document (pending, signed) in the DB
- No DocuSign or HelloSign needed — many small law firms use this approach
- Important for retainer agreements, client consent forms

---

## 4. Case Management Enhancements

> Current state: Full case CRUD with timeline, notes (with privacy/privilege), documents, parties, deadlines, billing, related cases, co-counsel, tags, draft/approval workflow.

### 4.1 Conflict of Interest Check
**Priority: HIGH**

A legal and ethical requirement — before accepting a new client, attorneys must verify no conflict exists with existing clients or opposing parties.

- When creating a new case, **automatically scan** all existing cases for:
  - The new client's name appearing as an opposing party in any active case
  - The new opposing party's name matching an existing client
  - The new client sharing a name with an existing client under a different attorney
- Surface a **warning modal** (not a hard block) showing the potential conflicts
- Log whether the attorney acknowledged the conflict warning (audit trail)

**DB addition:** `conflict_checks` table (case_id, checked_by, checked_at, conflicts_found JSON, acknowledged_at)

---

### 4.2 Task Management (Beyond Deadlines)
**Priority: HIGH**

Deadlines track court-imposed dates. Attorneys also need internal task tracking.

- **Tasks** linked to a case or standalone: title, description, assignee (attorney or secretary), due date, priority, status (pending/in-progress/done)
- Secretary can create and be assigned tasks
- Attorney gets notified when a task is assigned to them or marked complete
- Task list visible in the case detail's timeline tab and on dashboards

**DB addition:** `case_tasks` table (case_id, title, description, assigned_to, created_by, due_date, priority, status, completed_at)

---

### 4.3 Time Tracking
**Priority: HIGH**

Currently billing entries exist but there's no stopwatch/timer to track billable time as work happens.

- **Timer widget** — start/stop timer per case; auto-creates a billing entry when stopped
- **Manual time entry** — log hours after the fact with description
- **Billable vs. non-billable** flag per entry
- Timer visible from case list and case detail without leaving the page
- Weekly timesheet summary per attorney

---

### 4.4 Invoice Generation
**Priority: HIGH**

Billing entries exist in the DB but cannot currently be turned into a client-facing invoice.

- Select billing entries for a case → generate a **PDF invoice** using `pdfkit` (free, no external service)
- Invoice includes: firm branding, case number, client info, itemized entries (date, description, hours, rate, amount), retainer balance, total due
- Store generated invoices in the documents table (category = `invoice`)
- Send invoice to client via email + in-app notification
- Mark invoice status: **Draft → Sent → Paid → Disputed**

**DB addition:** `invoices` table (case_id, invoice_number, entries JSON, total_amount, status, sent_at, paid_at, due_date)

---

### 4.5 Statute of Limitations Tracker
**Priority: HIGH (for a legal system)**

A missed statute of limitations date is a serious legal malpractice issue.

- When creating a case, set the **statute of limitations date**
- System automatically creates a deadline entry for this date with `CRITICAL` priority
- 90-day, 30-day, 7-day, and 1-day email + in-app reminders
- Dashboard widget showing all approaching statute dates across all active cases
- Cannot be dismissed without attorney acknowledgment

---

### 4.6 Case Progress / Status Workflow
**Priority: MEDIUM**

Add a visual progress tracker showing where a case is in its lifecycle.

- Configurable **stage pipeline** per case type:
  - Criminal: Investigation → Filing → Arraignment → Trial → Judgment → Appeal
  - Civil: Filing → Summons → Pre-Trial → Trial → Decision → Execution
  - Administrative: Filing → Hearing → Decision → Reconsideration
- Each stage can have required checklist items before advancing
- Current stage shown prominently on case detail header and case list

---

### 4.7 Client Intake Form
**Priority: MEDIUM**

Currently clients register and then an attorney creates a case manually.

- Attorney creates and shares a **client intake form link** (similar to secretary invitation)
- Client fills in: case description, incident date, desired outcome, relevant parties, supporting documents
- Submission automatically creates a case **draft** for attorney review
- This replaces the cold-start of an empty case and captures client perspective early

---

### 4.8 Opposing Party Case Cross-Check
**Priority: MEDIUM**

- If an opposing party in a new case matches a registered user (client) in the system, surface a warning
- Prevents inadvertent disclosure to the opposing party if they have a separate case

---

## 5. Billing & Payments

> Current state: Billing entries (hourly, flat fee, court fee, expense, retainer deduction) with billed/paid status and invoice number field, but no actual payment processing or PDF generation.

### 5.1 Manual Payment Recording (Free)
**Priority: HIGH**

Instead of online payment processing, attorneys record payments manually after receiving cash, bank transfer, or GCash/Maya from the client outside the system.

- Add a **"Mark as Paid"** button on invoices with a reference number field (e.g., GCash ref, bank transfer ref)
- Attorney enters the payment reference; system updates the invoice to `paid` and logs it in the audit trail
- Generate a **PDF receipt** using `pdfkit` (free) and send to client via in-app message
- This is how most small Philippine law firms operate today — zero transaction fees, zero signup

> **Future upgrade path:** When ready, **PayMongo** has no monthly fee — you only pay 2.5% per transaction. It can be added later without changing the billing data model.

---

### 5.2 Retainer Account Management
**Priority: MEDIUM**

The system has a `retainer_amount` on cases but no full retainer ledger.

- **Retainer balance** per case — shows starting amount, all deductions, and remaining balance
- **Replenishment requests** — system alerts attorney and client when retainer falls below a threshold
- **Retainer statement** — exportable statement showing all retainer movements

---

### 5.3 Expense Receipt Uploads
**Priority: MEDIUM**

- Attach a receipt image/PDF to any expense billing entry
- Useful for reimbursable costs (court filing fees, transportation, photocopying)
- Receipts are stored as case documents with category `receipt`

---

## 6. Calendar & Scheduling

> Current state: `react-big-calendar` on attorney and client dashboards showing hearings. Hearings are CRUD-managed. No external calendar sync.

### 6.1 iCal / Google Calendar Export
**Priority: HIGH**

Attorneys already use external calendars. The system's hearing data should flow into them.

- **iCal feed URL** (`.ics` endpoint) per user — subscribe in Google Calendar, Outlook, Apple Calendar
- **One-time export** — download `.ics` file of all upcoming hearings
- **Event details** include: case number, case title, court, judge, hearing type, location
- Feed is token-authenticated (not publicly accessible)

---

### 6.2 Appointment Scheduling (Client → Attorney)
**Priority: MEDIUM**

Currently there's no way for a client to request a meeting with their attorney.

- Client can **request an appointment** from their dashboard (select preferred date/time slots)
- Attorney receives a notification and can **confirm or propose alternate time**
- Confirmed appointments appear on the shared calendar
- Automated reminder 24h before the appointment (email + in-app)

**DB addition:** `appointments` table (attorney_id, client_id, case_id, requested_at, confirmed_at, start_time, end_time, type, notes, status)

---

### 6.3 Attorney Availability Settings
**Priority: MEDIUM**

- Attorney sets **available hours** (e.g., Mon–Fri 9am–5pm)
- **Blocked dates** (vacation, court trips, CLEs)
- Appointment requests and hearing scheduling respect availability
- Visible to secretary to avoid scheduling conflicts

---

### 6.4 Hearing Preparation Checklist
**Priority: LOW**

- Per hearing, attorney or secretary can create a checklist of required items (documents to bring, witnesses to notify, pleadings to file)
- Checklist tracked per hearing with completion status

---

## 7. Client Portal

> Current state: Clients can view their own cases, browse attorneys, submit reviews, exchange messages, upload documents to their cases, and view announcements and hearings.

### 7.1 Dedicated Client Dashboard Improvements
**Priority: HIGH**

- **Case progress tracker** — visual stepper showing which stage their case is in
- **My Documents** section — list all documents uploaded by them or visible to them across all cases, in one place
- **Upcoming events** — next hearing date, next deadline visible immediately on login
- **Outstanding invoices** — show unpaid billing with payment link
- **Attorney contact card** — attorney name, phone, email, photo in sidebar

---

### 7.2 Client Self-Service Forms
**Priority: MEDIUM**

- Client can **update their own contact info** (phone, address, emergency contact) without waiting for attorney
- Client can **upload supporting documents** directly to their case (currently allowed but hard to discover)
- **Questionnaire responses** — attorney sends a structured questionnaire; client fills in answers online

---

### 7.3 Client Satisfaction Survey
**Priority: LOW**

- Auto-trigger a short survey when a case is marked **Closed**
- Questions: overall satisfaction, communication quality, outcome satisfaction, likelihood to recommend (NPS)
- Survey responses visible only to admin and the handling attorney
- Results aggregated in admin reports

**DB addition:** `client_surveys` table (case_id, client_id, responded_at, nps_score, satisfaction_rating, communication_rating, comments)

---

## 8. Communication

> Current state: REST-based direct messaging between users (attorney ↔ client, secretary on behalf of attorney), file attachments, edit/delete, grouped by conversation. SSE for notification badge only — messaging itself is not real-time.

### 8.1 Real-Time Messaging (WebSocket)
**Priority: HIGH**

Currently, new messages are only visible after a page refresh or manual polling. In a legal context, time-sensitive communication is common.

- Upgrade messaging to use **WebSocket** (via `socket.io` or native `ws`) for real-time delivery
- Show **typing indicators** ("Attorney Cruz is typing...")
- **Message delivery receipts** — sent ✓, delivered ✓✓, read ✓✓ (blue)
- Keep the REST API as a fallback for message history

---

### 8.2 Group Messaging / Case Chat
**Priority: MEDIUM**

- **Case discussion thread** — a group chat between the attorney, all co-counsel, and secretary assigned to a specific case
- Separate from the attorney ↔ client direct message channel
- Messages in the case chat are part of the case timeline (searchable audit)
- Clients are NOT part of the case chat (attorney work product)

**DB addition:** Extend `messages` or create `case_discussions` table with case context

---

### 8.3 Video Conferencing Integration
**Priority: LOW (future)**

- Use **Jitsi Meet** — completely free, open source, no account needed
- Generate a Jitsi room URL using the case number as the room name (e.g., `https://meet.jit.si/mgc-case-2026-00042`)
- Attorney shares the link via message; no installation required for clients (browser-based)
- No API key or integration cost — just construct the URL and send it
- Meeting recording (if enabled on a self-hosted Jitsi instance) can be saved as a case document

---

### 8.4 Email-to-Message Gateway
**Priority: LOW (future)**

- Each case gets a unique email address (e.g., `case-MGC-2026-00042@mgclaw.com`)
- Emails sent to that address are converted to messages in the case thread
- Useful when clients prefer to communicate via email rather than the portal

---

## 9. Reporting & Analytics

> Current state: Admin reports for user activity and case statistics. Attorney dashboard has calendar and recent activity.

### 9.1 Attorney Performance Reports
**Priority: HIGH**

- **Case closure rate** — cases closed vs. opened per month
- **Average case duration** by case type
- **Billable hours logged** per week/month/year
- **Revenue collected vs. outstanding** per attorney
- **Client satisfaction scores** (from surveys)

Accessible to: admin (all attorneys), attorney (own data only)

---

### 9.2 Financial Reports
**Priority: HIGH**

- **Revenue summary** — total billed, total collected, total outstanding by date range
- **Invoice aging report** — invoices grouped by age: 0–30 days, 31–60, 61–90, 90+ (past due)
- **Retainer utilization report** — retainer amounts received vs. hours used
- **Expense report** — breakdown of billable expenses by category

Accessible to: admin (system-wide), attorney (own cases)

---

### 9.3 Case Status & Workload Dashboard
**Priority: MEDIUM**

- **Workload heat map** — which attorneys have the most active cases (for admin oversight)
- **Case type distribution** — pie/bar chart of cases by type (criminal, civil, family, etc.)
- **Case outcome analysis** — win/loss/settlement breakdown per attorney or case type
- **Overdue deadlines by attorney** — admin can see which attorneys have the most overdue items

---

### 9.4 Scheduled Reports via Email
**Priority: LOW**

- Admin configures weekly/monthly report delivery to specific email addresses
- Each attorney can opt-in to receive a weekly summary of their cases, upcoming hearings, and pending deadlines

---

## 10. Compliance & Legal Standards

### 10.1 Data Privacy Compliance (RA 10173 — Data Privacy Act of 2012)
**Priority: HIGH (legal requirement in the Philippines)**

The system handles sensitive personal and legal data. The Data Privacy Act requires:

- **Data Subject Access Request (DSAR)** — admin can export all data associated with a specific user as JSON/ZIP on request
- **Right to Erasure** — admin can trigger a full soft-delete + anonymization of a user's personal data (name replaced with anonymized ID, email hashed, profile data cleared), with audit trail
- **Privacy Notice** — system must display a privacy notice at registration
- **Consent Tracking** — log when users consented to data processing (at registration)
- **Data Breach Notification** — documented procedure for notifying affected users within 72 hours of a breach (procedural, not a code feature)
- **Data Retention Policy** — automated enforcement of document/record retention periods set in system settings

---

### 10.2 Audit Log Completeness Review
**Priority: HIGH**

Ensure 100% audit coverage for these actions (some may be missing):

| Action | Currently Logged? |
|--------|------------------|
| Document download (by whom) | ✅ (case_access_log) |
| Billing entry create/edit/delete | ❓ Check |
| Invoice generated and sent | ❓ Check |
| Case note viewed | ❓ Check |
| System settings changed (key + old + new value) | ❓ Check |
| User impersonation (if added) | ❌ Not implemented |
| 2FA enrolled / disabled | ❌ Not implemented |
| Failed document access (privilege violation attempt) | ❓ Check |

---

### 10.3 Privilege Log Export
**Priority: MEDIUM**

For legal proceedings, attorneys may need to produce a **privilege log** — a list of all documents withheld from disclosure and the privilege asserted.

- Auto-generate privilege log from `documents` table filtered by `privilege_type IS NOT NULL`
- Format: document name, date, category, author, privilege type, basis for claim
- Export as CSV or PDF

---

### 10.4 Legal Hold Management
**Priority: MEDIUM**

When litigation is anticipated or ongoing, certain records must be preserved even past normal retention periods.

- Attorney or admin can place a **legal hold** on a case
- Legal hold prevents: document deletion, case archiving, user data erasure for affected parties
- Legal hold is logged in the audit trail
- Hold is lifted explicitly by attorney or admin (also audit-logged)

---

## 11. Performance & Infrastructure

### 11.1 Database Performance
**Priority: HIGH**

As the system grows to thousands of cases and users, queries will slow down without proper indexing.

- **Index audit** — review all foreign key columns and frequently filtered columns for proper indexes
- **Query profiling** — run `EXPLAIN` on the 20 most complex queries; optimize any with full-table scans
- **Connection pooling** — verify the MySQL pool size matches expected concurrent connections
- **Pagination enforcement** — ensure all list endpoints use cursor-based or keyset pagination, not `OFFSET` (OFFSET degrades at scale)
- **Slow query log** — enable MySQL slow query log in production; review weekly

---

### 11.2 Caching Layer
**Priority: MEDIUM**

- **Redis** (free, open source) for:
  - Session/token blacklist (for revoked JWTs)
  - Frequently read, rarely changing data: system settings, attorney profiles for client browse
  - Rate limiting counters (currently in-memory, lost on restart)
  - Job queue backend (`bull`)
- Redis can be self-hosted on the same machine as the server at zero cost
- **HTTP cache headers** — `Cache-Control` on static assets, profile photos, document thumbnails

---

### 11.3 File Storage Migration to Cloud
**Priority: MEDIUM**

Currently files are stored on the local filesystem (`uploads/`). This breaks with horizontal scaling and is lost if the server disk fails.

- **Cloudflare R2** — 10 GB free per month, zero egress fees (best free option)
- **Backblaze B2** — 10 GB free storage + free egress when used with Cloudflare
- Both support an S3-compatible API so the same `@aws-sdk/client-s3` npm package (free) works with either
- Use **token-signed download URLs** generated in the DB (no external signing service needed)
- Use **Cloudflare's free plan** as a CDN in front of R2 for profile photos and public assets
- Keep local filesystem storage as the default for development — no changes needed locally

---

### 11.4 Background Job Queue
**Priority: MEDIUM**

Several operations should not run in the request/response cycle:

| Operation | Why Queue It |
|-----------|-------------|
| Send email | SMTP failures should retry, not fail the HTTP request |
| OCR processing | Tesseract can take seconds; queue it and notify when done |
| Generate PDF invoice/report | CPU-intensive; shouldn't block the web worker |
| Document antivirus scan | External API calls with latency |
| Export large CSV/audit logs | Can take seconds for thousands of rows |
| Scheduled deadline reminders | Currently runs in the main process |

**Recommended:** `Bull` with `Redis` (both free/open source) for a reliable, retryable job queue with a web dashboard via `bull-board` (also free)

---

### 11.5 Logging & Monitoring
**Priority: HIGH**

- **Structured application logs** — use `winston` or `pino` (both free) for JSON-formatted logs (replaces `console.log`)
- **Log levels** — ERROR, WARN, INFO, DEBUG (only INFO+ in production)
- **Log files** — write logs to rotating files using `winston-daily-rotate-file` (free); no external service needed
- **Health check endpoint** — `GET /api/health` returns DB connection status, disk usage, uptime (used by uptime monitors)
- **Uptime monitoring** — **UptimeRobot** free plan (50 monitors, 5-minute checks) pings the health endpoint and emails you on downtime
- **Error tracking** — **Sentry** free plan (5,000 errors/month) captures full stack traces automatically; more than enough for a small system

---

### 11.6 Database Backups
**Priority: HIGH**

- **Automated daily backups** using `mysqldump` (free, included with MySQL/XAMPP) triggered by a cron job or Windows Task Scheduler
- Compress the dump with `gzip` and store in a separate folder or cloud drive
- **Free backup destinations:** Google Drive (15 GB free), Backblaze B2 (10 GB free)
- **Backup retention** — keep 7 daily, 4 weekly, 12 monthly dumps
- **Restore testing** — periodically test restoring from a backup to a local DB to verify it works
- A simple Node.js script can automate the dump + upload using `google-drive-api` or `backblaze-b2` npm (both free)

---

### 11.7 Deployment & CI/CD
**Priority: MEDIUM**

- **Environment separation** — dev / staging / production with separate databases and secrets (all free, just separate `.env` files)
- **Docker / Docker Compose** (free) for reproducible deployments — same environment on every machine
- **CI/CD pipeline** — **GitHub Actions** (free for public repos, 2,000 min/month free for private repos) — run tests and linting on every push
- **Process manager** — `pm2` (free) for zero-downtime restarts, auto-restart on crash, cluster mode
- **Free hosting options:** Railway (free $5 credit/month), Render (free tier), or XAMPP on a local server for demos
- **Environment variable validation** — `envalid` or `zod` (both free) to crash early if required env vars are missing

---

## 12. Admin & Operations

### 12.1 Maintenance Mode
**Priority: HIGH (already in settings DB, needs frontend enforcement)**

The `maintenance_mode` setting exists in the DB but may not be enforced everywhere:

- When enabled, all non-admin users receive a **maintenance page** instead of the app
- Admin can bypass maintenance mode
- API returns `503 Service Unavailable` for non-admin users during maintenance
- Admin dashboard shows a prominent banner when maintenance mode is active

---

### 12.2 User Impersonation (Admin)
**Priority: MEDIUM**

For debugging and support:

- Admin can **impersonate** any user (view the system as that user, read-only)
- A persistent banner is shown while impersonating: "You are viewing as [User Name] — [Exit Impersonation]"
- All actions while impersonating are audit-logged under the admin's account
- Impersonation cannot be used to: change passwords, download documents, send messages

---

### 12.3 Admin Activity Dashboard (Real-Time)
**Priority: MEDIUM**

- **Active sessions** — count of users currently online (via token activity or WebSocket presence)
- **Server health panel** — CPU usage, memory, disk space for uploads folder
- **Recent login activity** — last 20 logins with IP and device info
- **Failed login spike alerts** — notify admin if failed login rate exceeds threshold (potential brute-force)

---

### 12.4 Bulk User Operations
**Priority: MEDIUM**

- **Bulk import** — admin can CSV-import multiple users at once (useful for onboarding a law firm with existing staff)
- **Bulk export** — export all users to CSV for records
- **Bulk suspend** — suspend all accounts of a specific role or status

---

### 12.5 System Announcements with Acknowledgment
**Priority: LOW**

- For critical announcements (e.g., maintenance windows, policy changes), require users to **click "I acknowledge"** before dismissing
- Track which users have acknowledged which announcements
- Admin can see acknowledgment rate per announcement

---

## 13. UI/UX Polish

### 13.1 Mobile Responsiveness
**Priority: HIGH**

Attorneys and clients access the system from phones, especially for viewing hearings and messages.

- Responsive breakpoints for all pages (especially case list, case detail, messages, calendar)
- **Mobile-optimized navigation** — hamburger menu for sidebar on small screens
- **Touch-friendly** tap targets (buttons, form fields, calendar events)
- Test on iOS Safari and Android Chrome specifically

---

### 13.2 Progressive Web App (PWA)
**Priority: MEDIUM**

- Add a web app manifest and service worker — **entirely free**, no external service needed
- Users can **install the app** on their phone home screen directly from the browser
- **Offline fallback** — show cached data when offline (case names, hearing dates) using the Cache API
- **Push notification support** via the browser's Web Push API (free, replaces SMS entirely)
- Vite has built-in PWA support via `vite-plugin-pwa` (free)

---

### 13.3 Accessibility (WCAG 2.1 AA)
**Priority: MEDIUM**

- **Keyboard navigation** — all interactive elements are reachable via keyboard
- **Screen reader support** — proper ARIA labels on icons, modals, and dynamic content
- **Color contrast** — all text meets 4.5:1 contrast ratio
- **Focus indicators** — visible focus rings on all focusable elements
- Important for users with visual impairments and for government/court compliance

---

### 13.4 Dark Mode
**Priority: LOW**

- System-preference-aware (`prefers-color-scheme: dark`) automatic dark mode
- Manual toggle in user settings
- Consistent CSS variable theming

---

### 13.5 Onboarding Flow
**Priority: MEDIUM**

New users are dropped into a dashboard with no guidance.

- **Welcome tour** using `shepherd.js` (free, open source) — first-login walkthrough highlighting key features:
  - Attorney: "Create your first case → Invite a client → Upload documents"
  - Client: "View your case → Message your attorney → Download your documents"
- **Empty state improvements** — when a new user has no cases, show a call-to-action instead of an empty table
- **Setup checklist** for new attorneys: complete profile → verify IBP → invite first client

---

### 13.6 Keyboard Shortcuts
**Priority: LOW**

- `N` → New case (attorney)
- `M` → Go to messages
- `?` → Show keyboard shortcut reference
- `Esc` → Close modal
- `/` → Focus global search

---

### 13.7 Global Search
**Priority: MEDIUM**

Currently there is no global search — each page has its own search.

- **Global search bar** (Ctrl+K / Cmd+K) — search across cases (by number, title, client name), clients, hearings (by date, court), documents (by name)
- Results grouped by type with icons
- Keyboard-navigable results list

---

## 14. Integrations

### 14.1 Philippine Court Systems (e-Courts)
**Priority: LOW (future)**

- **e-Courts of the Philippines** — if an API becomes available, prefill case details from official court records using a docket number
- **IBP Integration** — verify IBP membership directly with the IBP national database (currently OCR-based)

---

### 14.2 Free Legal Research Links
**Priority: LOW (future)**

- Embed quick links to **ChanRobles Virtual Law Library** (free Philippine legal database) and **LawPhil** (free) within case notes
- Allow attorneys to paste a citation URL and have it saved as a reference on the case
- No API needed — these are free websites accessible to anyone

---

### 14.3 Accounting Export
**Priority: LOW (future)**

- Export billing data as a **CSV** (already supported in the system) that can be imported into any accounting software
- No paid accounting software integration needed — CSV import works with Excel, Google Sheets (free), and any local accounting software the firm uses

---

### 14.4 Google Drive / OneDrive Integration
**Priority: LOW (future)**

- Attorney can link a Google Drive/OneDrive folder to a case
- Bidirectional sync: documents uploaded in the system appear in the cloud folder and vice versa

---

---

## Priority Summary

### Must-Have Before Going Live

| Feature | Free Tool | Section |
|---------|-----------|--------|
| HTTPS enforcement + security headers | `helmet` npm | 1.4 |
| File upload MIME validation + whitelist | `file-type` npm | 1.3 |
| Input validation | `zod` npm | 1.5 |
| Email notifications for critical events | Gmail SMTP + Nodemailer | 2.1 |
| DB index audit & slow query review | MySQL `EXPLAIN` (built-in) | 11.1 |
| Daily automated DB backups | `mysqldump` + cron / Task Scheduler | 11.6 |
| Structured logging | `winston` npm | 11.5 |
| Error tracking | Sentry free plan | 11.5 |
| Health check endpoint | Custom Express route | 11.5 |
| Maintenance mode enforcement | Code change only | 12.1 |
| Mobile responsiveness | CSS only | 13.1 |
| Data Privacy Act compliance (RA 10173) | Code + policy changes | 10.1 |

### High Value, Build Soon

| Feature | Free Tool | Section |
|---------|-----------|--------|
| 2FA for attorneys & admins | `speakeasy` or `otplib` npm | 1.1 |
| JWT refresh token strategy | Code + DB table only | 1.2 |
| Invoice PDF generation | `pdfkit` npm | 4.4 |
| Manual payment recording | Code only | 5.1 |
| Time tracking with timer | Code only | 4.3 |
| Conflict of interest check | MySQL query only | 4.1 |
| Statute of limitations tracker | Code only | 4.5 |
| Document versioning | DB table + code | 3.1 |
| iCal / Google Calendar export | `ical-generator` npm | 6.1 |
| Real-time messaging (WebSocket) | `socket.io` npm (free) | 8.1 |
| Background job queue | `bull` + Redis (self-hosted) | 11.4 |
| Global search | MySQL `FULLTEXT` + React | 13.7 |

### Nice-to-Have, Plan for Later

| Feature | Free Tool | Section |
|---------|-----------|--------|
| Document template library | Code + DB table | 3.2 |
| Canvas e-signature | `signature_pad` npm | 3.6 |
| Appointment scheduling | Code + DB table | 6.2 |
| Client satisfaction survey | Code + DB table | 7.3 |
| Video conferencing | Jitsi Meet (free, no account) | 8.3 |
| PWA + Web Push notifications | `vite-plugin-pwa` + Web Push API | 13.2 |
| Privilege log export | MySQL query + `pdfkit` | 10.3 |
| User impersonation | Code only | 12.2 |
| Dark mode | CSS variables only | 13.4 |
| Uptime monitoring | UptimeRobot free plan | 11.5 |

---

---

## Free Tools Master Reference

Quick reference of every tool mentioned in this document:

| Tool | Purpose | Install |
|------|---------|--------|
| `helmet` | HTTP security headers | `npm i helmet` |
| `file-type` | MIME type verification | `npm i file-type` |
| `zod` | Input validation + env var checking | `npm i zod` |
| `envalid` | Environment variable validation | `npm i envalid` |
| `speakeasy` | TOTP-based 2FA | `npm i speakeasy` |
| `hpp` | HTTP Parameter Pollution prevention | `npm i hpp` |
| `handlebars` | Email templates | `npm i handlebars` |
| `bull` | Background job queue | `npm i bull` |
| `bull-board` | Job queue web dashboard | `npm i @bull-board/express` |
| `redis` | Cache + queue backend (self-hosted) | `npm i ioredis` |
| `socket.io` | Real-time WebSocket messaging | `npm i socket.io` |
| `pdfkit` | PDF generation (invoices, receipts) | `npm i pdfkit` |
| `ical-generator` | iCal / calendar export | `npm i ical-generator` |
| `signature_pad` | Canvas e-signature widget | `npm i signature_pad` |
| `pdf-parse` | Extract text from PDF files | `npm i pdf-parse` |
| `archiver` | Zip multiple files for bulk download | `npm i archiver` |
| `winston` | Structured application logging | `npm i winston` |
| `winston-daily-rotate-file` | Rotating log files | `npm i winston-daily-rotate-file` |
| `shepherd.js` | Onboarding tour / walkthrough | `npm i shepherd.js` |
| `vite-plugin-pwa` | PWA + service worker for Vite | `npm i vite-plugin-pwa` |
| `pm2` | Production process manager | `npm i -g pm2` |
| ClamAV | Self-hosted antivirus (system install) | [clamav.net](https://www.clamav.net) |
| Redis | Cache + queue server (system install) | [redis.io](https://redis.io) |
| Jitsi Meet | Free video conferencing | [meet.jit.si](https://meet.jit.si) (no install) |
| Sentry | Error tracking (free plan) | [sentry.io](https://sentry.io) |
| UptimeRobot | Uptime monitoring (free plan) | [uptimerobot.com](https://uptimerobot.com) |
| GitHub Actions | CI/CD pipeline | Built into GitHub (free) |
| Cloudflare R2 | Cloud file storage (10 GB free) | [cloudflare.com](https://cloudflare.com) |
| Cloudflare CDN | Free CDN + SSL | [cloudflare.com](https://cloudflare.com) |
| Let's Encrypt | Free SSL certificates | [letsencrypt.org](https://letsencrypt.org) |
| ChanRobles / LawPhil | Free Philippine legal databases | No integration needed |

---

*Document prepared for review — April 4, 2026*
*Updated: All tools are free. No paid services required.*
