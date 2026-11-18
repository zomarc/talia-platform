-- Admin-editable "key panel" flags for Data Lineage coverage (D015).
-- Soft highlighting only — never blocks the app.

CREATE TABLE IF NOT EXISTS public.panel_lineage_flag (
  panel_component TEXT PRIMARY KEY,
  is_key BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_panel_lineage_flag_is_key
  ON public.panel_lineage_flag (is_key)
  WHERE is_key = TRUE;

COMMENT ON TABLE public.panel_lineage_flag IS
  'Admin flags for key panels in Data Lineage. Gaps are highlighted, never fail.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.panel_lineage_flag TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.panel_lineage_flag TO service_role;
