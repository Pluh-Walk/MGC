-- ============================================================
--  MGC Law System — Migration 017: Case Deadlines Table
--  Tracks legal deadlines and statute of limitations per case
--  Date: 2026-04-02
-- ============================================================

USE law_system_auth;

CREATE TABLE IF NOT EXISTS case_deadlines (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  case_id        INT          NOT NULL,
  title          VARCHAR(200) NOT NULL,
  description    TEXT         NULL,
  deadline_type  ENUM('statute_of_limitations','filing_deadline','response_deadline',
                      'discovery_deadline','trial_date','hearing_date','pleading_deadline',
                      'appeal_deadline','payment_deadline','other')
                 NOT NULL DEFAULT 'other',
  due_date       DATE         NOT NULL,
  reminder_days  INT          NOT NULL DEFAULT 7,
  is_completed   BOOLEAN      NOT NULL DEFAULT FALSE,
  completed_at   DATETIME     NULL,
  completed_by   INT          NULL,
  notify_client  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_by     INT          NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)      REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)   REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
