-- Split milestone label (target_version) from Talia app version (talia_version).

ALTER TABLE public.talia_requirement_item
  ADD COLUMN IF NOT EXISTS talia_version TEXT;

CREATE INDEX IF NOT EXISTS idx_talia_requirement_item_talia_version
  ON public.talia_requirement_item (talia_version);

COMMENT ON COLUMN public.talia_requirement_item.target_version IS
  'Descriptive milestone / release label (e.g. oct-5-demo).';
COMMENT ON COLUMN public.talia_requirement_item.talia_version IS
  'Talia app/semver target (e.g. 0.3.2).';

-- Seed known demo milestone with a plausible app version.
UPDATE public.talia_requirement_item
SET talia_version = '0.3.2'
WHERE target_version = 'oct-5-demo'
  AND (talia_version IS NULL OR btrim(talia_version) = '');
