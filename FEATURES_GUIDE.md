# MGC Legal Case Management System — Features Guide

> **What this file covers:**
> Every feature in the system, how it works under the hood, how to activate/use it, and where to find it in the UI.

---

## Table of Contents

1. [User Roles & Access Control](#1-user-roles--access-control)
2. [Authentication](#2-authentication)
3. [Two-Factor Authentication (2FA)](#3-two-factor-authentication-2fa)
4. [Verification System](#4-verification-system)
5. [Profile Management](#5-profile-management)
6. [Case Management](#6-case-management)
7. [Case Deadlines](#7-case-deadlines)
8. [Case Parties](#8-case-parties)
9. [Case Stages / Progress Workflow](#9-case-stages--progress-workflow)
10. [Case Tags & Labels](#10-case-tags--labels)
11. [Case Relations](#11-case-relations)
12. [Co-Counsel Management](#12-co-counsel-management)
13. [Document Management](#13-document-management)
14. [Document Versioning](#14-document-versioning)
15. [Document Templates Library](#15-document-templates-library)
16. [Messaging System](#16-messaging-system)
17. [Hearing Management](#17-hearing-management)
18. [Hearing Preparation Checklist](#18-hearing-preparation-checklist)
19. [Billing & Invoicing](#19-billing--invoicing)
20. [Time Tracking](#20-time-tracking)
21. [Task Management](#21-task-management)
22. [Notifications](#22-notifications)
23. [Notification Preferences](#23-notification-preferences)
24. [Announcements](#24-announcements)
25. [Secretary Management](#25-secretary-management)
26. [Admin Dashboard](#26-admin-dashboard)
27. [User Management (Admin)](#27-user-management-admin)
28. [Admin Verification Queue](#28-admin-verification-queue)
29. [Admin Audit Logs](#29-admin-audit-logs)
30. [Admin Reports](#30-admin-reports)
31. [System Settings](#31-system-settings)
32. [Impersonation](#32-impersonation)
33. [Global Search](#33-global-search)
34. [Conflict of Interest Checks](#34-conflict-of-interest-checks)
35. [Privilege Markers](#35-privilege-markers)
36. [Case Access Log](#36-case-access-log)
37. [Client Satisfaction Surveys](#37-client-satisfaction-surveys)
38. [Password Reset](#38-password-reset)
39. [Automated Background Jobs](#39-automated-background-jobs)
40. [Maintenance Mode](#40-maintenance-mode)
41. [iCal / Calendar Export](#41-ical--calendar-export)
42. [Reports (Attorney)](#42-reports-attorney)
43. [Security Layers](#43-security-layers)

---

## 1. User Roles & Access Control

### How it works
The system uses **Role-Based Access Control (RBAC)** with four roles stored in the `users.role` column:

| Role | Description |
|------|-------------|
| `attorney` | Primary legal professional — manages cases, documents, billing |
| `client` | End user seeking legal services — limited read/submit access |
| `secretary` | Assistant linked to one attorney — can act on attorney's behalf |
| `admin` | System superuser — full platform control |

Every API route runs a `requireAuth` middleware that validates the JWT and then a `requireRole(...)` check that compares the user's role before allowing access.

### How to make it work
- Roles are assigned at registration or by an admin.
- `ProtectedRoute.tsx` in the client wraps all authenticated pages — it reads the role from the `AuthContext` and redirects if the user doesn't have the right role.

### Where to see it
- `server/src/middleware/` — `auth.ts`, `requireRole.ts`
- `client/src/components/ProtectedRoute.tsx`
- `client/src/context/AuthContext.tsx`

---

## 2. Authentication

### How it works
- Users log in with email + password. Password is hashed with **bcrypt (12 rounds)**.
- On success, the server issues:
  - A **short-lived JWT access token** (15–30 minutes) returned in the response body.
  - A **long-lived refresh token** (7 days) stored as an `httpOnly`, `Secure`, `SameSite=Strict` cookie.
- Every subsequent API call sends the access token in the `Authorization: Bearer <token>` header.
- When the access token expires, the client hits `/api/auth/refresh` with the cookie to get a new pair (refresh token rotation — old token is revoked immediately).
- Login attempts are tracked in the `login_attempts` table. Too many failed attempts lock the account temporarily.

### How to make it work
1. Ensure `JWT_SECRET` and `JWT_REFRESH_SECRET` are set in `server/.env`.
2. Set `ACCESS_TOKEN_EXPIRY=15m` and `REFRESH_TOKEN_EXPIRY=7d` in `.env`.
3. Run migration `025_refresh_tokens.sql` to create the `refresh_tokens` table.

### Where to see it
- `client/src/pages/Login.tsx` — login form
- `client/src/pages/Register.tsx` — registration form
- `server/src/controllers/authController.ts` — login, register, refresh, logout
- `server/src/routes/authRoutes.ts`
- DB table: `refresh_tokens`

---

## 3. Two-Factor Authentication (2FA)

### How it works
- Uses **TOTP** (Time-based One-Time Password) — compatible with Google Authenticator, Authy, and similar apps.
- Setup flow:
  1. User requests 2FA setup → server generates a TOTP secret and stores it temporarily in `totp_pending`.
  2. Server returns a QR code URI; user scans it with their authenticator app.
  3. User submits a 6-digit code to confirm → secret moves to `users.totp_secret` and `users.totp_enabled = 1`.
- On login, if 2FA is enabled, the user is asked for their current 6-digit code after password verification.
- **Backup codes**: 8 one-time recovery codes are generated during setup and stored (hashed) in `two_factor_backup_codes`. Use these if you lose your authenticator device.
- Admin can reset 2FA for a user (audit-logged).

### How to make it work
1. Run migration `026_2fa.sql`.
2. Install `otplib` (or `speakeasy`) and `qrcode` packages in the server if not already present.
3. Log in and go to **Profile → Security → Enable 2FA**.
4. Scan the QR code with your authenticator app and confirm with the 6-digit code.

### Where to see it
- `client/src/components/TwoFactorSetup.tsx` — setup UI
- `client/src/pages/Login.tsx` — 2FA challenge step
- `server/src/controllers/twoFactorController.ts`
- `server/src/routes/twoFactorRoutes.ts`
- DB tables: `totp_pending`, `two_factor_backup_codes`

---

## 4. Verification System

### How it works
Two separate verification flows exist based on role:

**Attorneys — IBP Card Verification**
- Attorneys upload a photo of their IBP (Integrated Bar of the Philippines) card.
- The server runs OCR (using Tesseract via `eng.traineddata`) to extract the IBP number.
- Admin reviews the result in the Verification Queue and approves/rejects.
- `users.ibp_verified` is set to `1` on approval.

**Clients — Government ID Verification**
- Clients upload a government-issued ID.
- OCR extracts relevant text for admin review.
- `users.id_verified` is set to `1` on approval.

### How to make it work
1. Run migrations `005_ibp_verification.sql` and `007_client_id_verification.sql`.
2. Ensure `server/eng.traineddata` is present (Tesseract English training data).
3. Attorneys: log in → go to **Profile** → upload IBP card image.
4. Clients: log in → go to **Profile** → upload Government ID image.
5. Admin approves via **Admin → Verification Queue**.

### Where to see it
- `client/src/pages/AdminVerificationQueue.tsx` — admin review UI
- `server/src/controllers/adminController.ts` — approve/reject logic
- DB columns: `users.ibp_verified`, `users.id_verified`

---

## 5. Profile Management

### How it works
Each role has its own profile table extending the base `users` table:

| Role | Profile Table | Key Fields |
|------|---------------|------------|
| Attorney | `attorney_profiles` | IBP number, law firm, specializations, court admissions, bio, availability, photo |
| Client | `client_profiles` | Phone, address, date of birth, occupation, notes, assigned attorney |
| Secretary | `secretary_profiles` | Phone, photo |

Profile photos are uploaded to `server/uploads/profiles/`.

### How to make it work
1. Log in and navigate to **Profile** (top-right avatar or settings dropdown).
2. Edit fields and save. Photo upload uses a file input that sends a `multipart/form-data` request.

### Where to see it
- `client/src/pages/Profile.tsx`
- `client/src/components/UserAvatar.tsx` — displays profile photo everywhere
- `client/src/components/SettingsDropdown.tsx` — settings/profile link
- `server/src/controllers/profileController.ts`
- `server/src/routes/profileRoutes.ts`

---

## 6. Case Management

### How it works
Cases are the core entity of the system. Each case has:
- Auto-generated **case number** (format: `{YEAR}-{SEQ}`, tracked in `case_number_seq`)
- **Case type**: civil, criminal, family, corporate, administrative, labor, other
- **Status**: active, pending, closed, archived
- **Priority**: urgent, high, normal, low
- **Core fields**: title, description, docket number, court name, judge name, filing date, opposing party/counsel, outcome, retainer amount
- A **case timeline** that automatically logs every status change, hearing, filing, note, and document event

Attorneys create cases and assign them to a client. Secretaries can manage cases on behalf of their attorney. Admin can view and reassign any case.

### How to make it work
1. Log in as attorney or admin.
2. Go to **Cases** → click **New Case**.
3. Fill in case details, select the client, and submit.
4. The case number is auto-generated.

### Where to see it
- `client/src/pages/Cases.tsx` — case list
- `client/src/pages/CaseDetail.tsx` — full case detail with tabs
- `client/src/pages/AdminCases.tsx` — admin view of all cases
- `server/src/controllers/caseController.ts`
- `server/src/routes/caseRoutes.ts`
- DB tables: `cases`, `case_timeline`, `case_number_seq`

---

## 7. Case Deadlines

### How it works
Each case can have multiple deadlines with types like:
- `statute_of_limitations`, `filing_deadline`, `response_deadline`, `discovery_deadline`, `trial_date`, `hearing_date`, `pleading_deadline`, `appeal_deadline`, `payment_deadline`, `other`

- Deadlines have a `reminder_days` field — the background job checks this daily.
- **SOL (Statute of Limitations)** deadlines require explicit attorney acknowledgment (`sol_acknowledged_at`).
- Completed deadlines are marked with `is_completed`, `completed_at`, `completed_by`.
- Clients can optionally be notified about a deadline (`notify_client = true`).

### How to make it work
1. Open a **Case Detail** page.
2. Go to the **Deadlines** tab → click **Add Deadline**.
3. Fill in the title, type, due date, and reminder days.
4. The background reminder job handles sending notifications automatically.

### Where to see it
- `client/src/pages/CaseDetail.tsx` — Deadlines tab
- `server/src/controllers/deadlinesController.ts`
- DB table: `case_deadlines`

---

## 8. Case Parties

### How it works
Tracks all external parties involved in a case beyond the client and attorney:
- Party types: opposing party, co-plaintiff, co-defendant, witness, respondent, petitioner, intervenor, third party, prosecutor, public attorney, other
- Stores contact info: name, email, phone, address, organization, notes

### How to make it work
1. Open a **Case Detail** page → **Parties** tab.
2. Click **Add Party**, select the type, and fill in contact info.

### Where to see it
- `client/src/pages/CaseDetail.tsx` — Parties tab
- `server/src/controllers/partiesController.ts`
- DB table: `case_parties`

---

## 9. Case Stages / Progress Workflow

### How it works
Each case progresses through a series of named stages. Stage templates are pre-defined per case type:

| Case Type | Stages |
|-----------|--------|
| Criminal | Investigation → Filing → Arraignment → Pre-Trial → Trial → Judgment → Appeal |
| Civil | Filing → Summons → Pre-Trial → Trial → Decision → Execution |
| Administrative | Filing → Preliminary Conf → Hearing → Decision → Reconsideration |
| Family | Petition → Service → Pre-Trial → Trial → Decision |
| Labor | Filing → Mandatory Conf → Hearing → Decision |

When a case is created, its type's default stages are copied into `case_stages`. The current stage is tracked with `is_current`. Stages can be manually advanced or have notes added.

### How to make it work
1. Cases automatically get stages based on their type on creation.
2. Open **Case Detail** → **Stages** tab to advance the stage, mark it complete, and add notes.

### Where to see it
- `client/src/pages/CaseDetail.tsx` — Stages tab
- `server/src/controllers/stagesController.ts`
- DB tables: `case_stages`, `stage_templates`

---

## 10. Case Tags & Labels

### How it works
Color-coded tags can be created and applied to cases for fast visual triage. Tags are stored in `case_tags` with a hex color, and mapped to cases via `case_tag_map`.

### How to make it work
1. Go to **Cases** list → open any case → use the **Tags** section to add/remove tags.
2. Tags can be created on the fly.
3. Filter the case list by tag from the Cases page filters.

### Where to see it
- `client/src/pages/Cases.tsx` — tag filter
- `client/src/pages/CaseDetail.tsx` — tag management
- `server/src/controllers/tagsController.ts`
- DB tables: `case_tags`, `case_tag_map`

---

## 11. Case Relations

### How it works
Cases can be linked to each other with a relationship type:
- `consolidated`, `appealed_from`, `related_matter`, `cross_claim`, `counterclaim`, `companion`, `other`

This allows attorneys to navigate between related matters quickly from a case's detail page.

### How to make it work
1. Open **Case Detail** → **Relations** tab.
2. Click **Link Case**, search for the related case, and select the relationship type.

### Where to see it
- `client/src/pages/CaseDetail.tsx` — Relations tab
- `server/src/controllers/relationsController.ts`
- DB table: `case_relations`

---

## 12. Co-Counsel Management

### How it works
Additional attorneys can be assigned to a case with specific roles:
- `lead`, `co_counsel`, `supervisor`, `associate`, `paralegal`

Co-counsel have access to the case in their own case list. The primary attorney (`cases.attorney_id`) remains the case owner.

### How to make it work
1. Open **Case Detail** → **Attorneys** tab.
2. Click **Add Attorney**, search for a registered attorney, and assign a role.

### Where to see it
- `client/src/pages/CaseDetail.tsx` — Attorneys tab
- `server/src/controllers/cocounselController.ts`
- DB table: `case_attorneys`

---

## 13. Document Management

### How it works
Documents are attached to cases and stored in `server/uploads/case_{id}/`.

Key features:
- **Allowed types**: PDF, DOC, DOCX, JPG, JPEG, PNG, XLSX, CSV
- **MIME type verification**: actual file bytes are checked (magic bytes), not just the Content-Type header
- **File name sanitization**: special characters are stripped; path traversal attacks are blocked
- **Categories**: pleading, motion, evidence, contract, correspondence, order, judgment, other
- **Privilege markers**: documents can be tagged as attorney-client privilege, work product, or confidential (see Feature 35)
- **Signed download URLs**: downloads use time-limited tokens from the `download_tokens` table instead of direct static URLs — prevents unauthorized link sharing
- **Full-text search**: extracted text from PDFs (via OCR if needed) is stored in `documents.extracted_text` and indexed with MySQL FULLTEXT

### How to make it work
1. Open any **Case Detail** → **Documents** tab.
2. Click **Upload Document**, select the file and category.
3. Documents can be downloaded only through a signed link (expires after a short window).

### Where to see it
- `client/src/pages/CaseDetail.tsx` — Documents tab
- `server/src/controllers/documentController.ts`
- `server/src/controllers/downloadTokenController.ts`
- DB tables: `documents`, `download_tokens`

---

## 14. Document Versioning

### How it works
When a new version of an existing document is uploaded, the previous version is preserved in `document_versions`. Each version stores its own file path, original name, file size, uploader, upload timestamp, and optional notes.

Users can view the full version history and download any previous version (also via signed token).

### How to make it work
1. Open a document in **Case Detail** → **Documents**.
2. Click **Upload New Version** on an existing document.
3. Click **Version History** to browse and download older versions.

### Where to see it
- `client/src/pages/CaseDetail.tsx` — Documents tab → Version History
- `server/src/controllers/documentVersionController.ts`
- DB table: `document_versions`

---

## 15. Document Templates Library

### How it works
A firm-wide library of reusable document templates (contracts, pleadings, motions, letters, affidavits, retainers, etc.). Templates are uploaded files stored in `server/uploads/` and catalogued in `document_templates`.

- **System templates** (`is_system = 1`) are uploaded by the admin and available to all attorneys.
- **Personal templates** are created by individual attorneys.
- Templates can store a `placeholders` JSON array (e.g., `["{{client_name}}", "{{case_number}}"]`) for variable substitution.

### How to make it work
1. Admin: go to **Admin → Settings** or the dedicated Templates section → upload a template file and fill in metadata.
2. Attorneys: go to **Templates** in the main navigation → browse and download templates.
3. Use the placeholder list to know which text to replace in the downloaded file.

### Where to see it
- `client/src/pages/Templates.tsx`
- `server/src/controllers/templateController.ts`
- `server/src/routes/templateRoutes.ts`
- DB table: `document_templates`

---

## 16. Messaging System

### How it works
- **Direct messages** between any two users (attorney ↔ client, attorney ↔ secretary, etc.).
- Messages can be optionally linked to a specific case (`case_id`).
- **Real-time delivery** uses **Socket.IO** (`server/src/socket.ts`). When a message is sent, the server emits a `new_message` event to the recipient's socket room if they are online.
- Messages support **file attachments** (stored in `server/uploads/messages/`).
- Unread message count is tracked with `is_read` and shown in the notification bell.
- Secretary message routing: secretaries can message on behalf of their attorney (tracked via `013_secretary_messages.sql`).

### How to make it work
1. Log in as any user.
2. Navigate to **Messages** in the sidebar.
3. Select a conversation or start a new one by searching for a user.
4. Type a message and press send (or attach a file).
5. Real-time updates require the Socket.IO server to be running (starts automatically with `npm run dev` in the server).

### Where to see it
- `client/src/pages/Messages.tsx`
- `server/src/controllers/messageController.ts`
- `server/src/routes/messageRoutes.ts`
- `server/src/socket.ts` — Socket.IO setup
- DB table: `messages`

---

## 17. Hearing Management

### How it works
Hearings are scheduled events linked to a case. Each hearing has:
- `hearing_type`: trial, pre-trial, arraignment, motion, status conference, appeal, other
- `scheduled_at`: date and time
- `location`: court room / address
- `status`: scheduled, completed, postponed, cancelled
- **iCal export**: each hearing can be exported as a `.ics` file to add to Google Calendar, Apple Calendar, etc.
- **24-hour reminders**: the background job checks every 6 hours for hearings in the next 24 hours and sends email + in-app notifications to the attorney, client, and secretary.

### How to make it work
1. Open **Case Detail** → **Hearings** tab → click **Schedule Hearing**.
2. Fill in the date, time, location, and type.
3. The reminder job runs automatically. Make sure SMTP is configured in `.env` for email reminders.
4. Click **Export .ics** on any hearing to download the calendar file.

### Where to see it
- `client/src/pages/Hearings.tsx` — all hearings list
- `client/src/pages/CaseDetail.tsx` — Hearings tab
- `server/src/controllers/hearingController.ts`
- `server/src/controllers/icalController.ts`
- `server/src/routes/hearingRoutes.ts`
- DB table: `hearings`

---

## 18. Hearing Preparation Checklist

### How it works
Each hearing can have a preparation checklist — a list of todo items that must be done before the hearing. Items track who created them, who marked them done, and when.

### How to make it work
1. Open the **Hearings** tab on a Case Detail page.
2. Select a specific hearing → click **Preparation Checklist**.
3. Add checklist items (e.g., "Prepare witness list", "Organize exhibits").
4. Check off items as they are completed.

### Where to see it
- `client/src/pages/CaseDetail.tsx` — Hearings → Checklist
- `server/src/controllers/hearingChecklistController.ts`
- DB table: `hearing_checklist_items`

---

## 19. Billing & Invoicing

### How it works
**Billing entries** (`case_billing`) track individual charges per case:
- Entry types: `hourly`, `flat_fee`, `court_fee`, `filing_fee`, `expense`, `retainer_deduction`, `other`
- For hourly entries: stores hours worked and hourly rate; `amount` is auto-calculated
- Each entry can be marked as billed (`is_billed`) and paid (`is_paid`)

**Invoices** aggregate selected billing entries into a formal invoice:
- Invoice statuses: `draft`, `sent`, `paid`, `disputed`, `void`
- Stores a snapshot of included billing entry IDs in `entries_json`
- Calculates `subtotal`, `tax_amount`, `total_amount`
- Generates a **PDF** stored at `server/uploads/invoices/`
- Payment reference field for GCash, bank transfer, etc.
- Receipt path for uploaded payment proof

### How to make it work
1. Open **Case Detail** → **Billing** tab → add billing entries (hourly or flat fee).
2. Once you have entries, click **Generate Invoice** → select entries → set due date → save as draft first.
3. When ready, click **Send** — this marks it `sent` and emails the client.
4. Client can view the invoice and upload a payment receipt.
5. Mark invoice as **Paid** and enter the payment reference.

### Where to see it
- `client/src/pages/CaseDetail.tsx` — Billing tab
- `client/src/components/InvoiceManager.tsx` — invoice UI component
- `server/src/controllers/billingController.ts`
- `server/src/controllers/invoiceController.ts`
- DB tables: `case_billing`, `invoices`

---

## 20. Time Tracking

### How it works
A built-in timer allows attorneys and secretaries to track billable time directly in the app:
- Start a timer on a case → work → stop the timer.
- `started_at` and `ended_at` are recorded; `duration_sec` is calculated automatically.
- Entries can also be entered manually (for time tracked outside the app).
- `is_billable` flag controls whether the entry appears in billing.
- Timer entries can be **converted to billing entries** (`billing_id` link), pulling the time directly into the case billing tab.

### How to make it work
1. Look for the **Timer** button (clock icon) in the case detail header or the `TimeTracker` component in the toolbar.
2. Click **Start Timer** → work on the case → click **Stop**.
3. Add a description and confirm to save the time entry.
4. From the **Billing** tab, select saved time entries to include them in an invoice.

### Where to see it
- `client/src/components/TimeTracker.tsx` — floatable timer widget
- `server/src/controllers/timeTrackingController.ts`
- DB table: `time_entries`

---

## 21. Task Management

### How it works
Case tasks are to-do items linked to a specific case:
- Can be assigned to any attorney or secretary on the case
- Priority levels: `low`, `normal`, `high`, `critical`
- Statuses: `pending`, `in_progress`, `done`, `cancelled`
- Optional `due_date` for deadline tracking
- The background weekly report job summarizes open tasks due this week

### How to make it work
1. Open **Case Detail** → **Tasks** tab → click **Add Task**.
2. Set title, description, assignee, due date, and priority.
3. The assigned user sees it in their dashboard task list and receives an in-app notification.
4. Update status by clicking the task and changing its status.

### Where to see it
- `client/src/pages/CaseDetail.tsx` — Tasks tab
- `client/src/pages/AttorneyDashboard.tsx` — task summary widget
- `server/src/controllers/tasksController.ts`
- DB table: `case_tasks`

---

## 22. Notifications

### How it works
The system sends in-app notifications through two channels:
1. **In-app (real-time)**: stored in the `notifications` table and pushed live via Socket.IO.
2. **Email**: sent via SMTP (Nodemailer) using HTML templates in `server/src/templates/emailTemplates.ts`.

Notification types: `new_message`, `case_update`, `hearing_reminder`, `deadline_reminder`, `document_uploaded`, `announcement`, `invoice_sent`, `task_assigned`.

Unread counts are shown in the **Notification Bell** icon in the top navigation. Clicking it opens a dropdown with recent notifications. Individual notifications link to the relevant resource.

### How to make it work
1. SMTP must be configured in `server/.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your@email.com
   SMTP_PASS=your_app_password
   SMTP_FROM="MGC Law System <your@email.com>"
   ```
2. In-app notifications work out of the box once Socket.IO is running.

### Where to see it
- `client/src/components/NotificationBell.tsx` — notification dropdown
- `server/src/controllers/notificationController.ts`
- `server/src/utils/notify.ts` — helper used by all other controllers
- `server/src/routes/notificationRoutes.ts`
- DB table: `notifications`

---

## 23. Notification Preferences

### How it works
Each user can control how they receive each type of notification:
- `both` — in-app + email
- `app` — in-app only
- `email` — email only
- `none` — disabled

Preferences are stored per user in `notification_preferences`. The notification utility checks this table before sending any in-app or email notification.

### How to make it work
1. Go to **Profile → Notification Settings**.
2. Toggle each notification type to your preferred channel.

### Where to see it
- `client/src/pages/Profile.tsx` — Notification Preferences section
- `server/src/controllers/notificationController.ts`
- DB table: `notification_preferences`

---

## 24. Announcements

### How it works
Two types of announcements exist:
- **System-wide announcements** (created by admin): visible to all users
- **Attorney announcements**: created by attorneys, visible to their clients and secretary

Announcements can optionally require **acknowledgment** (`ack_required = 1`). When enabled, users must click an "I acknowledge" button, which is recorded in `announcement_acknowledgments`. Unacknowledged required announcements are displayed prominently.

### How to make it work
1. **Admin**: go to **Admin → Announcements** → click **New Announcement** → fill in title, body, and toggle "Require Acknowledgment" if needed.
2. **Attorney**: go to **Announcements** in the sidebar → click **New Announcement**.
3. Users see announcements on their dashboard and in the **Announcements** page.

### Where to see it
- `client/src/pages/Announcements.tsx` — user-facing list
- `client/src/pages/AdminAnnouncements.tsx` — admin management
- `server/src/controllers/announcementController.ts`
- `server/src/routes/announcementRoutes.ts`
- DB tables: `announcements`, `announcement_acknowledgments`

---

## 25. Secretary Management

### How it works
Attorneys can invite secretaries via email:
1. Attorney sends an invitation → a unique token is emailed to the secretary's address.
2. Secretary clicks the link and completes registration via `SecretaryRegister.tsx`, linked to the invitation token.
3. The `attorney_secretaries` table stores the active link (one secretary → one attorney at a time).

Secretary capabilities:
- View and manage the attorney's cases
- Send/receive messages on the attorney's behalf
- View hearing and deadline calendars
- Manage tasks assigned to them

The attorney can deactivate a secretary link at any time from **Secretary Management**.

### How to make it work
1. Log in as attorney → go to **Secretary Management** in the sidebar.
2. Click **Invite Secretary** → enter their email address.
3. The invited person receives an email with a registration link.
4. After they register, they appear as **Active** in your Secretary Management page.
5. To remove: click **Remove** next to their name.

### Where to see it
- `client/src/pages/SecretaryDashboard.tsx` — secretary's own dashboard
- `client/src/pages/SecretaryManagement.tsx` — attorney's secretary management
- `client/src/pages/SecretaryRegister.tsx` — invitation registration page
- `client/src/pages/SecretaryView.tsx` — attorney viewing secretary details
- `server/src/controllers/secretaryController.ts`
- `server/src/routes/secretaryRoutes.ts`
- DB tables: `secretary_invitations`, `attorney_secretaries`, `secretary_profiles`

---

## 26. Admin Dashboard

### How it works
The admin dashboard provides a system-wide overview:
- **Total users** broken down by role
- **Active users** (logged in within the last 7 days)
- **Pending verifications** count
- **Total cases** by status
- **System health** (DB connection pool, disk usage)
- **Recent activity** feed (last 50 audit log entries)

The dashboard is only accessible to users with `role = 'admin'`.

### How to make it work
1. Run migration `012_admin_system.sql`.
2. Assign the `admin` role to a user in the database:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
   ```
3. Log in with that account — you'll see the **Admin** navigation section.

### Where to see it
- `client/src/pages/AdminDashboard.tsx`
- `client/src/components/AdminLayout.tsx` — admin navigation wrapper
- `server/src/controllers/adminController.ts`
- `server/src/routes/adminRoutes.ts`

---

## 27. User Management (Admin)

### How it works
Admins can manage all user accounts:
- View all users with filters: role, status, verification status, date range, free-text search
- **Create** users directly (bypass normal registration/verification flow if needed)
- **Edit** user profiles — name, email, role, verification status
- **Suspend** an account (blocks login, data retained)
- **Reactivate** a suspended account
- **Delete** a user (soft or hard delete; hard delete is GDPR-compliant purge)
- **Reset password** for any user
- **View audit trail** for a specific user
- **Bulk actions**: suspend multiple users, export user list as CSV

### How to make it work
1. Log in as admin → go to **Admin → Users**.
2. Use filters to find users; click action buttons on any row.

### Where to see it
- `client/src/pages/AdminUsers.tsx`
- `server/src/controllers/adminController.ts`
- `server/src/routes/adminRoutes.ts`

---

## 28. Admin Verification Queue

### How it works
A dedicated queue showing all pending IBP card and government ID verifications. Each entry shows the user's name, role, uploaded image, and OCR-extracted text. Admin can:
- **Approve**: sets `ibp_verified` or `id_verified` to 1, notifies the user
- **Reject**: sends a rejection notification with an optional reason

### How to make it work
1. Log in as admin → go to **Admin → Verification Queue**.
2. Review uploaded images and OCR results.
3. Click **Approve** or **Reject**.

### Where to see it
- `client/src/pages/AdminVerificationQueue.tsx`
- `server/src/controllers/adminController.ts`

---

## 29. Admin Audit Logs

### How it works
Every sensitive action in the system is recorded in the `audit_log` table:
- `user_id`, `action`, `target_type`, `target_id`, `ip_address`, `details`, `created_at`

Examples of logged actions: login, logout, case created/updated/deleted, document uploaded/downloaded, user suspended, 2FA reset, admin impersonation started/ended, settings changed, invoice sent.

The audit log viewer is searchable and filterable, and can be **exported as CSV** for compliance reporting.

### How to make it work
1. The audit log is automatic — no setup needed beyond running the migration.
2. Log in as admin → go to **Admin → Audit Logs**.
3. Apply filters (user, action type, date range) and browse entries.
4. Click **Export CSV** to download a filtered export.

### Where to see it
- `client/src/pages/AdminAuditLogs.tsx`
- `server/src/controllers/auditController.ts`
- `server/src/routes/auditRoutes.ts`
- DB table: `audit_log`

---

## 30. Admin Reports

### How it works
Pre-built system-level reports including:
- User activity report (logins, actions per user)
- Case statistics (cases by status, type, attorney)
- Monthly/quarterly case intake trends
- Verification completion rates
- Billing totals system-wide

Reports can be exported as PDF or CSV.

### How to make it work
1. Log in as admin → go to **Admin → Reports**.
2. Select the report type and date range → generate.

### Where to see it
- `client/src/pages/AdminReports.tsx`
- `server/src/controllers/exportController.ts`

---

## 31. System Settings

### How it works
Admins can configure platform-wide settings stored in a `system_settings` key-value table:

| Setting Area | Examples |
|---|---|
| **Platform** | Site name, maintenance mode toggle |
| **Email / SMTP** | SMTP host, port, username, password |
| **Security** | Session timeout, max login attempts, password minimum length |
| **File uploads** | Max file size, allowed MIME types |
| **Rate limiting** | Requests per window per endpoint group |

Settings changes are audit-logged.

### How to make it work
1. Log in as admin → go to **Admin → Settings**.
2. Modify values and save. Changes take effect immediately (the server reads settings from the DB on each check).

### Where to see it
- `client/src/pages/AdminSettings.tsx`
- `server/src/controllers/settingsController.ts`
- `server/src/routes/settingsRoutes.ts`
- DB table: `system_settings`

---

## 32. Impersonation

### How it works
Admins can temporarily view the system as a specific user (read-only). When impersonation is active:
- The server issues a special session context with the target user's role
- A prominent **ImpersonationBanner** is shown at the top of every page
- All actions taken during impersonation are audit-logged under both the admin's and target user's IDs
- Impersonation ends when the admin clicks **End Impersonation**

This feature is useful for debugging user-reported issues.

### How to make it work
1. Log in as admin → go to **Admin → Users**.
2. Find a user → click **Impersonate**.
3. Browse the system as that user. The orange banner will always be visible.
4. Click **End Impersonation** in the banner to return to your admin account.

### Where to see it
- `client/src/components/ImpersonationBanner.tsx`
- `server/src/controllers/adminController.ts` — impersonate endpoint
- DB column: tracked in `audit_log`

---

## 33. Global Search

### How it works
A system-wide search that queries across:
- **Cases**: title, description, opposing party, docket number (FULLTEXT index)
- **Documents**: original file name, extracted OCR text (FULLTEXT index)
- **Users**: full name, email, username (FULLTEXT index)

Results are grouped by entity type and linked directly to the relevant page.

### How to make it work
1. Click the **Search** icon or bar in the top navigation from any page.
2. Type your query — results appear in real time.
3. Click any result to navigate to it.

### Where to see it
- `client/src/components/GlobalSearch.tsx`
- `server/src/controllers/searchController.ts` — `GET /api/search?q=...`
- `server/src/index.ts` — `/api/search` route registration

---

## 34. Conflict of Interest Checks

### How it works
Before accepting a new client or case, the system can check for conflicts of interest:
- Searches existing cases for the same opposing party name or client name
- Returns a list of potential conflicts with details (case ID, case number, type of conflict)
- The attorney must **acknowledge** the conflicts (`acknowledged_at`) before the check is considered complete
- All conflict checks are recorded in `conflict_checks` for evidentiary/compliance purposes

### How to make it work
1. When creating a new case, a conflict check runs automatically or can be triggered manually.
2. Open **Case Detail** → conflict warnings appear at the top if conflicts are found.
3. Review the flagged matches and click **Acknowledge** to confirm you've reviewed them.

### Where to see it
- `server/src/controllers/conflictController.ts`
- DB table: `conflict_checks`

---

## 35. Privilege Markers

### How it works
Both documents and case notes can be tagged with a legal privilege classification:
- `none` — no privilege (default)
- `attorney_client` — attorney-client privileged communication
- `work_product` — attorney work product doctrine
- `confidential` — general confidentiality marking

These markers control visibility: privileged documents are hidden from clients and non-case users, and are flagged in any export or data request.

### How to make it work
1. When uploading a document or creating a case note, select the **Privilege** dropdown.
2. Choose the appropriate classification before saving.

### Where to see it
- `server/src/controllers/documentController.ts` — privilege filter in queries
- DB columns: `documents.privilege_type`, `case_notes.privilege_type` (added in migration 024)

---

## 36. Case Access Log

### How it works
Every time a case record is opened (read), an entry is written to `case_access_log` recording:
- `case_id`, `user_id`, `role`, `ip_address`, `user_agent`, `accessed_at`

This provides a complete audit trail of who viewed each case, which is critical for attorney-client privilege analysis and discovery proceedings.

### How to make it work
- This is **automatic** — no user action required. Every `GET /api/cases/:id` request triggers a log entry.
- Admins can review access logs in the Audit Logs section filtered by `target_type = 'case'`.

### Where to see it
- `server/src/controllers/caseController.ts` — inserts on case read
- DB table: `case_access_log`

---

## 37. Client Satisfaction Surveys

### How it works
When a case is closed, the attorney can send a satisfaction survey to the client:
- A unique, single-use **token** is generated and emailed to the client as a survey link.
- The survey collects:
  - **NPS score** (0–10): "How likely are you to recommend this attorney?"
  - **Satisfaction rating** (1–5)
  - **Communication rating** (1–5)
  - **Outcome rating** (1–5)
  - **Comments** (free text)
- Responses are stored in `client_surveys` and visible to the attorney in their reports.

### How to make it work
1. Close a case → you'll see a **Send Survey** button.
2. Click it to generate and email the survey link to the client.
3. The client visits the link (no login required) and submits the survey.
4. View results in **Attorney Reports**.

### Where to see it
- `client/src/pages/SurveyPage.tsx` — client-facing survey form
- `server/src/controllers/surveyController.ts`
- `server/src/routes/surveyRoutes.ts`
- DB table: `client_surveys`

---

## 38. Password Reset

### How it works
Standard forgot-password flow:
1. User enters their email on the Forgot Password page.
2. Server generates a secure token stored in `password_reset_tokens` (expires in 1 hour).
3. An email is sent with a link: `/reset-password?token=<token>`.
4. User visits the link, enters a new password.
5. Token is marked as `used = true` — cannot be reused.

Rate limiting: max 5 reset requests per hour per IP.

### How to make it work
1. Go to the **Login** page → click **Forgot Password**.
2. Enter your email and submit.
3. Check your inbox for the reset link.
4. SMTP must be configured in `.env` for emails to be delivered.

### Where to see it
- `client/src/pages/ForgotPassword.tsx`
- `client/src/pages/ResetPassword.tsx`
- `server/src/controllers/passwordResetController.ts`
- `server/src/routes/passwordResetRoutes.ts`
- DB table: `password_reset_tokens`

---

## 39. Automated Background Jobs

These jobs start automatically when the server starts.

### Deadline Reminder Job
- **Runs**: every 24 hours
- **Does**: sends in-app + email notifications for:
  - Overdue deadlines (past due, not completed)
  - Deadlines due in 1 day
  - Deadlines due in 3 days (early warning)
  - Statute of Limitations deadlines (special SOL email template)
- **File**: `server/src/scripts/deadlineReminder.ts`

### Hearing Reminder Job
- **Runs**: every 6 hours
- **Does**: sends in-app + email reminders to attorney, client, and secretary for hearings scheduled within the next 24 hours. Uses `reminder_sent_at` to avoid duplicate sends.
- **File**: `server/src/scripts/hearingReminder.ts`

### Weekly Summary Report Job
- **Runs**: every Monday at 08:00
- **Does**: emails each attorney (and their secretary) a summary of:
  - Active cases count
  - Upcoming hearings this week
  - Deadlines due this week
  - Open tasks due this week
- **File**: `server/src/scripts/weeklyReport.ts`

### Database Backup Job
- **Runs**: on a schedule (see script)
- **Does**: runs `mysqldump` and stores compressed backups in `server/logs/` or a configured backup directory.
- **File**: `server/src/scripts/dbBackup.ts`

### How to make all jobs work
- Jobs start automatically with the server. SMTP must be configured in `.env` for email delivery.
- All jobs throttle their own notifications (won't send duplicates) so they are safe to run without manual management.

---

## 40. Maintenance Mode

### How it works
When the `maintenance_mode` system setting is enabled, all API requests (except from admin accounts) are blocked with a `503 Service Unavailable` response. The front-end shows a **Maintenance Banner** at the top of every page.

### How to make it work
1. Log in as admin → go to **Admin → Settings**.
2. Toggle **Maintenance Mode** on.
3. Non-admin users will see the banner and API calls will be blocked.
4. Toggle it off to restore normal access.

### Where to see it
- `client/src/components/MaintenanceBanner.tsx`
- `server/src/middleware/maintenance.ts`
- DB table: `system_settings` key `maintenance_mode`

---

## 41. iCal / Calendar Export

### How it works
Any hearing can be exported as an `.ics` file (iCalendar format). The file contains the hearing title, date/time, location, and case number. It is compatible with Google Calendar, Apple Calendar, Microsoft Outlook, and any other iCal-compatible app.

### How to make it work
1. Open **Case Detail** → **Hearings** tab.
2. Click **Export to Calendar** (or the calendar icon) on any hearing.
3. Download the `.ics` file and open it to add the event to your calendar.

### Where to see it
- `server/src/controllers/icalController.ts`
- Route: `GET /api/hearings/:id/ical`

---

## 42. Reports (Attorney)

### How it works
Attorneys have their own reports section showing:
- Case outcomes summary (won, lost, settled, etc.)
- Billing totals per case and overall
- Time tracking totals per case
- Hearing and deadline completion rates
- Client satisfaction survey results

Reports can be exported.

### How to make it work
1. Log in as attorney → go to **Reports** in the sidebar.
2. Select a date range and report type.

### Where to see it
- `client/src/pages/AttorneyReports.tsx`
- `server/src/controllers/exportController.ts`

---

## 43. Security Layers

A summary of all active security mechanisms:

| Layer | Implementation |
|---|---|
| Password hashing | bcrypt, 12 rounds |
| JWT strategy | Short-lived access tokens (15 min) + httpOnly refresh tokens (7 days) with rotation |
| 2FA | TOTP via authenticator app + one-time backup codes |
| Rate limiting | `express-rate-limit` — 20 requests/15 min on auth; 5/hour on password reset |
| Login lockout | `login_attempts` table tracks failures; lockout triggers after threshold |
| Security headers | `helmet` — HSTS, X-Frame-Options: DENY, Referrer-Policy, no-sniff |
| CORS | Whitelist of trusted origin only (no wildcards in production) |
| HTTP Parameter Pollution | `hpp` middleware |
| MIME type verification | Magic bytes check on all file uploads (not just Content-Type header) |
| Path traversal protection | File name sanitization on all uploads |
| SQL injection | Parameterized queries throughout; no string interpolation in SQL |
| Input validation | `zod` / `express-validator` schemas on all request bodies |
| CSRF protection | Double-submit cookie pattern (`X-CSRF-Token` header) |
| Signed download URLs | Time-limited tokens in DB; documents never served as plain static files |
| Privilege markers | Attorney-client / work product / confidential classification on docs and notes |
| Case access log | Every case read is recorded with user, role, IP, and user agent |
| Audit log | Comprehensive system-wide action log, admin-searchable and exportable |
| Consent tracking | `users.consent_at` records when the user accepted the privacy notice (RA 10173) |
| Maintenance mode | Blocks all non-admin API access system-wide |

---

## Quick Reference: URL Map

| Page | URL | Who can access |
|---|---|---|
| Landing | `/` | Public |
| Login | `/login` | Public |
| Register | `/register` | Public |
| Forgot Password | `/forgot-password` | Public |
| Reset Password | `/reset-password` | Public (token-gated) |
| Survey | `/survey` | Public (token-gated) |
| Secretary Register | `/secretary-register` | Public (invite token) |
| Attorney Dashboard | `/attorney/dashboard` | Attorney, Secretary |
| Client Dashboard | `/client/dashboard` | Client |
| Secretary Dashboard | `/secretary/dashboard` | Secretary |
| Cases | `/cases` | Attorney, Secretary |
| Case Detail | `/cases/:id` | Attorney, Secretary, Client (own) |
| Clients | `/clients` | Attorney, Secretary |
| Client View | `/clients/:id` | Attorney, Secretary |
| Attorneys | `/attorneys` | Client |
| Attorney View | `/attorneys/:id` | Client |
| Hearings | `/hearings` | Attorney, Secretary, Client |
| Messages | `/messages` | All authenticated |
| Announcements | `/announcements` | All authenticated |
| Templates | `/templates` | Attorney, Secretary |
| Profile | `/profile` | All authenticated |
| Reports | `/reports` | Attorney |
| Secretary Management | `/secretary-management` | Attorney |
| Secretary View | `/secretary/:id` | Attorney |
| Admin Dashboard | `/admin/dashboard` | Admin |
| Admin Users | `/admin/users` | Admin |
| Admin Cases | `/admin/cases` | Admin |
| Admin Verification Queue | `/admin/verification` | Admin |
| Admin Audit Logs | `/admin/audit-logs` | Admin |
| Admin Reports | `/admin/reports` | Admin |
| Admin Announcements | `/admin/announcements` | Admin |
| Admin Settings | `/admin/settings` | Admin |

---

## Quick Start: Run the System

### Prerequisites
- Node.js 18+
- MySQL 8+
- XAMPP (or standalone MySQL + Apache)

### 1. Database Setup
```sql
-- In phpMyAdmin or MySQL CLI:
SOURCE database/schema.sql;
SOURCE database/migrations/001_phase1_core.sql;
SOURCE database/migrations/002_messages.sql;
-- ... run all migrations in order: 003 through 033
```

### 2. Server Setup
```bash
cd server
cp .env.example .env       # fill in DB credentials, JWT secrets, SMTP
npm install
npm run dev                 # starts on port 5000
```

Minimum required `.env` values:
```env
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=law_system_auth
JWT_SECRET=your_super_secret_key_here
JWT_REFRESH_SECRET=another_super_secret_key
CLIENT_ORIGIN=http://localhost:5173
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="MGC Law System <your@gmail.com>"
```

### 3. Client Setup
```bash
cd client
npm install
npm run dev                 # starts on port 5173
```

### 4. Create First Admin
```sql
-- After running all migrations and registering a user:
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

Open `http://localhost:5173` in your browser.
