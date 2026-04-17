-- ============================================================
--  MGC Law System — Migration 036
--  Add contract_case_type and property_case_type sub-type
--  columns to case_intake_requests, and expand ALLOWED_TYPES
--  in the application layer to include 'contract' and 'property'.
--  Date: 2026-04-16
-- ============================================================

USE law_system_auth;

ALTER TABLE case_intake_requests
  ADD COLUMN contract_case_type VARCHAR(50) NULL AFTER tort_case_type,
  ADD COLUMN property_case_type VARCHAR(50) NULL AFTER contract_case_type,
  -- Property-specific: address / description of the property in dispute
  ADD COLUMN property_address   TEXT        NULL AFTER property_case_type;
