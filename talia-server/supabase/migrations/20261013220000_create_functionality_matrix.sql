-- Functionality Matrix — distinct from the Requirements Log.
-- Cells live here. Log items are assigned through functionality_matrix_link only.

CREATE TABLE IF NOT EXISTS public.functionality_matrix_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL,
  element TEXT NOT NULL,
  function_name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  name TEXT NOT NULL,
  concept TEXT,
  rationale TEXT,
  technical_requirement TEXT,
  complexity TEXT NOT NULL DEFAULT 'M'
    CHECK (complexity IN ('L', 'M', 'H')),
  size_rank TEXT NOT NULL DEFAULT 'M'
    CHECK (size_rank IN ('L', 'M', 'H')),
  phase TEXT NOT NULL DEFAULT '0'
    CHECK (phase IN ('0', 'mvp', '1', '2', '3')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  CONSTRAINT functionality_matrix_item_reference_code_key UNIQUE (reference_code)
);

CREATE INDEX IF NOT EXISTS idx_functionality_matrix_item_element
  ON public.functionality_matrix_item (element, sort_order, reference_code);

CREATE INDEX IF NOT EXISTS idx_functionality_matrix_item_phase
  ON public.functionality_matrix_item (phase);

CREATE TABLE IF NOT EXISTS public.functionality_matrix_note (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_item_id UUID NOT NULL
    REFERENCES public.functionality_matrix_item (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_functionality_matrix_note_item
  ON public.functionality_matrix_note (matrix_item_id, created_at);

CREATE TABLE IF NOT EXISTS public.functionality_matrix_link (
  matrix_item_id UUID NOT NULL,
  requirement_item_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (matrix_item_id, requirement_item_id),
  CONSTRAINT functionality_matrix_link_matrix_item_id_fkey
    FOREIGN KEY (matrix_item_id)
    REFERENCES public.functionality_matrix_item (id) ON DELETE CASCADE,
  CONSTRAINT functionality_matrix_link_requirement_item_id_fkey
    FOREIGN KEY (requirement_item_id)
    REFERENCES public.talia_requirement_item (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_functionality_matrix_link_requirement
  ON public.functionality_matrix_link (requirement_item_id);

CREATE OR REPLACE FUNCTION public.touch_functionality_matrix_item_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_touch_functionality_matrix_item_updated_at
  ON public.functionality_matrix_item;
CREATE TRIGGER trigger_touch_functionality_matrix_item_updated_at
  BEFORE UPDATE ON public.functionality_matrix_item
  FOR EACH ROW EXECUTE FUNCTION public.touch_functionality_matrix_item_updated_at();

COMMENT ON TABLE public.functionality_matrix_item IS
  'Functionality Matrix cells. Distinct from talia_requirement_item; log rows are linked, not copied.';
COMMENT ON TABLE public.functionality_matrix_note IS
  'Discussion notes on a matrix requirement, kept in order as the spec is built.';
COMMENT ON TABLE public.functionality_matrix_link IS
  'Assignment of Requirements Log items onto a Functionality Matrix cell.';
