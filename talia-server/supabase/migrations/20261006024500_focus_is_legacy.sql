-- Shared retired/legacy mark on a focus. The focus stays in its list.

ALTER TABLE public.focuses
  ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.focuses.is_legacy IS
  'Retired or legacy focus. Still listed; the mark makes it easier to skip.';

NOTIFY pgrst, 'reload schema';
