-- ============================================================
--  Migration 011: Secretary invitation & linking system
--  Run in phpMyAdmin against law_system_auth
--  Date: 2026-03-16
-- ============================================================

USE law_system_auth;

-- ─── Secretary Invitations ──────────────────────────────────
-- Attorneys invite secretaries via email; token-based registration
CREATE TABLE IF NOT EXISTS secretary_invitations (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  attorney_id   INT            NOT NULL,
  email         VARCHAR(100)   NOT NULL,
  token         VARCHAR(255)   NOT NULL UNIQUE,
  status        ENUM('pending', 'accepted', 'expired', 'revoked') NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME NOT NULL,
  accepted_at   DATETIME NULL DEFAULT NULL,

  FOREIGN KEY (attorney_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_invite_token (token),
  INDEX idx_invite_email (email),
  INDEX idx_invite_attorney (attorney_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Attorney-Secretary Link ────────────────────────────────
-- Each secretary is linked to exactly one attorney at a time
CREATE TABLE IF NOT EXISTS attorney_secretaries (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  attorney_id   INT NOT NULL,
  secretary_id  INT NOT NULL,
  status        ENUM('active', 'inactive', 'removed') NOT NULL DEFAULT 'active',
  hired_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  removed_at    TIMESTAMP NULL DEFAULT NULL,

  FOREIGN KEY (attorney_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (secretary_id) REFERENCES users(id) ON DELETE CASCADE,

  UNIQUE KEY uq_secretary_active (secretary_id),
  INDEX idx_attsec_attorney (attorney_id),
  INDEX idx_attsec_secretary (secretary_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Secretary Profile ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS secretary_profiles (
  user_id       INT PRIMARY KEY,
  phone         VARCHAR(20)   NULL,
  photo_path    VARCHAR(255)  NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
