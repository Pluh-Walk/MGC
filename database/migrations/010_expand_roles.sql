-- ============================================================
--  Migration 010: Expand role system for Admin & Secretary
--  Run in phpMyAdmin against law_system_auth
--  Date: 2026-03-16
-- ============================================================

USE law_system_auth;

-- Step 1: Expand the role enum to include admin and secretary
ALTER TABLE users
  MODIFY COLUMN role ENUM('attorney', 'client', 'admin', 'secretary') NOT NULL;

-- Step 2: Add account status (supports suspension workflow)
ALTER TABLE users
  ADD COLUMN status ENUM('active', 'suspended', 'inactive', 'pending') NOT NULL DEFAULT 'active' AFTER role;

-- Step 3: Track last login time
ALTER TABLE users
  ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL AFTER created_at;

-- Step 4: Backfill existing users as active
UPDATE users SET status = 'active' WHERE status = 'active';
