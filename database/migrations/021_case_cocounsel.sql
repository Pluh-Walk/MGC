-- ============================================================
--  MGC Law System — Migration 021: Co-Counsel (Case Attorneys)
--  Maps additional attorneys to cases with role designations
--  Date: 2026-04-02
-- ============================================================

USE law_system_auth;

CREATE TABLE IF NOT EXISTS case_attorneys (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  case_id     INT NOT NULL,
  attorney_id INT NOT NULL,
  role        ENUM('lead','co_counsel','supervisor','associate','paralegal')
              NOT NULL DEFAULT 'co_counsel',
  added_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  added_by    INT NOT NULL,
  UNIQUE KEY uq_case_attorney (case_id, attorney_id),
  FOREIGN KEY (case_id)     REFERENCES cases(id)  ON DELETE CASCADE,
  FOREIGN KEY (attorney_id) REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (added_by)    REFERENCES users(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
