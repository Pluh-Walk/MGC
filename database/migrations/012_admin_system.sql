-- ============================================================
--  Migration 012: Admin system tables
--  Run in phpMyAdmin against law_system_auth
--  Date: 2026-03-16
-- ============================================================

USE law_system_auth;

-- ─── System Settings (Key-Value Store) ──────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  setting_key   VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT         NOT NULL,
  description   VARCHAR(255) NULL,
  updated_by    INT          NULL,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Default System Settings ────────────────────────────────
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('site_name', 'MGC Law System', 'Platform display name'),
  ('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
  ('max_upload_size_mb', '20', 'Maximum file upload size in MB'),
  ('max_login_attempts', '5', 'Max failed login attempts before lockout'),
  ('lockout_duration_minutes', '15', 'Account lockout duration after max failed attempts'),
  ('session_timeout_days', '7', 'JWT token expiration in days'),
  ('password_min_length', '8', 'Minimum password length'),
  ('require_password_uppercase', 'true', 'Require uppercase letter in passwords'),
  ('require_password_number', 'true', 'Require at least one number in passwords');

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
