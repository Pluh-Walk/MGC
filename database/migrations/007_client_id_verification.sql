-- ============================================================
--  Migration 007: Government ID verification for client accounts
-- ============================================================

USE law_system_auth;

-- Add id_verified flag to users table
ALTER TABLE users
  ADD COLUMN id_verified TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '0 = not verified, 1 = government ID verified (clients only)';
