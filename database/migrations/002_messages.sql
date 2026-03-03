-- ============================================================
--  MGC Law System — Phase 2 Migration: Messages
--  Run this in phpMyAdmin after 001_phase1_core.sql
--  Date: 2026-03-02
-- ============================================================

USE law_system_auth;

-- ─── Direct Messages ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  sender_id   INT  NOT NULL,
  receiver_id INT  NOT NULL,
  case_id     INT  NULL,           -- optional case context
  content     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (case_id)     REFERENCES cases(id) ON DELETE SET NULL,
  INDEX idx_sender   (sender_id),
  INDEX idx_receiver (receiver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
