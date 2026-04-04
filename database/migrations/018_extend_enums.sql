-- ============================================================
--  MGC Law System — Migration 018: Extend Enums
--  Extends case_type and document category enums for Philippine legal practice
--  Date: 2026-04-02
-- ============================================================

USE law_system_auth;

-- Extend case types for Philippine legal practice
ALTER TABLE cases MODIFY COLUMN case_type
  ENUM('civil','criminal','family','corporate','administrative','labor',
       'property','immigration','intellectual_property','tax',
       'constitutional','probate','tort','contract','other')
  NOT NULL DEFAULT 'other';

-- Extend document categories for proper legal document classification
ALTER TABLE documents MODIFY COLUMN category
  ENUM('pleading','motion','order','judgment','exhibit','evidence','contract',
       'affidavit','summons','subpoena','correspondence','court_filing',
       'invoice','retainer_agreement','identification','other')
  NOT NULL DEFAULT 'other';
