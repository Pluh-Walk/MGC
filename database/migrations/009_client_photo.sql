-- ============================================================
--  Migration 009: Add photo_path to client_profiles
-- ============================================================
USE law_system_auth;

ALTER TABLE client_profiles
  ADD COLUMN photo_path VARCHAR(255) NULL AFTER emergency_contact;
