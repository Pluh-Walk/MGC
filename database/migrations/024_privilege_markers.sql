-- ============================================================
--  MGC Law System — Migration 024: Privilege Markers
--  Adds privilege_type to documents and case_notes
--  Date: 2026-04-02
-- ============================================================

USE law_system_auth;

-- Add privilege_type to documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS privilege_type
    ENUM('none','attorney_client','work_product','confidential')
    NOT NULL DEFAULT 'none'
    AFTER category;

-- Add privilege_type to case_notes
ALTER TABLE case_notes
  ADD COLUMN IF NOT EXISTS privilege_type
    ENUM('none','attorney_client','work_product','confidential')
    NOT NULL DEFAULT 'none'
    AFTER is_private;
