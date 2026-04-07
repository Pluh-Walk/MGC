-- ============================================================
--  MGC Law System — Migration 030
--  Task Management and Document Templates Library
--  Date: 2026-04-06
-- ============================================================

USE law_system_auth;

-- ─── Case Tasks (§4.2 Task Management) ────────────────────────────

CREATE TABLE IF NOT EXISTS case_tasks (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id       INT          NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT         NULL,
  assigned_to   INT          NULL,      -- user.id (attorney or secretary)
  created_by    INT          NOT NULL,
  due_date      DATE         NULL,
  priority      ENUM('low','normal','high','critical') NOT NULL DEFAULT 'normal',
  status        ENUM('pending','in_progress','done','cancelled') NOT NULL DEFAULT 'pending',
  completed_at  DATETIME     NULL,
  completed_by  INT          NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_ct_case     FOREIGN KEY (case_id)    REFERENCES cases(id)  ON DELETE CASCADE,
  CONSTRAINT fk_ct_assignee FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_ct_creator  FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE RESTRICT,

  INDEX idx_ct_case   (case_id),
  INDEX idx_ct_status (status),
  INDEX idx_ct_assignee (assigned_to),
  INDEX idx_ct_due    (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Document Templates Library (§3.2) ────────────────────────────

CREATE TABLE IF NOT EXISTS document_templates (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  category      ENUM('contract','pleading','motion','letter','affidavit','retainer','other') NOT NULL DEFAULT 'other',
  description   TEXT         NULL,
  file_path     VARCHAR(500) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_size     BIGINT       NOT NULL DEFAULT 0,
  mime_type     VARCHAR(120) NOT NULL,
  placeholders  JSON         NULL,       -- array of placeholder names found in the template
  is_system     TINYINT(1)   NOT NULL DEFAULT 0,  -- 1 = admin-uploaded firm-wide template
  created_by    INT          NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,

  CONSTRAINT fk_dt_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,

  INDEX idx_dt_category (category),
  INDEX idx_dt_creator  (created_by),
  INDEX idx_dt_deleted  (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Add paid_reference and receipt_path columns to invoices ─────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS paid_reference VARCHAR(255) NULL AFTER paid_at;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS receipt_path VARCHAR(500) NULL AFTER paid_reference;
