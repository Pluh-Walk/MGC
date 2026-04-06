-- ============================================================
--  MGC Law System — Migration 028: Conflict Checks + Time Tracking + Document Versions + Search Indexes
--  Date: 2026-04-04
-- ============================================================

USE law_system_auth;

-- ─── Conflict of interest audit log ─────────────────────────
CREATE TABLE IF NOT EXISTS conflict_checks (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  case_id         INT NOT NULL,
  checked_by      INT NOT NULL,
  checked_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  client_id       INT NOT NULL,
  opposing_party  VARCHAR(300) NULL,
  conflicts_found JSON NULL,             -- array of {type, description, matched_user_id}
  acknowledged_at DATETIME NULL,         -- when attorney dismissed the warning
  FOREIGN KEY (case_id)    REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (checked_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Time tracking (billable timer entries) ─────────────────
CREATE TABLE IF NOT EXISTS time_entries (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  case_id      INT NOT NULL,
  user_id      INT NOT NULL,
  description  VARCHAR(500) NOT NULL,
  started_at   DATETIME NOT NULL,
  ended_at     DATETIME NULL,
  duration_sec INT NULL,                 -- computed from ended_at - started_at, or manual
  is_billable  BOOLEAN NOT NULL DEFAULT TRUE,
  billing_id   INT NULL,                 -- set when converted to a billing entry
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)    REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (billing_id) REFERENCES case_billing(id) ON DELETE SET NULL,
  INDEX idx_time_entries_case (case_id),
  INDEX idx_time_entries_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Document versioning ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_versions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  document_id    INT NOT NULL,
  version_number INT NOT NULL DEFAULT 1,
  file_path      VARCHAR(1000) NOT NULL,
  original_name  VARCHAR(500)  NOT NULL,
  file_size      INT NULL,
  uploaded_by    INT NOT NULL,
  uploaded_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes          TEXT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)     ON DELETE CASCADE,
  INDEX idx_doc_versions (document_id, version_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── FULLTEXT search indexes ─────────────────────────────────
ALTER TABLE cases     ADD FULLTEXT INDEX IF NOT EXISTS ft_cases     (title, description, opposing_party, docket_number);
ALTER TABLE documents ADD FULLTEXT INDEX IF NOT EXISTS ft_documents (original_name);
ALTER TABLE users     ADD FULLTEXT INDEX IF NOT EXISTS ft_users     (fullname, email, username);
