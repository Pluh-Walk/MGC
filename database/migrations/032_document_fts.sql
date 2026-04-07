-- ─── §3.3 Document Full-Text Search ──────────────────────────────────────────
-- Adds extracted_text column for OCR/PDF content + FULLTEXT index for searching

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS extracted_text MEDIUMTEXT NULL AFTER mime_type;

-- FULLTEXT index over filename + original_name + extracted_text
-- NOTE: full-text search requires InnoDB or MyISAM; documents table uses InnoDB.
ALTER TABLE documents
  ADD FULLTEXT INDEX IF NOT EXISTS ft_documents (original_name, extracted_text);
