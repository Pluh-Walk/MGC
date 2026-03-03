-- Run this in phpMyAdmin against law_system_auth
-- Makes the content column nullable so attachment-only messages can be saved.
ALTER TABLE messages
  MODIFY COLUMN content TEXT NULL DEFAULT NULL;
