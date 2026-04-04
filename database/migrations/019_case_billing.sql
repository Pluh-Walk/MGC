-- ============================================================
--  MGC Law System — Migration 019: Case Billing
--  Tracks legal fees, time entries, and expenses per case
--  Date: 2026-04-02
-- ============================================================

USE law_system_auth;

CREATE TABLE IF NOT EXISTS case_billing (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  case_id        INT NOT NULL,
  attorney_id    INT NOT NULL,
  entry_type     ENUM('hourly','flat_fee','court_fee','filing_fee','expense','retainer_deduction','other')
                 NOT NULL DEFAULT 'flat_fee',
  description    VARCHAR(300) NOT NULL,
  hours          DECIMAL(6,2)  NULL,
  rate           DECIMAL(10,2) NULL,
  amount         DECIMAL(12,2) NOT NULL,
  billing_date   DATE NOT NULL DEFAULT (CURDATE()),
  is_billed      BOOLEAN NOT NULL DEFAULT FALSE,
  is_paid        BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at        DATE NULL,
  invoice_number VARCHAR(100) NULL,
  notes          TEXT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)    REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (attorney_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
