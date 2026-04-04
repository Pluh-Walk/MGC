-- ============================================================
--  MGC Law System — Migration 020: Case Relations
--  Tracks relationships between cases (consolidated, appeal, etc.)
--  Date: 2026-04-02
-- ============================================================

USE law_system_auth;

CREATE TABLE IF NOT EXISTS case_relations (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  case_id        INT NOT NULL,
  related_case_id INT NOT NULL,
  relation_type  ENUM('consolidated','appealed_from','related_matter','cross_claim','counterclaim','companion','other')
                 NOT NULL DEFAULT 'related_matter',
  notes          TEXT NULL,
  created_by     INT NOT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_relation (case_id, related_case_id),
  FOREIGN KEY (case_id)         REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (related_case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by)      REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
