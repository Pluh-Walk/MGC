-- ============================================================
--  MGC Law System — Phase 1 Migration
--  Run this in phpMyAdmin or via MySQL CLI after schema.sql
--  Date: 2026-03-02
-- ============================================================

USE law_system_auth;

-- ─── Audit Log ───────────────────────────────────────────────
-- Tracks every sensitive action for legal compliance
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,
  action      VARCHAR(100)    NOT NULL,
  target_type VARCHAR(50),             -- 'case', 'document', 'user', etc.
  target_id   INT,
  ip_address  VARCHAR(45),
  details     TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Password Reset Tokens ──────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  token       VARCHAR(255) NOT NULL UNIQUE,
  expires_at  DATETIME     NOT NULL,
  used        BOOLEAN      DEFAULT FALSE,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Client Profiles ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_profiles (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  user_id              INT          NOT NULL UNIQUE,
  phone                VARCHAR(30),
  address              TEXT,
  date_of_birth        DATE,
  occupation           VARCHAR(100),
  notes                TEXT,
  assigned_attorney_id INT,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)              REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_attorney_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Cases ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cases (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  case_number  VARCHAR(50)  NOT NULL UNIQUE,
  title        VARCHAR(200) NOT NULL,
  case_type    ENUM('civil','criminal','family','corporate','other') NOT NULL DEFAULT 'other',
  client_id    INT          NOT NULL,
  attorney_id  INT          NOT NULL,
  court_name   VARCHAR(150),
  judge_name   VARCHAR(100),
  filing_date  DATE,
  status       ENUM('active','pending','closed','archived') NOT NULL DEFAULT 'active',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at   TIMESTAMP NULL DEFAULT NULL,   -- soft delete
  FOREIGN KEY (client_id)  REFERENCES users(id),
  FOREIGN KEY (attorney_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Case Counter (for auto case number generation) ─────────
CREATE TABLE IF NOT EXISTS case_number_seq (
  year  YEAR  NOT NULL,
  seq   INT   NOT NULL DEFAULT 0,
  PRIMARY KEY (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Case Timeline ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_timeline (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  case_id     INT          NOT NULL,
  event_type  ENUM('status_change','hearing','filing','note','document','other') NOT NULL,
  description TEXT         NOT NULL,
  event_date  DATE         NOT NULL,
  created_by  INT          NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)    REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Case Notes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_notes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  case_id    INT     NOT NULL,
  author_id  INT     NOT NULL,
  content    TEXT    NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)   REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Documents ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  case_id           INT          NOT NULL,
  uploaded_by       INT          NOT NULL,
  filename          VARCHAR(255) NOT NULL,   -- stored filename on disk
  original_name     VARCHAR(255) NOT NULL,   -- original upload name
  file_size         INT,                     -- bytes
  mime_type         VARCHAR(100),
  category          ENUM('pleading','evidence','contract','correspondence',
                         'court_order','filing','other') NOT NULL DEFAULT 'other',
  is_client_visible BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL DEFAULT NULL,   -- soft delete
  FOREIGN KEY (case_id)     REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Hearings ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hearings (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  case_id      INT          NOT NULL,
  title        VARCHAR(200) NOT NULL,
  hearing_type ENUM('initial','trial','motion','deposition','settlement','other') DEFAULT 'other',
  scheduled_at DATETIME     NOT NULL,
  location     VARCHAR(255),
  notes        TEXT,
  status       ENUM('scheduled','completed','postponed','cancelled') NOT NULL DEFAULT 'scheduled',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          NOT NULL,
  type         ENUM('hearing_reminder','case_update','document_uploaded',
                    'note_added','announcement','password_reset') NOT NULL,
  message      TEXT         NOT NULL,
  reference_id INT,               -- case_id, hearing_id, document_id, etc.
  is_read      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Announcements ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  case_id     INT,               -- NULL = firm-wide
  created_by  INT          NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT         NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)    REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
