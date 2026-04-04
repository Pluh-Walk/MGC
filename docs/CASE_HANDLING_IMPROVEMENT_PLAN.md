# Case Handling Improvement Plan
**MGC Legal Case Management System**
*Last Updated: April 2, 2026*

---

## Executive Summary

The current case handling implementation provides a solid foundation — case creation with draft workflow, status management, document uploads, hearing scheduling, timeline tracking, and per-case notes. However, for a system whose **core purpose is legal case management**, several critical features are missing. This document outlines a phased enhancement plan covering data model gaps, workflow improvements, and UI/UX enhancements specifically needed for legal practice.

---

## Current State Assessment

### What We Have
| Feature | Status |
|---|---|
| Case creation (attorney + secretary draft flow) | ✅ Done |
| Case statuses: draft / active / pending / closed / archived | ✅ Done |
| Case types: civil / criminal / family / corporate / other | ✅ Done |
| Auto-generated case number (MGC-YYYY-NNNNN) | ✅ Done |
| Case timeline (auto-logged events) | ✅ Done |
| Case notes (private/public) | ✅ Done |
| Document upload with client visibility toggle | ✅ Done |
| Hearing scheduling with notifications | ✅ Done |
| Admin case reassignment and archiving | ✅ Done |
| Role-based access (attorney/secretary/client/admin) | ✅ Done |
| Soft delete | ✅ Done |

### Critical Gaps
| Missing Feature | Risk Level |
|---|---|
| No formal case parties / opposing party tracking | 🔴 High |
| No deadline / statute of limitations management | 🔴 High |
| No case outcome / verdict tracking | 🔴 High |
| No court docket number / official filing reference | 🔴 High |
| No case description / background narrative field | 🟡 Medium |
| No billing / legal fee tracking | 🟡 Medium |
| No case priority levels | 🟡 Medium |
| No multi-attorney (co-counsel) support | 🟡 Medium |
| No evidence categorization beyond generic "documents" | 🟡 Medium |
| No case closure checklist / formal closure workflow | 🟡 Medium |
| No conflict-of-interest tracking | 🟡 Medium |
| No related/linked cases support | 🟡 Medium |
| No case tags / labels for custom categorization | 🟢 Low |
| No client consultation log | 🟢 Low |
| No case progress indicator | 🟢 Low |

---

## Phase 1 — Core Legal Data Model (Critical Fixes)

These are missing fields and tables that are fundamental to legal practice. They directly affect data integrity and professional usefulness.

### 1.1 Enrich the `cases` Table

**Add the following columns to the existing `cases` table:**

```sql
-- Case description / background narrative
ALTER TABLE cases ADD COLUMN description TEXT NULL AFTER title;

-- Official court docket number (different from MGC internal case number)
ALTER TABLE cases ADD COLUMN docket_number VARCHAR(100) NULL AFTER court_name;

-- Case outcome (filled when status becomes 'closed')
ALTER TABLE cases ADD COLUMN outcome ENUM('won','lost','settled','dismissed','withdrawn','transferred','other') NULL;

-- Outcome notes / verdict summary
ALTER TABLE cases ADD COLUMN outcome_notes TEXT NULL;

-- Case priority
ALTER TABLE cases ADD COLUMN priority ENUM('urgent','high','normal','low') NOT NULL DEFAULT 'normal';

-- Opposing party name (simplest form for initial implementation)
ALTER TABLE cases ADD COLUMN opposing_party VARCHAR(200) NULL;

-- Opposing counsel name
ALTER TABLE cases ADD COLUMN opposing_counsel VARCHAR(200) NULL;

-- Date case was officially closed
ALTER TABLE cases ADD COLUMN closed_at DATE NULL;

-- Retainer amount agreed upon (nullable — not all cases have retainers)
ALTER TABLE cases ADD COLUMN retainer_amount DECIMAL(12,2) NULL;
```

**Why this matters:**
- `docket_number` — Every court case has an official docket number assigned by the court. Attorneys reference this constantly when filing and communicating with courts.
- `outcome` — A legal case management system that doesn't track whether you won or lost is incomplete. Helps attorneys analyze their win rate and case history.
- `priority` — Attorneys juggle many cases. Urgent/high cases with approaching deadlines must surface to the top.
- `opposing_party` / `opposing_counsel` — Needed for conflict of interest checks and basic case context.
- `description` — Attorneys need a place to describe the case background, facts, and legal basis.

---

### 1.2 Case Parties Table (Formal)

For cases with multiple parties, witnesses, or respondents, a dedicated table is needed.

```sql
CREATE TABLE case_parties (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  case_id     INT NOT NULL,
  party_type  ENUM('client','opposing_party','co_plaintiff','co_defendant','witness','respondent','petitioner','intervenor','third_party','other') NOT NULL,
  fullname    VARCHAR(200) NOT NULL,
  email       VARCHAR(150) NULL,
  phone       VARCHAR(50) NULL,
  address     TEXT NULL,
  organization VARCHAR(200) NULL,   -- company, law firm, etc.
  notes       TEXT NULL,
  created_by  INT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)    REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Why this matters:** Most real cases have multiple parties. Criminal cases have prosecutors, defendants, witnesses. Civil cases have plaintiffs, defendants, intervenors. Without a proper party table, attorneys can't document who is involved.

---

### 1.3 Case Deadlines Table

This is arguably the most important missing feature. Missing a legal deadline can result in malpractice.

```sql
CREATE TABLE case_deadlines (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  case_id         INT NOT NULL,
  title           VARCHAR(200) NOT NULL,
  description     TEXT NULL,
  deadline_type   ENUM('statute_of_limitations','filing_deadline','response_deadline','discovery_deadline','trial_date','hearing_date','pleading_deadline','appeal_deadline','other') NOT NULL DEFAULT 'other',
  due_date        DATE NOT NULL,
  reminder_days   INT NOT NULL DEFAULT 7,   -- days before due_date to send reminder
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    DATETIME NULL,
  completed_by    INT NULL,
  notify_client   BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      INT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)       REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by)  REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Why this matters:** Statute of limitations, filing deadlines, and response deadlines are non-negotiable in legal practice. Missing them can lose a case outright. The system must track these and proactively send reminders.

---

### 1.4 Extend Case Type ENUM

The current `case_type` options are too limited. Philippine legal practice (and most jurisdictions) needs more types.

```sql
ALTER TABLE cases MODIFY COLUMN case_type 
  ENUM('civil','criminal','family','corporate','administrative','labor','property','immigration','intellectual_property','environmental','tax','constitutional','probate','tort','contract','other') 
  NOT NULL DEFAULT 'other';
```

---

## Phase 2 — Workflow Completeness

### 2.1 Formal Case Closure Workflow

Currently, closing a case is just a status change. There should be a structured closure process.

**Required additions:**
- When status is set to `closed`, the system should **require** an `outcome` selection (won/lost/settled/dismissed/etc.).
- Optionally trigger a closure checklist.
- Auto-set `closed_at` date.
- Notify the client with the outcome.

**Backend change in `updateCase` controller:**
```typescript
// When closing a case, require outcome
if (status === 'closed') {
  if (!outcome) {
    res.status(400).json({ success: false, message: 'An outcome is required when closing a case.' })
    return
  }
  updateFields.outcome = outcome
  updateFields.outcome_notes = outcome_notes || null
  updateFields.closed_at = new Date().toISOString().slice(0, 10)
}
```

---

### 2.2 Case Billing / Time Tracking

Attorneys bill clients by the hour or per task. A minimal billing module tied to cases:

```sql
CREATE TABLE case_billing (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  case_id         INT NOT NULL,
  attorney_id     INT NOT NULL,
  entry_type      ENUM('hourly','flat_fee','court_fee','filing_fee','expense','retainer_deduction','other') NOT NULL,
  description     VARCHAR(300) NOT NULL,
  hours           DECIMAL(6,2) NULL,       -- for hourly entries
  rate            DECIMAL(10,2) NULL,       -- hourly rate
  amount          DECIMAL(12,2) NOT NULL,   -- total for this entry
  billing_date    DATE NOT NULL DEFAULT (CURDATE()),
  is_billed       BOOLEAN NOT NULL DEFAULT FALSE,
  is_paid         BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at         DATE NULL,
  invoice_number  VARCHAR(100) NULL,
  notes           TEXT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)    REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (attorney_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 2.3 Related Cases Linking

Many legal matters involve related cases (appeals from a lower court decision, consolidated cases, criminal case that spawned a civil suit).

```sql
CREATE TABLE case_relations (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  case_id       INT NOT NULL,
  related_to    INT NOT NULL,
  relation_type ENUM('appeal_of','consolidated_with','spawned_from','related_matter','other') NOT NULL DEFAULT 'related_matter',
  notes         TEXT NULL,
  created_by    INT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)    REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (related_to) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_no_self_link CHECK (case_id != related_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 2.4 Document Categories Enhancement

Current document `category` is a free-form or generic string. It needs proper categorization for legal documents.

```sql
ALTER TABLE documents MODIFY COLUMN category 
  ENUM('pleading','motion','order','judgment','exhibit','evidence','contract','affidavit','summons','subpoena','correspondence','court_filing','invoice','retainer_agreement','identification','other') 
  NOT NULL DEFAULT 'other';
```

---

### 2.5 Co-Counsel Support

Currently only a single `attorney_id` is on each case. For complex matters, multiple attorneys may work a case.

```sql
CREATE TABLE case_attorneys (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  case_id     INT NOT NULL,
  attorney_id INT NOT NULL,
  role        ENUM('lead','co_counsel','associate','consultant') NOT NULL DEFAULT 'associate',
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by INT NULL,
  UNIQUE KEY uq_case_attorney (case_id, attorney_id),
  FOREIGN KEY (case_id)    REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (attorney_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Phase 3 — UX & Operational Improvements

### 3.1 Case Detail Page Enhancements

The current `CaseDetail.tsx` has 4 tabs: **Info, Timeline, Notes, Documents**. The following tabs/sections should be added:

| New Tab / Section | Purpose |
|---|---|
| **Deadlines** | List all deadlines, overdue indicators, mark complete |
| **Parties** | Show all parties involved (opposing, witnesses, etc.) |
| **Hearings** | Move hearings from a separate page to a tab on CaseDetail |
| **Billing** | Show billing entries, totals owed, paid status |
| **Related Cases** | Show linked case cards with quick navigation |

---

### 3.2 Case List Page Improvements (`Cases.tsx`)

The current cases list only shows: case_number, title, case_type, status, filing_date, client_name, attorney_name.

**Add to the list view:**
- Priority badge (urgent = red, high = orange)
- Upcoming deadline indicator (shows days until next deadline if within 14 days)
- Overdue deadlines counter badge
- Outcome badge for closed cases
- Quick-filter chips for priority and case_type beyond just status

---

### 3.3 Dashboard Widgets for Attorneys

The `AttorneyDashboard` should surface case-related urgency information:

- **Overdue Deadlines** — cases with passed `due_date` and `is_completed = false`
- **Deadlines This Week** — upcoming critical dates
- **Cases by Outcome** — pie chart showing win/loss/settled breakdown
- **Open Cases by Priority** — how many urgent vs. high vs. normal
- **Billable Hours This Month** — from `case_billing` entries

---

### 3.4 Client Portal Improvements

Clients currently see a limited view. They should be able to see:
- Their case **description** and **background**
- **Upcoming hearings** for their case
- **Deadlines** that are `notify_client = true`
- **Documents** marked as `is_client_visible`
- **Case outcome** when the case is closed

---

## Phase 4 — Advanced Features

### 4.1 Deadline Reminder Notifications (Automated)

A scheduled background job (cron) should run daily and:
1. Query `case_deadlines` where `is_completed = false` AND `due_date - INTERVAL reminder_days DAY <= CURDATE()`
2. Send in-app notifications to the assigned attorney
3. Send email reminders for deadlines within 3 days
4. If `notify_client = true`, also notify the client

```typescript
// Pseudo-code for cron job (e.g., using node-cron)
cron.schedule('0 8 * * *', async () => {
  const overdue = await getApproachingDeadlines()
  for (const deadline of overdue) {
    await notify(deadline.attorney_id, 'deadline_reminder', 
      `Deadline approaching: "${deadline.title}" due ${deadline.due_date} on case ${deadline.case_number}`,
      deadline.case_id)
    if (deadline.notify_client) {
      await notify(deadline.client_id, 'deadline_reminder', 
        `Important deadline on your case: "${deadline.title}" — ${deadline.due_date}`,
        deadline.case_id)
    }
  }
})
```

---

### 4.2 Case Tags / Labels

Allow attorneys to apply custom colored tags to cases for personal organization (e.g., "Pro Bono", "High Profile", "Settlement Track").

```sql
CREATE TABLE case_tags (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  name    VARCHAR(50) NOT NULL,
  color   VARCHAR(7)  NOT NULL DEFAULT '#6366f1',   -- hex color
  created_by INT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE case_tag_map (
  case_id INT NOT NULL,
  tag_id  INT NOT NULL,
  PRIMARY KEY (case_id, tag_id),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES case_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 4.3 Conflict of Interest Check

Before assigning an attorney to a new case, a basic conflict check should search:
- Whether the attorney has any existing case where the **opposing party** matches any current client
- Whether the proposed client has been an opposing party in a prior case handled by this attorney

This is a legal ethics requirement in most jurisdictions.

```typescript
// On case creation, run:
const conflict = await pool.query(
  `SELECT c.id, c.case_number
   FROM cases c
   WHERE c.attorney_id = ? 
     AND (c.opposing_party LIKE ? OR c.client_id IN (
       SELECT id FROM users WHERE fullname LIKE ?
     ))
     AND c.deleted_at IS NULL`,
  [attorney_id, `%${new_client_name}%`, `%${opposing_party}%`]
)
if (conflict.length) {
  // Return warning (not a hard block — attorney should review)
}
```

---

### 4.4 Case Search & Advanced Filtering

Beyond the current simple text search and status filter, add:
- Filter by `case_type`
- Filter by `priority`
- Filter by `outcome` (for closed cases)
- Date range filter on `filing_date` or `created_at`
- Filter by attorney (admin view)
- Search by `docket_number`
- Filter cases with overdue deadlines

---

### 4.5 Case Export / Reports

Attorneys need to export case data for:
- Court submissions
- Client reports
- Internal practice analytics

**Minimum viable exports:**
- PDF case summary (case info, parties, timeline, notes summary)
- CSV export of case list with filters
- Excel billing report per case

---

## Phase 5 — Compliance & Security Hardening

### 5.1 Case Access Log

Beyond the audit log, a case-specific access log that tracks every time a case record is viewed:

```sql
CREATE TABLE case_access_log (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  case_id    INT NOT NULL,
  user_id    INT NOT NULL,
  action     ENUM('viewed','downloaded_document','exported') NOT NULL DEFAULT 'viewed',
  ip_address VARCHAR(45),
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)  REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 5.2 Case Data Retention Policy

For archival/compliance, define:
- Cases can be archived after X years of inactivity
- Archived cases are read-only
- Documents are compressed / moved to cold storage
- A retention period should be configurable per firm in `settings`

---

### 5.3 Privilege & Confidentiality Markers

Documents and notes can be marked with legal privilege:

```sql
ALTER TABLE documents ADD COLUMN privilege_type 
  ENUM('none','attorney_client','work_product','confidential','public') 
  NOT NULL DEFAULT 'none';

ALTER TABLE case_notes ADD COLUMN privilege_type
  ENUM('none','attorney_client','work_product','confidential')
  NOT NULL DEFAULT 'none';
```

---

## Implementation Priority Order

| Priority | Feature | Phase | Effort |
|---|---|---|---|
| 1 | Case description + docket number fields | 1 | Low |
| 2 | Case outcome (required on close) | 1 + 2 | Low |
| 3 | Case priority field | 1 | Low |
| 4 | Case parties table + UI | 1 | Medium |
| 5 | **Case deadlines table + UI + reminders** | 1 + 4 | **High** |
| 6 | Close workflow requiring outcome | 2 | Low |
| 7 | Extend case_type ENUM | 1 | Low |
| 8 | Extend document category ENUM | 2 | Low |
| 9 | Deadlines tab on CaseDetail | 3 | Medium |
| 10 | Parties tab on CaseDetail | 3 | Medium |
| 11 | Priority/deadline badges on case list | 3 | Medium |
| 12 | Attorney dashboard deadline widgets | 3 | Medium |
| 13 | Deadline reminder cron job | 4 | Medium |
| 14 | Case billing table + UI | 2 | High |
| 15 | Related cases linking | 2 | Medium |
| 16 | Co-counsel support | 2 | Medium |
| 17 | Advanced search filters | 4 | Medium |
| 18 | Case tags | 4 | Low |
| 19 | Conflict of interest check | 4 | Medium |
| 20 | Case export / PDF summary | 4 | High |
| 21 | Privilege markers on documents/notes | 5 | Low |
| 22 | Case access log | 5 | Low |
| 23 | Data retention policy | 5 | High |

---

## Quick Wins (Can Be Done Today)

These require minimal effort and have immediate impact:

1. **Add `description`, `docket_number`, `priority`, `opposing_party`, `opposing_counsel`, `outcome`, `outcome_notes` columns to `cases` table** — One migration, update the create/update form
2. **Require outcome when setting status = closed** — Small backend validation + UI prompt
3. **Extend `case_type` ENUM** — One-line migration
4. **Add priority badge to case list** — Frontend-only change
5. **Extend document `category` ENUM** — One migration

---

## Database Migration Sequence

When implementing, run migrations in this order:

```
015_case_description_fields.sql      → adds description, docket_number, priority, opposing_party, opposing_counsel, outcome, closed_at
016_case_parties.sql                 → creates case_parties table
017_case_deadlines.sql               → creates case_deadlines table
018_case_billing.sql                 → creates case_billing table
019_case_relations.sql               → creates case_relations table
020_case_cocounsel.sql               → creates case_attorneys table
021_document_categories_extend.sql  → extends documents category enum
022_case_types_extend.sql            → extends cases case_type enum
023_case_tags.sql                    → creates case_tags and case_tag_map
024_case_access_log.sql              → creates case_access_log
025_privilege_markers.sql            → adds privilege fields to documents and notes
```

---

## Notes on Philippine Legal Practice Context

Since this appears to be a Philippine law firm system (IBP verification, attorney profiles, secretary roles), the following Philippine-specific enhancements are worth noting:

- **IBP (Integrated Bar of the Philippines) number** should be linked to the attorney's profile for case filings
- **ROC (Rules of Court)** deadline tracking — Philippine courts follow strict procedural timelines (e.g., 15 days to answer a complaint, 30 days to file a memorandum)
- **Court names** should ideally have a dropdown of Philippine courts: RTC, MTC, MTCC, Sandiganbayan, Court of Appeals, Supreme Court, NLRC, etc.
- **Case types** should include NLRC (labor), Sandiganbayan (anti-graft), Ombudsman, DOJ cases which are specific to Philippine legal practice
- **PAO (Public Attorney's Office)** cases and IBP Legal Aid cases may need a `pro_bono` flag on cases

---

*This document should be revisited after each phase of implementation to track progress and reprioritize as needed.*
