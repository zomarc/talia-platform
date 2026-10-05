-- Requirements Log — instance task board (ADMIN+/SUPER_USER).
-- Survives pg_dump restore; selective copy via RequirementsLogExport JSON pack.

CREATE TABLE IF NOT EXISTS public.talia_requirement_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL
    CHECK (section IN ('deliverable', 'external', 'question')),
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'backlog'
    CHECK (status IN ('backlog', 'in_progress', 'done', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'p1'
    CHECK (priority IN ('p0', 'p1', 'p2')),
  area TEXT
    CHECK (area IS NULL OR area IN ('ui', 'data', 'engine', 'docs', 'ops')),
  target_version TEXT,
  owner TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'plaud', 'cursor')),
  source_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_talia_requirement_item_section_status
  ON public.talia_requirement_item (section, status);

CREATE INDEX IF NOT EXISTS idx_talia_requirement_item_target_version
  ON public.talia_requirement_item (target_version);

CREATE INDEX IF NOT EXISTS idx_talia_requirement_item_updated
  ON public.talia_requirement_item (updated_at DESC);

CREATE OR REPLACE FUNCTION public.update_talia_requirement_item_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_talia_requirement_item_updated_at
  ON public.talia_requirement_item;
CREATE TRIGGER trigger_update_talia_requirement_item_updated_at
  BEFORE UPDATE ON public.talia_requirement_item
  FOR EACH ROW EXECUTE FUNCTION public.update_talia_requirement_item_updated_at();

COMMENT ON TABLE public.talia_requirement_item IS
  'Talia Requirements Log — deliverables, external actions, open questions. Instance-scoped; rides DB backup.';
