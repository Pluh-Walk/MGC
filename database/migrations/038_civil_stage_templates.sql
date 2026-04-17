-- ─────────────────────────────────────────────────────────────────
-- Migration 038 — Civil Case Stage Templates Overhaul
--
-- Changes:
--   1. Replaces the generic 6-stage civil template with a full
--      9-stage workflow that mirrors the actual stages of a civil
--      case (Pre-Filing → Filing → Summons → Discovery →
--      Pre-Trial → Trial → Decision → Appeal → Execution).
--
--   2. Adds a civil_ejectment template that follows the Rule on
--      Summary Procedure (no discovery; goes straight to
--      Preliminary Conference then Judgment).
--
--   3. Adds a civil_family template for family-court civil sub-types
--      (annulment, legal_separation, support, adoption) that tracks
--      the distinct Family Courts workflow.
--
-- The stagesController.initCaseStages function is updated separately
-- to select the correct template key based on civil_case_type.
-- ─────────────────────────────────────────────────────────────────

-- 1. Replace generic civil stages
DELETE FROM stage_templates WHERE case_type = 'civil';

INSERT INTO stage_templates (case_type, stage_name, stage_order) VALUES
  ('civil', 'Pre-Filing',  1),
  ('civil', 'Filing',      2),
  ('civil', 'Summons',     3),
  ('civil', 'Discovery',   4),
  ('civil', 'Pre-Trial',   5),
  ('civil', 'Trial',       6),
  ('civil', 'Decision',    7),
  ('civil', 'Appeal',      8),
  ('civil', 'Execution',   9);

-- 2. Ejectment / Summary Procedure (Rule on Summary Procedure)
--    No discovery; shortened timeline mandated by statute.
DELETE FROM stage_templates WHERE case_type = 'civil_ejectment';

INSERT INTO stage_templates (case_type, stage_name, stage_order) VALUES
  ('civil_ejectment', 'Filing',                 1),
  ('civil_ejectment', 'Service of Summons',     2),
  ('civil_ejectment', 'Preliminary Conference', 3),
  ('civil_ejectment', 'Judgment',               4),
  ('civil_ejectment', 'Execution',              5);

-- 3. Family-court civil sub-types (A.M. No. 02-11-12-SC and related rules)
--    Covers: annulment, declaration of nullity, legal separation,
--            support, adoption.
DELETE FROM stage_templates WHERE case_type = 'civil_family';

INSERT INTO stage_templates (case_type, stage_name, stage_order) VALUES
  ('civil_family', 'Petition',              1),
  ('civil_family', 'Service',               2),
  ('civil_family', 'Pre-Trial Conference',  3),
  ('civil_family', 'Trial',                 4),
  ('civil_family', 'Decision',              5),
  ('civil_family', 'Appeal',                6);
