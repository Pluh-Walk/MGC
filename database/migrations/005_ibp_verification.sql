-- ============================================================
--  Migration 005: IBP card verification for attorney accounts
-- ============================================================

USE law_system_auth;

-- Add ibp_verified flag to users table
ALTER TABLE users
  ADD COLUMN ibp_verified TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '0 = not verified, 1 = IBP card verified (attorneys only)';
