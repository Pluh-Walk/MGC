-- ============================================================
--  MGC Law System — Authentication Database
--  Run this in phpMyAdmin or via MySQL CLI
-- ============================================================

CREATE DATABASE IF NOT EXISTS law_system_auth
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE law_system_auth;

CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  fullname    VARCHAR(100)                      NOT NULL,
  username    VARCHAR(50)                       NOT NULL UNIQUE,
  email       VARCHAR(100)                      NOT NULL UNIQUE,
  password    VARCHAR(255)                      NOT NULL,
  role        ENUM('attorney', 'client')        NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
