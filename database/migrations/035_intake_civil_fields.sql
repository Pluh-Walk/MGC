-- ============================================================
--  MGC Law System — Migration 035
--  Add civil_case_type and claim_amount to case_intake_requests
--  Date: 2026-04-13
-- ============================================================

USE law_system_auth;

ALTER TABLE case_intake_requests
  ADD COLUMN civil_case_type VARCHAR(50)     NULL  AFTER case_type,
  ADD COLUMN claim_amount     DECIMAL(15, 2) NULL  AFTER civil_case_type,
  ADD COLUMN tort_case_type   VARCHAR(50)     NULL  AFTER claim_amount;