-- ============================================================
--  MGC Law System — Migration 037
--  Add Family, Labor, and Probate sub-type + pre-filing fields
--  to case_intake_requests.
--
--  Pre-filing differences vs. Civil/Tort/Contract/Property:
--    Family → no barangay cert; mandatory court-annexed mediation
--    Labor  → no barangay cert; SEnA (Single Entry Approach) required
--    Probate→ no barangay cert; special proceedings, no conciliation
--  Date: 2026-04-16
-- ============================================================

USE law_system_auth;

ALTER TABLE case_intake_requests

  -- ── Family ────────────────────────────────────────────────────
  ADD COLUMN family_case_type        VARCHAR(50)    NULL AFTER property_address,
  ADD COLUMN mediation_acknowledged  TINYINT(1)     NOT NULL DEFAULT 0 AFTER family_case_type,

  -- ── Labor ─────────────────────────────────────────────────────
  ADD COLUMN labor_case_type         VARCHAR(50)    NULL AFTER mediation_acknowledged,
  ADD COLUMN date_hired              DATE           NULL AFTER labor_case_type,
  ADD COLUMN date_dismissed          DATE           NULL AFTER date_hired,
  ADD COLUMN monthly_salary          DECIMAL(12,2)  NULL AFTER date_dismissed,
  ADD COLUMN sena_acknowledged       TINYINT(1)     NOT NULL DEFAULT 0 AFTER monthly_salary,

  -- ── Probate / Estate ──────────────────────────────────────────
  ADD COLUMN probate_case_type       VARCHAR(50)    NULL AFTER sena_acknowledged,
  ADD COLUMN deceased_name           VARCHAR(255)   NULL AFTER probate_case_type,
  ADD COLUMN date_of_death           DATE           NULL AFTER deceased_name,
  ADD COLUMN estate_value            DECIMAL(15,2)  NULL AFTER date_of_death,
  ADD COLUMN probate_acknowledged    TINYINT(1)     NOT NULL DEFAULT 0 AFTER estate_value;
