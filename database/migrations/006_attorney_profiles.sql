-- ============================================================
--  Migration 006: Attorney professional profiles
-- ============================================================

USE law_system_auth;

CREATE TABLE IF NOT EXISTS attorney_profiles (
  user_id            INT          NOT NULL PRIMARY KEY,
  phone              VARCHAR(30),
  office_address     TEXT,
  ibp_number         VARCHAR(50),
  law_firm           VARCHAR(150),
  specializations    TEXT,          -- comma-separated practice areas
  court_admissions   TEXT,          -- comma-separated courts
  years_experience   INT,
  bio                TEXT,
  availability       ENUM('available','in_court','offline') NOT NULL DEFAULT 'available',
  photo_path         VARCHAR(255),
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
