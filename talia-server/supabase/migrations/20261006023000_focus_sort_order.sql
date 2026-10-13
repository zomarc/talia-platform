-- Display order for the focus list. Existing rows keep their current
-- created_at order so the list does not jump when this lands.

ALTER TABLE public.focuses
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE public.focuses AS focus
SET sort_order = ranked.position
FROM (
  SELECT id, (row_number() OVER (ORDER BY created_at DESC NULLS LAST, name))::int AS position
  FROM public.focuses
) AS ranked
WHERE focus.id = ranked.id
  AND focus.sort_order = 0;

CREATE INDEX IF NOT EXISTS idx_focuses_sort_order ON public.focuses (sort_order, name);

COMMENT ON COLUMN public.focuses.sort_order IS
  'Position in the focus list. Lower numbers appear first.';
