-- ============================================================
--  MGC Law System — Migration 027: Invoices
--  Stores generated invoices linked to cases and billing entries
--  Date: 2026-04-04
-- ============================================================

USE law_system_auth;

CREATE TABLE IF NOT EXISTS invoices (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(50)  NOT NULL UNIQUE,
  case_id        INT NOT NULL,
  attorney_id    INT NOT NULL,
  client_id      INT NOT NULL,
  entries_json   JSON NOT NULL,                  -- snapshot of included billing entry IDs
  subtotal       DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount     DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount   DECIMAL(12,2) NOT NULL,
  status         ENUM('draft','sent','paid','disputed','void') NOT NULL DEFAULT 'draft',
  due_date       DATE NULL,
  sent_at        DATETIME NULL,
  paid_at        DATETIME NULL,
  paid_reference VARCHAR(200) NULL,              -- GCash ref, bank transfer ref, etc.
  notes          TEXT NULL,
  pdf_path       VARCHAR(500) NULL,              -- stored path of generated PDF
  created_by     INT NOT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)     REFERENCES cases(id)     ON DELETE CASCADE,
  FOREIGN KEY (attorney_id) REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (client_id)   REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE CASCADE,
  INDEX idx_invoices_case   (case_id),
  INDEX idx_invoices_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
