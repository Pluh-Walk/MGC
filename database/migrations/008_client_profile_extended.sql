-- ============================================================
--  Migration 008: Extended client profile fields
--
--  PRE-REQUISITE — Do this BEFORE running the SQL below:
--  -------------------------------------------------------
--  Error #1813 means an orphaned tablespace file is on disk.
--  Fix:
--    1. Stop MySQL in XAMPP Control Panel.
--    2. Open Windows Explorer and navigate to:
--         C:\xampp\mysql\data\law_system_auth\
--    3. Delete these files if they exist:
--         client_profiles.ibd
--         client_profiles.frm   (only present on MySQL 5.x)
--    4. Start MySQL again in XAMPP Control Panel.
--    5. Now run this entire SQL script in phpMyAdmin.
-- ============================================================

USE law_system_auth;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS client_profiles;

CREATE TABLE client_profiles (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  user_id              INT          NOT NULL UNIQUE,
  phone                VARCHAR(30)  NULL,
  address              TEXT         NULL,
  date_of_birth        DATE         NULL,
  occupation           VARCHAR(100) NULL,
  notes                TEXT         NULL,
  assigned_attorney_id INT          NULL,
  id_type              VARCHAR(50)  NULL,
  id_number            VARCHAR(100) NULL,
  emergency_contact    VARCHAR(200) NULL,
  notif_email          TINYINT(1)   NOT NULL DEFAULT 1,
  notif_case_updates   TINYINT(1)   NOT NULL DEFAULT 1,
  notif_hearings       TINYINT(1)   NOT NULL DEFAULT 1,
  notif_messages       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)              REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_attorney_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
