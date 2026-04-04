-- ============================================================
--  MGC Law System — Migration 015: Case Core Fields Enhancement
--  Adds legal-essential fields to the cases table
--  Date: 2026-04-02
-- ============================================================

USE law_system_auth;

-- Case background narrative
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS description TEXT NULL AFTER title;

-- Official court docket number (assigned by the court, differs from MGC internal number)
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS docket_number VARCHAR(100) NULL AFTER court_name;

-- Case priority level
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS priority ENUM('urgent','high','normal','low') NOT NULL DEFAULT 'normal' AFTER status;

-- Opposing party information
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS opposing_party VARCHAR(200) NULL AFTER priority;

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS opposing_counsel VARCHAR(200) NULL AFTER opposing_party;

-- Case outcome (required when status is set to 'closed')
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS outcome ENUM('won','lost','settled','dismissed','withdrawn','transferred','other') NULL AFTER opposing_counsel;

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS outcome_notes TEXT NULL AFTER outcome;

-- Date case was formally closed
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS closed_at DATE NULL AFTER outcome_notes;

-- Retainer amount agreed upon
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS retainer_amount DECIMAL(12,2) NULL AFTER closed_at;
