-- ─── Refresh Tokens ─────────────────────────────────────────────────────────
-- Stores hashed refresh tokens for the JWT rotation strategy.
-- Access tokens are short-lived (15 min); refresh tokens are long-lived (7 days).
-- Old refresh tokens are rotated (revoked) on every successful refresh.

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           INT              AUTO_INCREMENT PRIMARY KEY,
  user_id      INT              NOT NULL,
  token_hash   VARCHAR(64)      NOT NULL COMMENT 'SHA-256 hex of the raw opaque token',
  expires_at   DATETIME         NOT NULL,
  revoked_at   DATETIME         DEFAULT NULL,
  created_at   DATETIME         DEFAULT CURRENT_TIMESTAMP,
  ip_address   VARCHAR(45)      DEFAULT NULL,
  user_agent   TEXT             DEFAULT NULL,
  INDEX idx_token_hash (token_hash),
  INDEX idx_user_expires (user_id, expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
