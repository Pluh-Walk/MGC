-- ============================================================
--  MGC Law System — Migration 029
--  Performance indexes, signed download tokens, consent tracking,
--  hearing reminder tracking, SOL acknowledgment, CSRF tokens
--  Date: 2026-04-06
-- ============================================================

USE law_system_auth;

-- ─── Performance: extra indexes on frequently filtered columns ──

-- case_deadlines: queried heavily by reminded/due-date combination
ALTER TABLE case_deadlines
  ADD INDEX IF NOT EXISTS idx_deadlines_due_uncompleted (due_date, is_completed),
  ADD INDEX IF NOT EXISTS idx_deadlines_type            (deadline_type),
  ADD INDEX IF NOT EXISTS idx_deadlines_last_reminder   (last_reminder_sent);

-- invoices: looked up by status
ALTER TABLE invoices
  ADD INDEX IF NOT EXISTS idx_invoices_status  (status),
  ADD INDEX IF NOT EXISTS idx_invoices_case    (case_id);

-- audit_log: filtered by user + action + date
ALTER TABLE audit_log
  ADD INDEX IF NOT EXISTS idx_audit_user_date   (user_id, created_at),
  ADD INDEX IF NOT EXISTS idx_audit_action      (action),
  ADD INDEX IF NOT EXISTS idx_audit_target      (target_type, target_id);

-- notifications: per-user unseen lookups
ALTER TABLE notifications
  ADD INDEX IF NOT EXISTS idx_notif_user_unread (user_id, is_read);

-- messages: conversation thread queries
ALTER TABLE messages
  ADD INDEX IF NOT EXISTS idx_msg_participants (sender_id, receiver_id, created_at);

-- login_attempts: lockout check uses email + time window
ALTER TABLE login_attempts
  ADD INDEX IF NOT EXISTS idx_attempts_email_time (email, attempted_at);

-- cases: common dashboard queries
ALTER TABLE cases
  ADD INDEX IF NOT EXISTS idx_cases_attorney_status (attorney_id, status),
  ADD INDEX IF NOT EXISTS idx_cases_client_status   (client_id, status);

-- ─── Signed download tokens (§1.3) ──────────────────────────
-- Time-limited auth tokens for document downloads — prevents
-- unauthenticated link sharing.
CREATE TABLE IF NOT EXISTS download_tokens (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  token       VARCHAR(64) NOT NULL UNIQUE,
  user_id     INT NOT NULL,
  document_id INT NOT NULL,
  version_id  INT NULL,             -- NULL = current document, non-NULL = specific version
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME NULL,        -- single-use: set on first download
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dt_token     (token),
  INDEX idx_dt_expires   (expires_at),
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Consent tracking (§10.1 — RA 10173) ───────────────────
-- When the user explicitly accepted the privacy notice.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS consent_at DATETIME NULL AFTER status;

-- ─── Hearing reminder tracking ──────────────────────────────
-- Prevents duplicate 24h-before emails for hearings.
ALTER TABLE hearings
  ADD COLUMN IF NOT EXISTS reminder_sent_at DATETIME NULL AFTER status;

-- ─── SOL acknowledgment timestamps ──────────────────────────
-- Attorney must acknowledge a statute_of_limitations deadline warning.
ALTER TABLE case_deadlines
  ADD COLUMN IF NOT EXISTS sol_acknowledged_at DATETIME NULL AFTER is_completed,
  ADD COLUMN IF NOT EXISTS sol_acknowledged_by INT NULL AFTER sol_acknowledged_at;

-- ─── CSRF tokens table (double-submit pattern) ──────────────
CREATE TABLE IF NOT EXISTS csrf_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token      VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_csrf_user   (user_id),
  INDEX idx_csrf_token  (token),
  INDEX idx_csrf_expiry (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
