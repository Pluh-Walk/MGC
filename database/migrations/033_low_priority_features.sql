-- ─────────────────────────────────────────────────────────────
-- Migration 033 — Low Priority Features
--   1. Hearing Preparation Checklist
--   2. Client Satisfaction Survey
--   3. Announcement Acknowledgment
-- ─────────────────────────────────────────────────────────────

-- ── 1. Hearing Preparation Checklist ────────────────────────────
CREATE TABLE IF NOT EXISTS hearing_checklist_items (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  hearing_id  INT NOT NULL,
  label       VARCHAR(300) NOT NULL,
  is_done     TINYINT(1)   NOT NULL DEFAULT 0,
  created_by  INT          NULL,
  done_by     INT          NULL,
  done_at     DATETIME     NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hearing_id) REFERENCES hearings(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)    ON DELETE SET NULL,
  FOREIGN KEY (done_by)    REFERENCES users(id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 2. Client Satisfaction Surveys ──────────────────────────────
CREATE TABLE IF NOT EXISTS client_surveys (
  id                   INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  case_id              INT NOT NULL,
  client_id            INT NOT NULL,
  token                VARCHAR(64) NOT NULL UNIQUE,          -- single-use token for survey link
  sent_at              DATETIME     NULL,
  responded_at         DATETIME     NULL,
  nps_score            TINYINT      NULL CHECK (nps_score BETWEEN 0 AND 10),
  satisfaction_rating  TINYINT      NULL CHECK (satisfaction_rating BETWEEN 1 AND 5),
  communication_rating TINYINT      NULL CHECK (communication_rating BETWEEN 1 AND 5),
  outcome_rating       TINYINT      NULL CHECK (outcome_rating BETWEEN 1 AND 5),
  comments             TEXT         NULL,
  outcome              VARCHAR(100) NULL,   -- case outcome at time of close
  FOREIGN KEY (case_id)   REFERENCES cases(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. Announcement Acknowledgments ─────────────────────────────
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS ack_required TINYINT(1) NOT NULL DEFAULT 0 AFTER body;

CREATE TABLE IF NOT EXISTS announcement_acknowledgments (
  id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  announcement_id INT NOT NULL,
  user_id         INT NOT NULL,
  acknowledged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ack (announcement_id, user_id),
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
