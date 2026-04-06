-- ─── 2FA / TOTP Support ──────────────────────────────────────────────────────

-- Add TOTP fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret   VARCHAR(64)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS totp_enabled  TINYINT(1)   NOT NULL DEFAULT 0;

-- Backup codes for 2FA recovery (one-time use each)
CREATE TABLE IF NOT EXISTS two_factor_backup_codes (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  code_hash  VARCHAR(64)  NOT NULL  COMMENT 'SHA-256 hex of the plain 8-digit code',
  used_at    DATETIME     DEFAULT NULL,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_backup_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pending 2FA secrets (stored temporarily between setup init and confirmation)
CREATE TABLE IF NOT EXISTS totp_pending (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL UNIQUE,
  secret     VARCHAR(64)  NOT NULL,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
