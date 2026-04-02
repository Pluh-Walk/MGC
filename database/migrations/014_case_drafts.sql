-- ============================================================
--  MGC Law System — Migration 014: Case Drafts
--  Allows secretaries to submit cases as drafts for attorney review
--  Date: 2026-04-01
-- ============================================================

USE law_system_auth;

-- Add 'draft' status and drafted_by tracking to cases table
ALTER TABLE cases
  MODIFY COLUMN status ENUM('draft','active','pending','closed','archived') NOT NULL DEFAULT 'active';

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS drafted_by INT NULL DEFAULT NULL,
  ADD CONSTRAINT fk_cases_drafted_by FOREIGN KEY (drafted_by) REFERENCES users(id) ON DELETE SET NULL;
