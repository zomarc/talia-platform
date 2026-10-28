-- Delivery phases (aligned with the functionality matrix) and named milestones.
-- A milestone name matches talia_requirement_item.target_version.

CREATE TABLE IF NOT EXISTS public.project_phase (
  code TEXT PRIMARY KEY CHECK (code IN ('0', 'mvp', '1', '2', '3')),
  label TEXT NOT NULL,
  target_on DATE,
  sort_order INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.project_phase (code, label, sort_order) VALUES
  ('0', 'Dev', 0),
  ('mvp', 'MVP', 1),
  ('1', 'Phase 1', 2),
  ('2', 'Phase 2', 3),
  ('3', 'Phase 3', 4)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.project_milestone (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  phase_code TEXT REFERENCES public.project_phase (code) ON DELETE SET NULL,
  target_on DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_milestone_phase
  ON public.project_milestone (phase_code, sort_order, name);

DROP TRIGGER IF EXISTS trigger_touch_project_phase_updated_at ON public.project_phase;
CREATE TRIGGER trigger_touch_project_phase_updated_at
  BEFORE UPDATE ON public.project_phase
  FOR EACH ROW EXECUTE FUNCTION public.touch_project_admin_updated_at();

DROP TRIGGER IF EXISTS trigger_touch_project_milestone_updated_at ON public.project_milestone;
CREATE TRIGGER trigger_touch_project_milestone_updated_at
  BEFORE UPDATE ON public.project_milestone
  FOR EACH ROW EXECUTE FUNCTION public.touch_project_admin_updated_at();

COMMENT ON TABLE public.project_phase IS
  'Delivery phases for the project plan. Codes match functionality_matrix_item.phase.';
COMMENT ON TABLE public.project_milestone IS
  'Named milestones. name matches requirement target_version. target_on is the date the plan aims at.';
