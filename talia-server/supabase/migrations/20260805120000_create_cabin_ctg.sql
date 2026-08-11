-- Cabin category → generic group lookup (lkp.CABIN_CTG).
-- CABIN = real category code (IA, XB, …); GENERIC_CATEGORY = INSIDE | OUTSIDE | DELUXE.
CREATE TABLE IF NOT EXISTS cabin_ctg (
  id BIGSERIAL PRIMARY KEY,
  cabin_code TEXT NOT NULL,
  generic_category TEXT,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  active_record_flag INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cabin_ctg_code_active
  ON cabin_ctg(cabin_code)
  WHERE active_record_flag = 1;

CREATE INDEX IF NOT EXISTS idx_cabin_ctg_generic
  ON cabin_ctg(generic_category);

CREATE INDEX IF NOT EXISTS idx_cabin_ctg_active
  ON cabin_ctg(active_record_flag)
  WHERE active_record_flag = 1;
