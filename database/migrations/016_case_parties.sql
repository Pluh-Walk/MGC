-- ============================================================
--  MGC Law System — Migration 016: Case Parties Table
--  Tracks all parties involved in a case (opposing, witnesses, etc.)
--  Date: 2026-04-02
-- ============================================================

USE law_system_auth;

CREATE TABLE IF NOT EXISTS case_parties (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  case_id      INT NOT NULL,
  party_type   ENUM('opposing_party','co_plaintiff','co_defendant','witness','respondent',
                    'petitioner','intervenor','third_party','prosecutor','public_attorney','other')
               NOT NULL DEFAULT 'other',
  fullname     VARCHAR(200) NOT NULL,
  email        VARCHAR(150) NULL,
  phone        VARCHAR(50)  NULL,
  address      TEXT         NULL,
  organization VARCHAR(200) NULL,
  notes        TEXT         NULL,
  created_by   INT          NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)    REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
