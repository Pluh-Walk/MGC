-- ============================================================
--  MGC Law System — Migration 031
--  Medium Priority Features
--  Date: 2026-04-06
-- ============================================================

USE law_system_auth;

-- ─── §2.2 Notification Preferences ───────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL UNIQUE,
  -- Each column: 'both' | 'app' | 'email' | 'none'
  new_message        ENUM('both','app','email','none') NOT NULL DEFAULT 'both',
  case_update        ENUM('both','app','email','none') NOT NULL DEFAULT 'both',
  hearing_reminder   ENUM('both','app','email','none') NOT NULL DEFAULT 'both',
  deadline_reminder  ENUM('both','app','email','none') NOT NULL DEFAULT 'both',
  document_uploaded  ENUM('both','app','email','none') NOT NULL DEFAULT 'both',
  announcement       ENUM('both','app','email','none') NOT NULL DEFAULT 'app',
  invoice_sent       ENUM('both','app','email','none') NOT NULL DEFAULT 'both',
  task_assigned      ENUM('both','app','email','none') NOT NULL DEFAULT 'both',
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_np_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── §4.6 Case Progress / Stage Workflow ─────────────────────
CREATE TABLE IF NOT EXISTS case_stages (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id     INT NOT NULL,
  stage_name  VARCHAR(100) NOT NULL,
  stage_order TINYINT UNSIGNED NOT NULL,
  is_current  TINYINT(1)   NOT NULL DEFAULT 0,
  completed   TINYINT(1)   NOT NULL DEFAULT 0,
  completed_at DATETIME    NULL,
  completed_by INT         NULL,
  notes       TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cs_case (case_id),
  CONSTRAINT fk_cs_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_cs_completer FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── §4.6 Stage templates per case type ──────────────────────
CREATE TABLE IF NOT EXISTS stage_templates (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_type   VARCHAR(80)  NOT NULL,   -- e.g. 'criminal', 'civil', 'administrative'
  stage_name  VARCHAR(100) NOT NULL,
  stage_order TINYINT UNSIGNED NOT NULL,
  INDEX idx_st_type (case_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default stage templates
INSERT IGNORE INTO stage_templates (case_type, stage_name, stage_order) VALUES
  ('criminal',       'Investigation',   1),
  ('criminal',       'Filing',          2),
  ('criminal',       'Arraignment',     3),
  ('criminal',       'Pre-Trial',       4),
  ('criminal',       'Trial',           5),
  ('criminal',       'Judgment',        6),
  ('criminal',       'Appeal',          7),
  ('civil',          'Filing',          1),
  ('civil',          'Summons',         2),
  ('civil',          'Pre-Trial',       3),
  ('civil',          'Trial',           4),
  ('civil',          'Decision',        5),
  ('civil',          'Execution',       6),
  ('administrative', 'Filing',          1),
  ('administrative', 'Preliminary Conf',2),
  ('administrative', 'Hearing',         3),
  ('administrative', 'Decision',        4),
  ('administrative', 'Reconsideration', 5),
  ('family',         'Petition',        1),
  ('family',         'Service',         2),
  ('family',         'Pre-Trial',       3),
  ('family',         'Trial',           4),
  ('family',         'Decision',        5),
  ('labor',          'Filing',          1),
  ('labor',          'Mandatory Conf',  2),
  ('labor',          'Hearing',         3),
  ('labor',          'Decision',        4),
  ('labor',          'Appeal',          5);

-- ─── §5.3 Expense Receipt Uploads ────────────────────────────
ALTER TABLE case_billing
  ADD COLUMN IF NOT EXISTS receipt_path VARCHAR(500) NULL AFTER notes;

-- ─── §10.4 Legal Hold ────────────────────────────────────────
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS legal_hold       TINYINT(1)   NOT NULL DEFAULT 0 AFTER retainer_amount,
  ADD COLUMN IF NOT EXISTS legal_hold_by    INT          NULL AFTER legal_hold,
  ADD COLUMN IF NOT EXISTS legal_hold_at    DATETIME     NULL AFTER legal_hold_by,
  ADD COLUMN IF NOT EXISTS legal_hold_note  TEXT         NULL AFTER legal_hold_at;

-- ─── §3.5 Document Retention Policy ──────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS retention_years TINYINT UNSIGNED NULL AFTER is_client_visible,
  ADD COLUMN IF NOT EXISTS expires_at      DATE             NULL AFTER retention_years;

-- ─── §12.2 User Impersonation audit ──────────────────────────
CREATE TABLE IF NOT EXISTS impersonation_log (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id       INT NOT NULL,
  target_user_id INT NOT NULL,
  started_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at       DATETIME NULL,
  ip_address     VARCHAR(45) NULL,
  INDEX idx_imp_admin  (admin_id),
  INDEX idx_imp_target (target_user_id),
  CONSTRAINT fk_imp_admin  FOREIGN KEY (admin_id)       REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_imp_target FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── §6.2 Appointment Scheduling ─────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attorney_id    INT NOT NULL,
  client_id      INT NOT NULL,
  case_id        INT NULL,
  requested_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  start_time     DATETIME NULL,
  end_time       DATETIME NULL,
  appt_type      ENUM('consultation','follow_up','signing','other') NOT NULL DEFAULT 'consultation',
  notes          TEXT NULL,
  status         ENUM('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'pending',
  confirmed_at   DATETIME NULL,
  cancelled_at   DATETIME NULL,
  cancel_reason  TEXT NULL,
  INDEX idx_appt_attorney (attorney_id),
  INDEX idx_appt_client   (client_id),
  INDEX idx_appt_case     (case_id),
  INDEX idx_appt_time     (start_time),
  CONSTRAINT fk_appt_attorney FOREIGN KEY (attorney_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_client   FOREIGN KEY (client_id)   REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_case     FOREIGN KEY (case_id)     REFERENCES cases(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── FULLTEXT on documents.extracted_text (for §3.3 Full-Text Search) ───
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS extracted_text MEDIUMTEXT NULL AFTER original_name;

ALTER TABLE documents
  DROP INDEX IF EXISTS ft_documents;

ALTER TABLE documents
  ADD FULLTEXT INDEX IF NOT EXISTS ft_documents (original_name, extracted_text);
