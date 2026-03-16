# MGC Legal Case Management System — Admin & Secretary Role Expansion

## Complete Implementation Plan & Development Roadmap

---

## Table of Contents

1. [System Administrator Role](#1-system-administrator-role)
2. [Secretary Role (Attorney Assistant)](#2-secretary-role-attorney-assistant)
3. [Database Design Changes](#3-database-design-changes)
4. [System Workflow](#4-system-workflow)
5. [Access Control System (RBAC)](#5-access-control-system-rbac)
6. [UI/UX Design Suggestions](#6-uiux-design-suggestions)
7. [Step-by-Step Development Roadmap](#7-step-by-step-development-roadmap)

---

## 1. System Administrator Role

### 1.1 Core Responsibilities

The System Administrator is the **superuser** of the platform. Unlike attorneys and clients who are case-centric users, the admin operates at the **system level** — managing infrastructure, users, and platform-wide configuration.

| Area | Responsibility |
|------|---------------|
| **User Management** | Create, approve, suspend, reactivate, and delete any user account (attorney, client, secretary) |
| **Verification Oversight** | Manually approve or reject IBP/ID verification results; override failed OCR checks |
| **System Configuration** | Manage platform settings (rate limits, file size limits, SMTP config, maintenance mode) |
| **Security Monitoring** | Monitor login attempts, detect suspicious activity, enforce IP-based restrictions |
| **Audit & Compliance** | Full read access to the audit log; export logs for legal compliance |
| **Announcements** | Create system-wide announcements (distinct from case-specific announcements by attorneys) |
| **Data Management** | Export system data, manage database backups, purge soft-deleted records |
| **Support & Disputes** | Investigate user disputes, review flagged content, manage complaint tickets |

### 1.2 System Permissions

```
admin.*                         → Full system access

admin.users.list                → View all users with filters (role, status, date range)
admin.users.create              → Create any user type directly (bypass verification if needed)
admin.users.update              → Edit user profiles, roles, verification status
admin.users.suspend             → Suspend user account (block login, retain data)
admin.users.reactivate          → Reactivate suspended accounts
admin.users.delete              → Permanently delete user (hard delete with GDPR compliance)
admin.users.impersonate         → View system as a specific user (read-only, audit-logged)

admin.cases.list                → View all cases system-wide
admin.cases.read                → Read any case detail, notes, documents
admin.cases.reassign            → Reassign a case to a different attorney
admin.cases.archive             → Force-archive or close abandoned cases

admin.audit.read                → Full access to audit_log table
admin.audit.export              → Export audit logs as CSV/PDF

admin.settings.read             → View system configuration
admin.settings.update           → Modify system configuration

admin.announcements.create      → Create system-wide announcements
admin.announcements.delete      → Delete any announcement

admin.reports.generate          → Generate system reports (user activity, case statistics)
```

### 1.3 Administrative Dashboard Features

#### System Overview Panel
- **Total users** broken down by role (attorneys, clients, secretaries)
- **Active users** (logged in within last 7 days)
- **Pending verifications** (IBP and ID verification queue)
- **Total cases** by status (active, pending, closed, archived)
- **System health** indicators (DB connection pool usage, disk usage for uploads)
- **Recent activity** feed (last 50 audit log entries)

#### User Management Panel
- **User table** with columns: ID, Name, Email, Role, Status (active/suspended/pending), Verification Status, Created Date, Last Login
- **Filters:** By role, status, verification status, date range, search by name/email
- **Actions per user:** View profile, Edit, Suspend/Reactivate, Reset password, Delete, View audit trail
- **Bulk actions:** Suspend multiple users, Export user list as CSV
- **Verification queue:** List of users awaiting IBP/ID verification with uploaded images, approve/reject buttons

#### Case Oversight Panel
- **Case table** with all system cases (not scoped to a single attorney)
- **Filters:** By status, type, attorney, client, date range
- **Actions:** View detail (read-only), Reassign attorney, Force close/archive
- **Statistics:** Cases per attorney, average case duration, most common case types

#### Audit Log Viewer
- **Searchable, filterable log** of all system actions
- **Columns:** Timestamp, User, Action, Target Type, Target ID, IP Address, Details
- **Filters:** By user, action type, target type, date range
- **Export:** CSV and PDF export for compliance reporting

#### System Settings Panel
- **Platform configuration:** Site name, maintenance mode toggle, max file upload sizes
- **Email settings:** SMTP configuration, email templates preview
- **Security settings:** Session timeout, max login attempts, password policy (min length, complexity)
- **Rate limiting:** Configure limits per endpoint group

#### Announcement Manager
- **Create system-wide announcements** (visible to all users)
- **Manage existing announcements** (edit, delete, set expiry dates)
- **Preview** before publishing

#### Reports & Analytics
- **User registration trends** (weekly/monthly charts)
- **Case volume trends** (cases created/closed over time)
- **Attorney workload distribution** (cases per attorney bar chart)
- **System usage metrics** (API calls, peak hours, storage consumption)

### 1.4 Admin Account Provisioning

The first admin is created via a **database seed script** (not through the public registration form). Subsequent admins can be created by existing admins through the dashboard.

Admins use the **same login page** as other users. After login, the JWT role (`admin`) routes them to `/dashboard/admin`.

Admin accounts do **not** require IBP or ID verification — they are verified by organizational policy.

---

## 2. Secretary Role (Attorney Assistant)

### 2.1 Relationship Model

```
Attorney ─── hires ───→ Secretary
   │                        │
   │  (1 attorney can       │  (1 secretary belongs to
   │   have many            │   exactly 1 attorney)
   │   secretaries)         │
   ▼                        ▼
  1:N relationship via `attorney_secretaries` link table
```

**Key constraints:**
- A Secretary **cannot exist independently** — registration requires an invitation from an attorney
- Each Secretary is **linked to exactly one Attorney** at any given time
- An Attorney can have **multiple Secretaries**
- If the link is severed (attorney removes secretary), the secretary's account becomes **inactive** until re-linked or deleted
- Secretaries **never** appear as case parties — they are operational support staff

### 2.2 Secretary Permissions

#### CAN Do:

| Action | Scope | Details |
|--------|-------|---------|
| **View assigned cases** | Attorney's cases only | See case list, details, timeline, notes (non-private) |
| **Update case info** | Limited fields | Edit case title, case type, court, judge, next hearing date, status notes |
| **Upload documents** | Attorney's cases | Upload case documents (pleadings, evidence, etc.) |
| **Manage hearings** | Attorney's cases | Create, update, reschedule hearings |
| **Send messages** | On behalf of attorney | Message clients assigned to the attorney's cases. Messages are marked "sent by [Secretary Name] on behalf of [Attorney Name]" |
| **View client profiles** | Attorney's clients only | Read client contact info, case history |
| **Manage appointments** | Attorney's calendar | Schedule, reschedule, cancel client appointments |
| **Create announcements** | Attorney's cases only | Post case-specific announcements |
| **View documents** | Attorney's cases | Download and view all case documents |
| **Receive notifications** | Scoped to attorney | Get notified about updates to the attorney's cases |

#### CANNOT Do:

| Restriction | Reason |
|-------------|--------|
| **Delete cases** | Destructive action reserved for attorney |
| **Access other attorneys' cases** | Strict scoping to linked attorney |
| **View private attorney notes** | `is_private = 1` notes are attorney-only unless explicitly shared |
| **Change system settings** | Reserved for admin |
| **Manage other users** | No user management capability |
| **Delete documents** | Destructive action reserved for attorney |
| **Access audit logs** | System-level data, admin-only |
| **Modify client profiles** | Attorney or client responsibility |
| **Create cases** | Attorney-only action (requires professional judgment) |
| **Close or archive cases** | Attorney-only action |

### 2.3 Secretary Account Lifecycle

```
1. Attorney clicks "Invite Secretary" in their dashboard
2. System generates a time-limited invitation token (48h expiry)
3. Invitation email sent to secretary's email address
4. Secretary clicks link → Register page with pre-filled attorney link
5. Secretary fills in: full name, username, email, password
6. Account created with role='secretary', linked to attorney
7. Secretary can log in immediately (no IBP/ID verification required)
8. Attorney can deactivate/remove the secretary at any time
```

---

## 3. Database Design Changes

### 3.1 Migration: Expand Role Enum

```sql
-- Migration: 010_expand_roles.sql

-- Step 1: Expand the role enum on the users table
ALTER TABLE users
  MODIFY COLUMN role ENUM('attorney', 'client', 'admin', 'secretary') NOT NULL;

-- Step 2: Add account status field for suspension support
ALTER TABLE users
  ADD COLUMN status ENUM('active', 'suspended', 'inactive', 'pending') NOT NULL DEFAULT 'active' AFTER role,
  ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL AFTER created_at;
```

### 3.2 Migration: Secretary Invitations & Linking

```sql
-- Migration: 011_secretary_system.sql

-- ─── Secretary Invitations ──────────────────────────────────
CREATE TABLE IF NOT EXISTS secretary_invitations (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  attorney_id   INT            NOT NULL,
  email         VARCHAR(100)   NOT NULL,
  token         VARCHAR(255)   NOT NULL UNIQUE,
  status        ENUM('pending', 'accepted', 'expired', 'revoked') NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at    TIMESTAMP NOT NULL,
  accepted_at   TIMESTAMP NULL DEFAULT NULL,

  FOREIGN KEY (attorney_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_invite_token (token),
  INDEX idx_invite_email (email),
  INDEX idx_invite_attorney (attorney_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Attorney-Secretary Link Table ──────────────────────────
CREATE TABLE IF NOT EXISTS attorney_secretaries (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  attorney_id   INT NOT NULL,
  secretary_id  INT NOT NULL,
  status        ENUM('active', 'inactive', 'removed') NOT NULL DEFAULT 'active',
  hired_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  removed_at    TIMESTAMP NULL DEFAULT NULL,

  FOREIGN KEY (attorney_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (secretary_id) REFERENCES users(id) ON DELETE CASCADE,

  -- Each secretary can only be actively linked to one attorney
  UNIQUE KEY uq_active_secretary (secretary_id, status),
  INDEX idx_attsec_attorney (attorney_id),
  INDEX idx_attsec_secretary (secretary_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Secretary Profile Extension ────────────────────────────
CREATE TABLE IF NOT EXISTS secretary_profiles (
  user_id       INT PRIMARY KEY,
  phone         VARCHAR(20)   NULL,
  photo_path    VARCHAR(255)  NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.3 Migration: Admin System Tables

```sql
-- Migration: 012_admin_system.sql

-- ─── System Settings (Key-Value Store) ──────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  setting_key   VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT         NOT NULL,
  description   VARCHAR(255) NULL,
  updated_by    INT          NULL,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (updated_by) REFERENCES users(id) ON SET NULL,
  INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Default System Settings ────────────────────────────────
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('site_name', 'MGC Law System', 'Platform display name'),
  ('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
  ('max_upload_size_mb', '20', 'Maximum file upload size in MB'),
  ('max_login_attempts', '5', 'Max failed login attempts before lockout'),
  ('lockout_duration_minutes', '15', 'Account lockout duration in minutes'),
  ('session_timeout_days', '7', 'JWT token expiration in days'),
  ('password_min_length', '8', 'Minimum password length'),
  ('require_password_uppercase', 'true', 'Require uppercase in passwords'),
  ('require_password_number', 'true', 'Require number in passwords'),
  ('smtp_host', '', 'SMTP server host'),
  ('smtp_port', '587', 'SMTP server port'),
  ('smtp_from', '', 'Default sender email address');

-- ─── Login Attempts Tracking ────────────────────────────────
CREATE TABLE IF NOT EXISTS login_attempts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(100) NOT NULL,
  ip_address    VARCHAR(45)  NOT NULL,
  success       BOOLEAN      NOT NULL DEFAULT FALSE,
  attempted_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_login_email (email),
  INDEX idx_login_ip (ip_address),
  INDEX idx_login_time (attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── User Suspensions Log ───────────────────────────────────
CREATE TABLE IF NOT EXISTS user_suspensions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT          NOT NULL,
  suspended_by  INT          NOT NULL,
  reason        TEXT         NOT NULL,
  suspended_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  lifted_at     TIMESTAMP    NULL DEFAULT NULL,
  lifted_by     INT          NULL,

  FOREIGN KEY (user_id)      REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (suspended_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (lifted_by)    REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_suspension_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Seed first admin account ───────────────────────────────
-- Password: Admin@MGC2026 (bcrypt hash, 12 rounds)
-- IMPORTANT: Change this password immediately after first login
-- Generate hash with: node -e "require('bcryptjs').hash('Admin@MGC2026',12).then(h=>console.log(h))"
-- INSERT INTO users (fullname, username, email, password, role, status)
-- VALUES ('System Administrator', 'admin', 'admin@mgclaw.com', '<BCRYPT_HASH_HERE>', 'admin', 'active');
```

### 3.4 Migration: Message Attribution for Secretaries

```sql
-- Migration: 013_secretary_messages.sql

-- Allow messages to track "sent on behalf of" for secretary messages
ALTER TABLE messages
  ADD COLUMN sent_on_behalf_of INT NULL DEFAULT NULL AFTER sender_id,
  ADD FOREIGN KEY (sent_on_behalf_of) REFERENCES users(id) ON DELETE SET NULL;
```

### 3.5 Entity Relationship Summary

```
┌──────────────┐       1:N        ┌─────────────────────┐
│    users     │◄─────────────────│  attorney_secretaries│
│ (all roles)  │─────────────────►│                     │
│              │   attorney_id    │  attorney_id (FK)   │
│  id          │   secretary_id   │  secretary_id (FK)  │
│  role        │                  │  status             │
│  status      │                  └─────────────────────┘
│  last_login  │
└──────┬───────┘
       │
       │ 1:N
       ▼
┌──────────────────┐    ┌───────────────────────┐    ┌──────────────────┐
│ attorney_profiles│    │ secretary_profiles    │    │ client_profiles  │
│ (role=attorney)  │    │ (role=secretary)      │    │ (role=client)    │
└──────────────────┘    └───────────────────────┘    └──────────────────┘

┌──────────────────┐        ┌──────────────────┐
│secretary_         │        │ system_settings  │
│ invitations      │        │ (admin-managed)  │
│  attorney_id(FK) │        └──────────────────┘
│  email           │
│  token           │        ┌──────────────────┐
│  status          │        │ login_attempts   │
└──────────────────┘        │ (security)       │
                            └──────────────────┘
┌──────────────────┐
│ user_suspensions │        ┌──────────────────┐
│  user_id (FK)    │        │  audit_log       │
│  suspended_by(FK)│        │  (existing)      │
└──────────────────┘        └──────────────────┘

Messages table gains: sent_on_behalf_of (FK → users.id)
  → When secretary sends a message, sender_id = secretary,
    sent_on_behalf_of = attorney
```

---

## 4. System Workflow

### 4.1 Hiring a Secretary

```
┌─────────────────────────────────────────────────────────────────┐
│                   SECRETARY HIRING FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Attorney Dashboard                                             │
│  ├── Clicks "Manage Secretaries"                                │
│  ├── Clicks "Invite Secretary"                                  │
│  ├── Enters secretary's email address                           │
│  └── System generates invitation                                │
│       │                                                         │
│       ▼                                                         │
│  Backend: POST /api/secretaries/invite                          │
│  ├── Validate attorney role                                     │
│  ├── Check no existing active invitation for this email         │
│  ├── Generate secure random token (crypto.randomBytes(32))      │
│  ├── Insert into secretary_invitations                          │
│  │   (attorney_id, email, token, expires_at = NOW + 48h)       │
│  ├── Send invitation email with link:                           │
│  │   {CLIENT_ORIGIN}/register/secretary?token={token}           │
│  └── Audit log: "secretary_invited"                             │
│       │                                                         │
│       ▼                                                         │
│  Secretary receives email                                       │
│  ├── Clicks registration link                                   │
│  ├── Frontend validates token via GET /api/secretaries/invite   │
│  │   /validate?token={token}                                    │
│  ├── Displays registration form with:                           │
│  │   - Pre-filled: Inviting attorney name (read-only)           │
│  │   - Inputs: Full name, username, email (pre-filled), password│
│  └── Submits registration                                       │
│       │                                                         │
│       ▼                                                         │
│  Backend: POST /api/auth/register-secretary                     │
│  ├── Validate token (exists, not expired, status='pending')     │
│  ├── Create user with role='secretary', status='active'         │
│  ├── Create secretary_profiles row                              │
│  ├── Create attorney_secretaries row                            │
│  │   (attorney_id from invitation, secretary_id = new user)     │
│  ├── Update invitation status = 'accepted'                     │
│  ├── Notify attorney: "Secretary {name} has joined"             │
│  ├── Audit log: "secretary_registered"                          │
│  └── Return JWT token (secretary can log in immediately)        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Removing a Secretary:**
```
Attorney Dashboard → Manage Secretaries → Click "Remove" on secretary
  → Backend: PUT /api/secretaries/:id/remove
  → Sets attorney_secretaries.status = 'removed', removed_at = NOW
  → Sets users.status = 'inactive' for the secretary
  → Secretary's JWT still works until expiry but all API calls
    will check attorney_secretaries.status and reject if not 'active'
  → Audit log: "secretary_removed"
```

### 4.2 Secretary Daily Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│               SECRETARY DAILY WORKFLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. LOGIN & DASHBOARD                                           │
│     Secretary logs in → /dashboard/secretary                    │
│     ├── Sees today's hearings for their attorney's cases        │
│     ├── Sees pending tasks / recent notifications               │
│     ├── Sees quick stats (active cases, upcoming hearings)      │
│     └── Sees recent messages from clients                       │
│                                                                 │
│  2. CASE MANAGEMENT                                             │
│     Navigate to Cases → sees ONLY the linked attorney's cases   │
│     ├── View case details, timeline, documents                  │
│     ├── Update case info (title, type, court, judge)            │
│     ├── Upload new documents to a case                          │
│     ├── Add non-private notes to case timeline                  │
│     └── Cannot: delete cases, view private notes, close cases   │
│                                                                 │
│  3. HEARING MANAGEMENT                                          │
│     Navigate to Hearings → sees attorney's hearings             │
│     ├── Create new hearings (schedule)                          │
│     ├── Reschedule existing hearings                            │
│     ├── Mark hearings as completed                              │
│     └── Notify attorney of scheduling changes                   │
│                                                                 │
│  4. CLIENT COMMUNICATION                                        │
│     Navigate to Messages → sees attorney's client conversations │
│     ├── Send messages to clients (marked "on behalf of")        │
│     ├── View message history                                    │
│     ├── Attach documents to messages                            │
│     └── Cannot: message other attorneys or system admin         │
│                                                                 │
│  5. DOCUMENT MANAGEMENT                                         │
│     Within a case → Documents tab                               │
│     ├── Upload new documents (pleadings, evidence, etc.)        │
│     ├── View and download existing documents                    │
│     └── Cannot: delete documents                                │
│                                                                 │
│  6. NOTIFICATIONS                                               │
│     Bell icon → scoped to attorney's cases                      │
│     ├── New hearing scheduled                                   │
│     ├── Client uploaded a document                              │
│     ├── Case status changed                                     │
│     └── New message from client                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Admin Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN WORKFLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. MORNING CHECK                                               │
│     Admin logs in → /dashboard/admin                            │
│     ├── Review system health panel                              │
│     ├── Check pending verification queue                        │
│     ├── Review overnight audit log activity                     │
│     └── Check for flagged or suspicious activity                │
│                                                                 │
│  2. USER MANAGEMENT                                             │
│     Navigate to Users panel                                     │
│     ├── Process verification queue:                             │
│     │   ├── View uploaded IBP card / Government ID images       │
│     │   ├── Approve → sets ibp_verified/id_verified = 1         │
│     │   └── Reject → sends rejection email with reason          │
│     ├── Handle account issues:                                  │
│     │   ├── Suspend accounts (with reason logged)               │
│     │   ├── Reactivate suspended accounts                       │
│     │   └── Reset user passwords                                │
│     ├── Create new user accounts if needed                      │
│     └── View any user's audit trail                             │
│                                                                 │
│  3. CASE OVERSIGHT                                              │
│     Navigate to Cases panel                                     │
│     ├── Browse all cases system-wide                            │
│     ├── Reassign cases if attorney is unavailable               │
│     ├── Archive abandoned or stale cases                        │
│     └── Generate case statistics reports                        │
│                                                                 │
│  4. SYSTEM CONFIGURATION                                        │
│     Navigate to Settings panel                                  │
│     ├── Adjust security policies (password rules, lockout)      │
│     ├── Configure email/SMTP settings                           │
│     ├── Toggle maintenance mode                                 │
│     └── Update platform display settings                        │
│                                                                 │
│  5. MONITORING & COMPLIANCE                                     │
│     Navigate to Audit Logs panel                                │
│     ├── Search and filter audit entries                         │
│     ├── Investigate specific user actions                       │
│     ├── Export logs for compliance audits                       │
│     └── Monitor login attempt patterns                          │
│                                                                 │
│  6. ANNOUNCEMENTS                                               │
│     Navigate to Announcements panel                             │
│     ├── Create system-wide announcements                        │
│     ├── Manage existing announcements                           │
│     └── View announcement reach/visibility                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Access Control System (RBAC)

### 5.1 Role Hierarchy

```
        ┌───────────────────┐
        │  SYSTEM ADMIN     │  ← Full system access
        │  (Superuser)      │
        └────────┬──────────┘
                 │
     ┌───────────┴───────────┐
     │                       │
┌────▼────────┐    ┌────────▼────────┐
│  ATTORNEY   │    │    SECRETARY    │
│  (Primary)  │◄───│  (Delegated)   │  ← Inherits subset of
└────┬────────┘    └─────────────────┘    attorney permissions
     │
┌────▼────────┐
│   CLIENT    │  ← Most restricted
│  (Consumer) │
└─────────────┘
```

### 5.2 Permission Matrix

| Resource / Action | Admin | Attorney | Secretary | Client |
|-------------------|:-----:|:--------:|:---------:|:------:|
| **Users** | | | | |
| List all users | ✅ | ❌ | ❌ | ❌ |
| Create user | ✅ | ❌¹ | ❌ | ❌ |
| Suspend/reactivate user | ✅ | ❌ | ❌ | ❌ |
| Delete user | ✅ | ❌ | ❌ | ❌ |
| **Cases** | | | | |
| View all cases | ✅ | ❌² | ❌ | ❌ |
| View own/assigned cases | ✅ | ✅ | ✅³ | ✅ |
| Create case | ❌ | ✅ | ❌ | ❌ |
| Update case info | ❌ | ✅ | ✅⁴ | ❌ |
| Delete/close case | ❌ | ✅ | ❌ | ❌ |
| Reassign case | ✅ | ❌ | ❌ | ❌ |
| **Documents** | | | | |
| Upload document | ❌ | ✅ | ✅³ | ✅⁵ |
| Delete document | ❌ | ✅ | ❌ | ❌ |
| View document | ✅ | ✅ | ✅³ | ✅⁵ |
| **Hearings** | | | | |
| Create/update hearing | ❌ | ✅ | ✅³ | ❌ |
| Delete hearing | ❌ | ✅ | ❌ | ❌ |
| View hearings | ✅ | ✅ | ✅³ | ✅ |
| **Messages** | | | | |
| Send messages | ❌ | ✅ | ✅⁶ | ✅ |
| View all messages | ✅⁷ | ❌ | ❌ | ❌ |
| **Announcements** | | | | |
| System-wide announcement | ✅ | ❌ | ❌ | ❌ |
| Case announcement | ❌ | ✅ | ✅³ | ❌ |
| **Settings** | | | | |
| System configuration | ✅ | ❌ | ❌ | ❌ |
| **Audit Logs** | | | | |
| View/export | ✅ | ❌ | ❌ | ❌ |
| **Secretaries** | | | | |
| Invite secretary | ❌ | ✅ | ❌ | ❌ |
| Remove secretary | ✅ | ✅⁸ | ❌ | ❌ |

**Footnotes:**
1. Attorney can invite secretaries only (not create arbitrary users)
2. Attorney sees only their own cases
3. Secretary sees only linked attorney's cases
4. Limited fields only (title, type, court, judge)
5. Client can only view/upload documents marked `is_client_visible`
6. Secretary messages are marked "on behalf of [Attorney]"
7. Admin can view messages for investigation purposes (audit-logged)
8. Attorney can only remove their own secretaries

### 5.3 Backend Enforcement

#### Updated Auth Middleware

```typescript
// server/src/middleware/auth.ts — Updated types

export interface JwtPayload {
  id: number
  fullname: string
  username: string
  role: 'attorney' | 'client' | 'admin' | 'secretary'
  attorneyId?: number  // Present only for secretary role
}

// Updated role check
export const requireRole = (...roles: Array<'attorney' | 'client' | 'admin' | 'secretary'>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Forbidden. Insufficient role.' })
      return
    }
    next()
  }
}

// NEW: Secretary scoping middleware — ensures secretary can only access their attorney's resources
export const requireAttorneyScope = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  if (req.user?.role === 'admin') return next()  // Admin bypasses
  if (req.user?.role === 'attorney') return next()  // Attorney sees own data (filtered in query)
  if (req.user?.role === 'secretary') {
    // Verify active link and inject attorneyId
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT attorney_id FROM attorney_secretaries
       WHERE secretary_id = ? AND status = 'active'`,
      [req.user.id]
    )
    if (rows.length === 0) {
      res.status(403).json({ success: false, message: 'Secretary account not active.' })
      return
    }
    req.user.attorneyId = rows[0].attorney_id
    return next()
  }
  // Client — handled by regular route logic
  next()
}
```

#### Route-Level Enforcement Examples

```typescript
// Cases route — attorney + secretary can access, scoped appropriately
router.get('/cases',
  verifyToken,
  requireRole('attorney', 'client', 'admin', 'secretary'),
  requireAttorneyScope,
  caseController.listCases
)

// In the controller, queries are scoped:
// - admin: SELECT * FROM cases (all)
// - attorney: SELECT * FROM cases WHERE attorney_id = req.user.id
// - secretary: SELECT * FROM cases WHERE attorney_id = req.user.attorneyId
// - client: SELECT * FROM cases WHERE client_id = req.user.id

// Secretary-specific route
router.post('/secretaries/invite',
  verifyToken,
  requireRole('attorney'),
  secretaryController.inviteSecretary
)

// Admin-only routes
router.get('/admin/users',
  verifyToken,
  requireRole('admin'),
  adminController.listUsers
)
```

#### Query-Level Scoping Pattern

```typescript
// Pattern used in every controller that touches cases:
function getCaseScope(user: JwtPayload): { clause: string, params: any[] } {
  switch (user.role) {
    case 'admin':
      return { clause: '1=1', params: [] }  // No filter
    case 'attorney':
      return { clause: 'c.attorney_id = ?', params: [user.id] }
    case 'secretary':
      return { clause: 'c.attorney_id = ?', params: [user.attorneyId] }
    case 'client':
      return { clause: 'c.client_id = ?', params: [user.id] }
  }
}

// Usage in controller:
const scope = getCaseScope(req.user!)
const [cases] = await pool.query(
  `SELECT * FROM cases c WHERE ${scope.clause} AND c.deleted_at IS NULL`,
  scope.params
)
```

### 5.4 Frontend Enforcement

#### Updated ProtectedRoute

```tsx
// client/src/components/ProtectedRoute.tsx

interface Props {
  children: React.ReactNode
  allowedRoles?: Array<'attorney' | 'client' | 'admin' | 'secretary'>
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    const dashboardMap: Record<string, string> = {
      admin: '/dashboard/admin',
      attorney: '/dashboard/attorney',
      secretary: '/dashboard/secretary',
      client: '/dashboard/client',
    }
    return <Navigate to={dashboardMap[user.role] || '/login'} replace />
  }

  return <>{children}</>
}
```

#### Updated App Routes

```tsx
{/* Admin only */}
<Route path="/dashboard/admin" element={
  <ProtectedRoute allowedRoles={['admin']}>
    <AdminDashboard />
  </ProtectedRoute>
} />
<Route path="/admin/users" element={
  <ProtectedRoute allowedRoles={['admin']}>
    <AdminUsers />
  </ProtectedRoute>
} />
<Route path="/admin/settings" element={
  <ProtectedRoute allowedRoles={['admin']}>
    <AdminSettings />
  </ProtectedRoute>
} />
<Route path="/admin/audit-logs" element={
  <ProtectedRoute allowedRoles={['admin']}>
    <AdminAuditLogs />
  </ProtectedRoute>
} />

{/* Secretary only */}
<Route path="/dashboard/secretary" element={
  <ProtectedRoute allowedRoles={['secretary']}>
    <SecretaryDashboard />
  </ProtectedRoute>
} />

{/* Attorney + Secretary shared */}
<Route path="/cases" element={
  <ProtectedRoute allowedRoles={['attorney', 'client', 'secretary']}>
    <Cases />
  </ProtectedRoute>
} />
<Route path="/hearings" element={
  <ProtectedRoute allowedRoles={['attorney', 'secretary']}>
    <Hearings />
  </ProtectedRoute>
} />
```

#### Conditional UI Rendering

```tsx
// Inside Cases.tsx — hide "New Case" button for secretaries
{user?.role === 'attorney' && (
  <button onClick={() => setShowNewCaseModal(true)}>New Case</button>
)}

// Inside CaseDetail.tsx — hide delete button for secretaries
{user?.role === 'attorney' && (
  <button onClick={handleDeleteCase}>Delete Case</button>
)}

// Inside Messages.tsx — show "on behalf of" badge for secretary messages
{message.sent_on_behalf_of && (
  <span className="badge-on-behalf">
    Sent by {message.sender_name} on behalf of {message.attorney_name}
  </span>
)}
```

---

## 6. UI/UX Design Suggestions

### 6.1 Admin Dashboard Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  MGC Admin Panel           🔔 Notifications    👤 Admin ▼ (Logout)  │
├────────────┬─────────────────────────────────────────────────────────┤
│            │                                                         │
│  SIDEBAR   │  MAIN CONTENT AREA                                      │
│            │                                                         │
│  📊 Overview│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  👥 Users   │  │ Total    │ Active   │ Pending  │ Total    │         │
│  📋 Cases   │  │ Users    │ Today    │ Verify   │ Cases    │         │
│  📝 Audit   │  │   247    │   43     │   12     │   891    │         │
│  ⚙️ Settings│  └──────────┴──────────┴──────────┴──────────┘         │
│  📢 Announce│                                                        │
│  📊 Reports │  ┌──────────────────────────────────────────┐          │
│            │  │  USER REGISTRATION TREND (30 days)       │          │
│            │  │  [====== line chart ======]               │          │
│            │  └──────────────────────────────────────────┘          │
│            │                                                         │
│            │  ┌─────────────────────┬────────────────────┐          │
│            │  │ VERIFICATION QUEUE  │ RECENT ACTIVITY    │          │
│            │  │                     │                    │          │
│            │  │ Juan Dela Cruz      │ 10:32 - User login │          │
│            │  │ IBP Card - Pending  │ 10:28 - Case filed │          │
│            │  │ [Approve] [Reject]  │ 10:15 - Doc upload │          │
│            │  │                     │ 09:58 - Hearing    │          │
│            │  │ Maria Santos        │  scheduled          │          │
│            │  │ Gov't ID - Pending  │ 09:45 - User       │          │
│            │  │ [Approve] [Reject]  │  registered         │          │
│            │  └─────────────────────┴────────────────────┘          │
│            │                                                         │
└────────────┴─────────────────────────────────────────────────────────┘
```

#### Admin Pages:

1. **Overview** (`/dashboard/admin`)
   - KPI cards (users, cases, verifications, active sessions)
   - 30-day registration chart
   - Verification queue (top 5 pending, link to full queue)
   - Recent activity feed (last 20 actions)

2. **User Management** (`/admin/users`)
   - Filterable table with all users
   - Inline status badges (active = green, suspended = red, pending = yellow)
   - Expand row → shows user detail panel
   - Action buttons: Edit, Suspend, Reactivate, Reset Password, View Audit
   - Separate tab: "Verification Queue" with side-by-side image viewer + approve/reject

3. **Case Oversight** (`/admin/cases`)
   - All cases table (same as Cases page but unscoped)
   - Additional columns: Attorney name, Client name
   - "Reassign" dropdown to move case to different attorney
   - "Force Archive" button for stale cases

4. **Audit Logs** (`/admin/audit-logs`)
   - Full-width table: Timestamp | User | Action | Target | IP | Details
   - Advanced filters in collapsible panel
   - Date range picker
   - Export buttons (CSV, PDF)

5. **System Settings** (`/admin/settings`)
   - Grouped form sections:
     - General (site name, maintenance mode)
     - Security (password policy, lockout settings, session timeout)
     - Email (SMTP config, test email button)
     - Uploads (max file sizes per category)
   - Save button per section
   - "Test Connection" for SMTP

6. **Announcements** (`/admin/announcements`)
   - Same as attorney announcements but labeled "System-Wide"
   - Visibility badge: "All Users" vs "Case-Specific"
   - Manage / Delete any announcement

7. **Reports** (`/admin/reports`)
   - Prebuilt reports:
     - User Activity Summary (daily/weekly/monthly)
     - Case Volume Report
     - Attorney Workload Distribution
     - Storage Usage Report
   - Date range selector
   - Export as PDF / CSV

### 6.2 Secretary Dashboard Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  MGC Law System     Working for: Atty. Juan Cruz    🔔    👤 ▼      │
├────────────┬─────────────────────────────────────────────────────────┤
│            │                                                         │
│  SIDEBAR   │  MAIN CONTENT AREA                                      │
│            │                                                         │
│  📊 Overview│  ┌──────────┬──────────┬──────────┐                    │
│  📋 Cases   │  │ Active   │ Upcoming │ Pending  │                    │
│  📅 Hearings│  │ Cases    │ Hearings │ Docs     │                    │
│  💬 Messages│  │   23     │   4      │   7      │                    │
│  📢 Announce│  └──────────┴──────────┴──────────┘                    │
│  👤 Profile │                                                        │
│            │  ┌──────────────────────────────────────────┐          │
│  ─────────  │  │  TODAY'S SCHEDULE                        │          │
│  Attorney:  │  │  [====== calendar / list view ======]    │          │
│  Atty. Cruz │  └──────────────────────────────────────────┘          │
│            │                                                         │
│            │  ┌─────────────────────┬────────────────────┐          │
│            │  │ RECENT CASE UPDATES │ CLIENT MESSAGES    │          │
│            │  │                     │                    │          │
│            │  │ Case MGC-2026-00042 │ Maria Santos:      │          │
│            │  │ Hearing rescheduled │ "When is the next  │          │
│            │  │                     │  hearing?"         │          │
│            │  │ Case MGC-2026-00038 │                    │          │
│            │  │ Document uploaded   │ Pedro Reyes:       │          │
│            │  │                     │ "I sent the docs"  │          │
│            │  └─────────────────────┴────────────────────┘          │
│            │                                                         │
└────────────┴─────────────────────────────────────────────────────────┘
```

#### Secretary Pages:

1. **Dashboard** (`/dashboard/secretary`)
   - KPI cards (active cases, today's hearings, pending documents)
   - Today's hearing schedule (compact list or mini-calendar)
   - Recent case activity (scoped to attorney's cases)
   - Latest client messages (compact inbox view)
   - Header shows: "Working for: Atty. [Name]"

2. **Cases** (`/cases`) — shared page, scoped to attorney's cases
   - Same table as attorney but:
     - No "New Case" button
     - No "Delete" action
     - "Edit" limited to allowed fields

3. **Hearings** (`/hearings`) — shared page, scoped
   - Can create / reschedule hearings
   - Cannot delete hearings

4. **Messages** (`/messages`) — shared page, scoped to attorney's clients
   - Contact list shows only the attorney's clients
   - Messages sent show "Sent by [Secretary] on behalf of Atty. [Name]"
   - Same attachment support

5. **Announcements** (`/announcements`) — can create case-specific announcements

6. **Profile** (`/profile`) — own profile management
   - Name, phone, photo
   - Password change

---

## 7. Step-by-Step Development Roadmap

### Phase 1: Database & Auth Foundation

**Goal:** Extend the database and authentication system to support 4 roles.

#### Tasks:

| # | Task | Files Modified | New Files |
|---|------|---------------|-----------|
| 1.1 | Create migration `010_expand_roles.sql` — expand role enum, add `status` + `last_login` columns to `users` | — | `database/migrations/010_expand_roles.sql` |
| 1.2 | Create migration `011_secretary_system.sql` — `secretary_invitations`, `attorney_secretaries`, `secretary_profiles` tables | — | `database/migrations/011_secretary_system.sql` |
| 1.3 | Create migration `012_admin_system.sql` — `system_settings`, `login_attempts`, `user_suspensions` tables + seed data | — | `database/migrations/012_admin_system.sql` |
| 1.4 | Create migration `013_secretary_messages.sql` — add `sent_on_behalf_of` to `messages` | — | `database/migrations/013_secretary_messages.sql` |
| 1.5 | Update `JwtPayload` interface to include `'admin' \| 'secretary'` roles + optional `attorneyId` | `server/src/middleware/auth.ts` | — |
| 1.6 | Update `requireRole()` to accept all 4 roles | `server/src/middleware/auth.ts` | — |
| 1.7 | Create `requireAttorneyScope` middleware | `server/src/middleware/auth.ts` | — |
| 1.8 | Create scope utility `getCaseScope()` | — | `server/src/utils/scope.ts` |
| 1.9 | Update `register` in `authController.ts` to reject `admin`/`secretary` from public registration | `server/src/controllers/authController.ts` | — |
| 1.10 | Update `login` in `authController.ts` to check `users.status`, track `last_login`, log `login_attempts` | `server/src/controllers/authController.ts` | — |
| 1.11 | Create admin seed script (Node.js script to insert first admin) | — | `server/src/scripts/seedAdmin.ts` |
| 1.12 | Run all migrations and verify DB state | — | — |

**Verification:** Admin can log in with seeded account. Existing attorney/client login still works. Secretary registration blocked from public form.

---

### Phase 2: Secretary Backend

**Goal:** Full secretary invitation, registration, and scoped access.

#### Tasks:

| # | Task | Files Modified | New Files |
|---|------|---------------|-----------|
| 2.1 | Create `secretaryController.ts` — invite, validate token, register, list, remove | — | `server/src/controllers/secretaryController.ts` |
| 2.2 | Create `secretaryRoutes.ts` — all secretary-related endpoints | — | `server/src/routes/secretaryRoutes.ts` |
| 2.3 | Register secretary routes in `index.ts` | `server/src/index.ts` | — |
| 2.4 | Create email template for secretary invitation | — | `server/src/templates/secretaryInvite.ts` |
| 2.5 | Update `caseController.ts` — scope case queries using `getCaseScope()`, allow secretary to update limited fields | `server/src/controllers/caseController.ts` | — |
| 2.6 | Update `hearingController.ts` — allow secretary access (create/update, no delete) | `server/src/controllers/hearingController.ts` | — |
| 2.7 | Update `documentController.ts` — allow secretary upload, block delete | `server/src/controllers/documentController.ts` | — |
| 2.8 | Update `messageController.ts` — secretary sends on behalf of attorney, scoped contacts | `server/src/controllers/messageController.ts` | — |
| 2.9 | Update `announcementController.ts` — secretary can create case-specific announcements | `server/src/controllers/announcementController.ts` | — |
| 2.10 | Update `notificationController.ts` — secretary receives attorney's case notifications | `server/src/controllers/notificationController.ts` | — |
| 2.11 | Update `profileController.ts` — add secretary profile endpoints | `server/src/controllers/profileController.ts` | — |
| 2.12 | Update all route files to include secretary role where appropriate | `server/src/routes/*.ts` | — |

**Verification:** Attorney can invite secretary. Secretary can register via invitation link. Secretary can view/update attorney's cases. Secretary cannot delete cases. Secretary messages show "on behalf of" attribution.

---

### Phase 3: Admin Backend

**Goal:** Full admin dashboard API.

#### Tasks:

| # | Task | Files Modified | New Files |
|---|------|---------------|-----------|
| 3.1 | Create `adminController.ts` — user CRUD, stats, verification management, case oversight | — | `server/src/controllers/adminController.ts` |
| 3.2 | Create `adminRoutes.ts` — all admin endpoints | — | `server/src/routes/adminRoutes.ts` |
| 3.3 | Create `settingsController.ts` — system settings CRUD | — | `server/src/controllers/settingsController.ts` |
| 3.4 | Create `settingsRoutes.ts` | — | `server/src/routes/settingsRoutes.ts` |
| 3.5 | Create `auditController.ts` — advanced log querying, filtering, export | — | `server/src/controllers/auditController.ts` |
| 3.6 | Create `auditRoutes.ts` | — | `server/src/routes/auditRoutes.ts` |
| 3.7 | Register all new admin routes in `index.ts` | `server/src/index.ts` | — |
| 3.8 | Update `authController.ts` — add admin user creation endpoint (admin-only) | `server/src/controllers/authController.ts` | — |
| 3.9 | Implement login attempt tracking and lockout logic | `server/src/controllers/authController.ts` | — |
| 3.10 | Implement user suspension/reactivation with audit logging | `server/src/controllers/adminController.ts` | — |
| 3.11 | Implement verification queue management (approve/reject with reason) | `server/src/controllers/adminController.ts` | — |
| 3.12 | Implement report generation endpoints (user stats, case stats, workload) | `server/src/controllers/adminController.ts` | — |

**Verification:** Admin can list all users, suspend/reactivate accounts, approve verifications, view audit logs, manage settings, view all cases, generate reports.

---

### Phase 4: Frontend — Auth & Routing Updates

**Goal:** Update the frontend authentication flow and routing to handle 4 roles.

#### Tasks:

| # | Task | Files Modified | New Files |
|---|------|---------------|-----------|
| 4.1 | Update `AuthContext.tsx` — expand User type with all 4 roles + `attorneyId` for secretaries | `client/src/context/AuthContext.tsx` | — |
| 4.2 | Update `ProtectedRoute.tsx` — support 4 roles, redirect to correct dashboard | `client/src/components/ProtectedRoute.tsx` | — |
| 4.3 | Update `api.ts` — add admin API endpoints, secretary API endpoints | `client/src/services/api.ts` | — |
| 4.4 | Update `authService.ts` — add `registerSecretary()` method | `client/src/services/authService.ts` | — |
| 4.5 | Update `App.tsx` — add admin routes, secretary routes, secretary registration route | `client/src/App.tsx` | — |
| 4.6 | Update `Login.tsx` — redirect to correct dashboard after login based on role | `client/src/pages/Login.tsx` | — |
| 4.7 | Create `SecretaryRegister.tsx` — invitation-based registration page | — | `client/src/pages/SecretaryRegister.tsx` |

**Verification:** Users of all 4 roles are redirected to their correct dashboard. Secretary registration link works. Unauthorized routes redirect properly.

---

### Phase 5: Frontend — Secretary Dashboard & Pages

**Goal:** Build the secretary user interface.

#### Tasks:

| # | Task | Files Modified | New Files |
|---|------|---------------|-----------|
| 5.1 | Create `SecretaryDashboard.tsx` — overview stats, today's hearings, recent activity, messages | — | `client/src/pages/SecretaryDashboard.tsx` |
| 5.2 | Update `Cases.tsx` — hide "New Case" / "Delete" buttons for secretary; scope queries | `client/src/pages/Cases.tsx` | — |
| 5.3 | Update `CaseDetail.tsx` — limit edit fields for secretary; hide private notes; hide delete | `client/src/pages/CaseDetail.tsx` | — |
| 5.4 | Update `Hearings.tsx` — allow create/edit for secretary; hide delete | `client/src/pages/Hearings.tsx` | — |
| 5.5 | Update `Messages.tsx` — show "on behalf of" badge; scope contacts to attorney's clients | `client/src/pages/Messages.tsx` | — |
| 5.6 | Update `Announcements.tsx` — secretary can create case-specific announcements | `client/src/pages/Announcements.tsx` | — |
| 5.7 | Update `Profile.tsx` — secretary profile fields | `client/src/pages/Profile.tsx` | — |
| 5.8 | Create `SecretaryManagement.tsx` — attorney page to invite/manage secretaries | — | `client/src/pages/SecretaryManagement.tsx` |
| 5.9 | Add "Manage Secretaries" link to attorney dashboard/sidebar | `client/src/pages/AttorneyDashboard.tsx` | — |

**Verification:** Secretary can log in, see scoped cases, manage hearings, send messages on behalf, upload documents. Attorney can invite/remove secretaries.

---

### Phase 6: Frontend — Admin Dashboard & Pages

**Goal:** Build the full admin interface.

#### Tasks:

| # | Task | Files Modified | New Files |
|---|------|---------------|-----------|
| 6.1 | Create `AdminDashboard.tsx` — overview KPIs, charts, verification queue, activity feed | — | `client/src/pages/AdminDashboard.tsx` |
| 6.2 | Create `AdminUsers.tsx` — user management table with filters, actions, bulk operations | — | `client/src/pages/AdminUsers.tsx` |
| 6.3 | Create `AdminVerificationQueue.tsx` — side-by-side image viewer, approve/reject with reason | — | `client/src/pages/AdminVerificationQueue.tsx` |
| 6.4 | Create `AdminCases.tsx` — all cases table, reassign, force archive | — | `client/src/pages/AdminCases.tsx` |
| 6.5 | Create `AdminAuditLogs.tsx` — searchable audit log viewer with date range + export | — | `client/src/pages/AdminAuditLogs.tsx` |
| 6.6 | Create `AdminSettings.tsx` — grouped settings form (general, security, email, uploads) | — | `client/src/pages/AdminSettings.tsx` |
| 6.7 | Create `AdminAnnouncements.tsx` — system-wide announcement management | — | `client/src/pages/AdminAnnouncements.tsx` |
| 6.8 | Create `AdminReports.tsx` — prebuilt reports with charts and export | — | `client/src/pages/AdminReports.tsx` |
| 6.9 | Create admin sidebar/navigation component | — | `client/src/components/AdminSidebar.tsx` |

**Verification:** Admin can manage all users, view/export audit logs, configure system settings, manage announcements, view all cases, generate reports.

---

### Phase 7: Testing, Security & Polish

**Goal:** Ensure security, test edge cases, and polish the experience.

#### Tasks:

| # | Task | Details |
|---|------|---------|
| 7.1 | **Permission boundary testing** — Verify every API endpoint rejects unauthorized roles. Test secretary accessing other attorney's cases (must fail). Test client accessing admin routes (must fail). |
| 7.2 | **Account lifecycle testing** — Test suspension flow: suspended user cannot log in, existing JWT is rejected. Test secretary removal: removed secretary cannot access attorney's cases. |
| 7.3 | **Invitation expiry testing** — Expired invitation tokens must be rejected. Revoked invitations must be rejected. Double-registration with same token must fail. |
| 7.4 | **Login security testing** — Login lockout after N failed attempts. Lockout duration is enforced. Successful login resets attempt counter. |
| 7.5 | **Audit log coverage** — Verify every sensitive action creates an audit entry: login, suspend, case reassign, verification approve/reject, settings change. |
| 7.6 | **Message attribution** — Secretary messages display "on behalf of" correctly. Clients see attorney's name prominently, secretary name secondarily. |
| 7.7 | **Admin seed script testing** — Test seed script creates admin correctly. Test admin can create other admin accounts via dashboard. |
| 7.8 | **UI responsiveness** — All new pages work on mobile/tablet viewports. Admin dashboard grid adapts to screen size. |
| 7.9 | **Error handling** — All new endpoints return proper error messages. Frontend shows meaningful error toasts. |
| 7.10 | **Update documentation** — Update API documentation. Add admin & secretary API endpoint reference. |

---

### Phase Summary & Dependencies

```
Phase 1 ──→ Phase 2 ──→ Phase 5
   │             │
   │             └──→ Phase 3 ──→ Phase 6
   │                                │
   └──→ Phase 4 ────────────────────┘
                                    │
                              Phase 7
```

- **Phase 1** (DB + Auth) is the foundation — everything depends on it
- **Phase 2** (Secretary backend) and **Phase 3** (Admin backend) can be developed in parallel after Phase 1
- **Phase 4** (Frontend auth) can start alongside Phase 2/3
- **Phase 5** (Secretary UI) requires Phase 2 + Phase 4
- **Phase 6** (Admin UI) requires Phase 3 + Phase 4
- **Phase 7** (Testing) runs after all other phases

---

### New API Endpoints Summary

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| **Secretary Endpoints** | | | | |
| POST | `/api/secretaries/invite` | ✅ | attorney | Send secretary invitation |
| GET | `/api/secretaries/invite/validate` | ❌ | — | Validate invitation token |
| POST | `/api/auth/register-secretary` | ❌ | — | Register via invitation |
| GET | `/api/secretaries` | ✅ | attorney | List attorney's secretaries |
| PUT | `/api/secretaries/:id/remove` | ✅ | attorney | Remove secretary |
| GET | `/api/secretaries/profile` | ✅ | secretary | Get own profile |
| PUT | `/api/secretaries/profile` | ✅ | secretary | Update own profile |
| **Admin Endpoints** | | | | |
| GET | `/api/admin/dashboard` | ✅ | admin | Dashboard KPIs |
| GET | `/api/admin/users` | ✅ | admin | List all users (filterable) |
| GET | `/api/admin/users/:id` | ✅ | admin | User detail |
| PUT | `/api/admin/users/:id` | ✅ | admin | Update user |
| POST | `/api/admin/users` | ✅ | admin | Create user (any role) |
| PUT | `/api/admin/users/:id/suspend` | ✅ | admin | Suspend user |
| PUT | `/api/admin/users/:id/reactivate` | ✅ | admin | Reactivate user |
| DELETE | `/api/admin/users/:id` | ✅ | admin | Delete user |
| PUT | `/api/admin/users/:id/reset-password` | ✅ | admin | Force password reset |
| GET | `/api/admin/verifications` | ✅ | admin | Pending verification queue |
| PUT | `/api/admin/verifications/:id/approve` | ✅ | admin | Approve verification |
| PUT | `/api/admin/verifications/:id/reject` | ✅ | admin | Reject verification |
| GET | `/api/admin/cases` | ✅ | admin | All cases (unscoped) |
| PUT | `/api/admin/cases/:id/reassign` | ✅ | admin | Reassign case attorney |
| PUT | `/api/admin/cases/:id/archive` | ✅ | admin | Force archive case |
| GET | `/api/admin/audit-logs` | ✅ | admin | Query audit logs |
| GET | `/api/admin/audit-logs/export` | ✅ | admin | Export audit logs |
| GET | `/api/admin/settings` | ✅ | admin | Get system settings |
| PUT | `/api/admin/settings` | ✅ | admin | Update system settings |
| GET | `/api/admin/reports/:type` | ✅ | admin | Generate report |
| POST | `/api/admin/announcements` | ✅ | admin | Create system announcement |

---

### New Files Summary

**Server:**
```
server/src/controllers/adminController.ts
server/src/controllers/secretaryController.ts
server/src/controllers/settingsController.ts
server/src/controllers/auditController.ts
server/src/routes/adminRoutes.ts
server/src/routes/secretaryRoutes.ts
server/src/routes/settingsRoutes.ts
server/src/routes/auditRoutes.ts
server/src/utils/scope.ts
server/src/templates/secretaryInvite.ts
server/src/scripts/seedAdmin.ts
```

**Client:**
```
client/src/pages/AdminDashboard.tsx
client/src/pages/AdminUsers.tsx
client/src/pages/AdminVerificationQueue.tsx
client/src/pages/AdminCases.tsx
client/src/pages/AdminAuditLogs.tsx
client/src/pages/AdminSettings.tsx
client/src/pages/AdminAnnouncements.tsx
client/src/pages/AdminReports.tsx
client/src/pages/SecretaryDashboard.tsx
client/src/pages/SecretaryRegister.tsx
client/src/pages/SecretaryManagement.tsx
client/src/components/AdminSidebar.tsx
```

**Database:**
```
database/migrations/010_expand_roles.sql
database/migrations/011_secretary_system.sql
database/migrations/012_admin_system.sql
database/migrations/013_secretary_messages.sql
```

---

### Modified Files Summary

**Server:**
```
server/src/middleware/auth.ts           — 4-role JWT, requireAttorneyScope
server/src/index.ts                    — register new routes
server/src/controllers/authController.ts    — login lockout, status check, secretary registration
server/src/controllers/caseController.ts    — scoped queries, secretary limited edit
server/src/controllers/hearingController.ts — secretary access
server/src/controllers/documentController.ts — secretary upload access
server/src/controllers/messageController.ts  — on-behalf-of messaging
server/src/controllers/announcementController.ts — secretary announcements
server/src/controllers/notificationController.ts — secretary notifications
server/src/controllers/profileController.ts — secretary profile
server/src/routes/caseRoutes.ts        — add secretary role
server/src/routes/hearingRoutes.ts     — add secretary role
server/src/routes/documentRoutes.ts    — add secretary role
server/src/routes/messageRoutes.ts     — add secretary role
server/src/routes/announcementRoutes.ts — add secretary role
server/src/routes/notificationRoutes.ts — add secretary role
server/src/routes/profileRoutes.ts     — add secretary role
```

**Client:**
```
client/src/context/AuthContext.tsx      — 4-role User type
client/src/components/ProtectedRoute.tsx — 4-role routing
client/src/services/api.ts             — admin + secretary endpoints
client/src/services/authService.ts     — registerSecretary()
client/src/App.tsx                     — new routes
client/src/pages/Login.tsx             — 4-role redirect
client/src/pages/Cases.tsx             — conditional UI for secretary
client/src/pages/CaseDetail.tsx        — limited edit for secretary
client/src/pages/Hearings.tsx          — secretary access
client/src/pages/Messages.tsx          — on-behalf-of display
client/src/pages/Announcements.tsx     — secretary announcements
client/src/pages/Profile.tsx           — secretary profile
client/src/pages/AttorneyDashboard.tsx — manage secretaries link
```
