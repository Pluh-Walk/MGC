-- ============================================================
--  MGC Law System — Migration 023: Case Access Log
--  Logs every time a case record is read (for privilege/audit)
--  Date: 2026-04-02
-- ============================================================

USE law_system_auth;

CREATE TABLE IF NOT EXISTS case_access_log (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  case_id     INT         NOT NULL,
  user_id     INT         NOT NULL,
  role        VARCHAR(30) NOT NULL,
  ip_address  VARCHAR(45) NULL,
  user_agent  VARCHAR(300) NULL,
  accessed_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  KEY idx_cal_case (case_id),
  KEY idx_cal_user (user_id),
  KEY idx_cal_ts   (accessed_at),
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
