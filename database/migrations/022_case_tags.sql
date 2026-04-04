-- ============================================================
--  MGC Law System — Migration 022: Case Tags / Labels
--  Colour-coded labels for fast visual triage of case lists
--  Date: 2026-04-02
-- ============================================================

USE law_system_auth;

CREATE TABLE IF NOT EXISTS case_tags (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  color      VARCHAR(7)  NOT NULL DEFAULT '#6366f1',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tag_name (name),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS case_tag_map (
  case_id    INT NOT NULL,
  tag_id     INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by INT NOT NULL,
  PRIMARY KEY (case_id, tag_id),
  FOREIGN KEY (case_id)     REFERENCES cases(id)     ON DELETE CASCADE,
  FOREIGN KEY (tag_id)      REFERENCES case_tags(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
