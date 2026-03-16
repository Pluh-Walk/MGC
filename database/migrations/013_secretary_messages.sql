-- ============================================================
--  Migration 013: Secretary message attribution
--  Run in phpMyAdmin against law_system_auth
--  Date: 2026-03-16
-- ============================================================

USE law_system_auth;

-- When a secretary sends a message on behalf of an attorney,
-- sender_id = secretary's user id, sent_on_behalf_of = attorney's user id
ALTER TABLE messages
  ADD COLUMN sent_on_behalf_of INT NULL DEFAULT NULL AFTER sender_id;

ALTER TABLE messages
  ADD CONSTRAINT fk_msg_on_behalf FOREIGN KEY (sent_on_behalf_of) REFERENCES users(id) ON DELETE SET NULL;
