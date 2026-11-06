-- Star important project documents so the Documents index can pin them at the top.

ALTER TABLE public.project_document
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_project_document_is_starred
  ON public.project_document (is_starred)
  WHERE is_starred;

COMMENT ON COLUMN public.project_document.is_starred IS
  'When true, the document is pinned at the top of the Documents index.';
