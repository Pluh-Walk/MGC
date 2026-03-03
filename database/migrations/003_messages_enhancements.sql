-- ============================================================
-- 003 – Message enhancements
-- Run in phpMyAdmin against law_system_auth
-- ============================================================

-- 1. Add attachment + edit + per-user soft-delete columns to messages
ALTER TABLE messages
  ADD COLUMN attachment_path     VARCHAR(500)  NULL AFTER content,
  ADD COLUMN attachment_name     VARCHAR(255)  NULL AFTER attachment_path,
  ADD COLUMN attachment_mime     VARCHAR(100)  NULL AFTER attachment_name,
  ADD COLUMN edited_at           DATETIME      NULL AFTER attachment_mime,
  ADD COLUMN deleted_for_all     TINYINT(1)    NOT NULL DEFAULT 0 AFTER edited_at,
  ADD COLUMN deleted_for_sender  TINYINT(1)    NOT NULL DEFAULT 0 AFTER deleted_for_all,
  ADD COLUMN deleted_for_receiver TINYINT(1)   NOT NULL DEFAULT 0 AFTER deleted_for_sender;

-- 2. Per-user conversation soft-delete (each user can hide their copy)
CREATE TABLE IF NOT EXISTS conversation_deletions (
  user_id    INT      NOT NULL,
  partner_id INT      NOT NULL,
  deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, partner_id),
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
);
