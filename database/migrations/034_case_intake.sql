-- ============================================================
--  MGC Law System — Migration 034
--  Self-Service Client Intake (Complaint Requests)
--  Date: 2026-04-12
-- ============================================================

USE law_system_auth;

CREATE TABLE IF NOT EXISTS case_intake_requests (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- Who filed
  client_id        INT          NOT NULL,

  -- Core complaint fields (mirrors verified complaint structure)
  case_type        ENUM(
                     'civil','criminal','family','corporate','administrative',
                     'labor','property','immigration','intellectual_property',
                     'tax','constitutional','probate','tort','contract','other'
                   ) NOT NULL,
  subject          VARCHAR(255) NOT NULL,           -- brief title / matter
  narration        TEXT         NOT NULL,           -- narration of facts
  legal_basis      TEXT         NULL,               -- what right was violated
  relief_sought    TEXT         NULL,               -- what remedy is requested
  opposing_party   VARCHAR(255) NULL,               -- name of the other side
  incident_date    DATE         NULL,               -- when the dispute occurred
  preferred_attorney INT        NULL,               -- optional: client preference

  -- Barangay conciliation
  barangay_done        TINYINT(1)   NOT NULL DEFAULT 0,
  barangay_cert_path   VARCHAR(500) NULL,           -- stored image of the certificate
  barangay_cert_status ENUM('none','pending','verified','failed') NOT NULL DEFAULT 'none',
                                                    -- OCR verification result
  barangay_cert_ocr_text TEXT NULL,                 -- raw OCR output for attorney review

  -- Workflow status
  status           ENUM('pending','reviewing','accepted','rejected','converted') NOT NULL DEFAULT 'pending',
  attorney_id      INT          NULL,               -- assigned after review
  rejection_reason TEXT         NULL,
  converted_case_id INT         NULL,               -- FK set when converted to real case

  -- Timestamps
  submitted_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at      DATETIME     NULL,
  reviewed_by      INT          NULL,

  CONSTRAINT fk_intake_client    FOREIGN KEY (client_id)         REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_intake_attorney  FOREIGN KEY (attorney_id)       REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_intake_reviewer  FOREIGN KEY (reviewed_by)       REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_intake_case      FOREIGN KEY (converted_case_id) REFERENCES cases(id) ON DELETE SET NULL,
  CONSTRAINT fk_intake_preferred FOREIGN KEY (preferred_attorney) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_intake_client  (client_id),
  INDEX idx_intake_status  (status),
  INDEX idx_intake_attorney (attorney_id),
  INDEX idx_intake_submitted (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Attachments the client uploads with their intake (supporting docs)
CREATE TABLE IF NOT EXISTS case_intake_attachments (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  intake_id  INT UNSIGNED NOT NULL,
  file_path  VARCHAR(500) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_size  BIGINT       NOT NULL DEFAULT 0,
  mime_type  VARCHAR(120) NOT NULL,
  uploaded_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_ia_intake FOREIGN KEY (intake_id) REFERENCES case_intake_requests(id) ON DELETE CASCADE,
  INDEX idx_ia_intake (intake_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
