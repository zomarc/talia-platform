-- Project risk register and a light document repository.
-- Risks and documents are their own records. They point at requirements,
-- matrix cells, and (for documents) risks by link. Text is not copied.

CREATE TABLE IF NOT EXISTS public.risk_register_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL,
  title TEXT NOT NULL,
  statement TEXT,
  category TEXT NOT NULL DEFAULT 'technical'
    CHECK (category IN ('supplier', 'people', 'process', 'benefits', 'technical', 'external')),
  likelihood SMALLINT NOT NULL DEFAULT 3
    CHECK (likelihood BETWEEN 1 AND 5),
  impact SMALLINT NOT NULL DEFAULT 3
    CHECK (impact BETWEEN 1 AND 5),
  residual_likelihood SMALLINT
    CHECK (residual_likelihood IS NULL OR residual_likelihood BETWEEN 1 AND 5),
  residual_impact SMALLINT
    CHECK (residual_impact IS NULL OR residual_impact BETWEEN 1 AND 5),
  proximity TEXT NOT NULL DEFAULT 'immediate'
    CHECK (proximity IN ('immediate', 'phase', 'later')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'treating', 'accepted', 'closed', 'occurred')),
  response TEXT NOT NULL DEFAULT 'reduce'
    CHECK (response IN ('avoid', 'reduce', 'transfer', 'accept')),
  treatment TEXT,
  owner TEXT,
  review_on DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  CONSTRAINT risk_register_item_reference_code_key UNIQUE (reference_code)
);

CREATE INDEX IF NOT EXISTS idx_risk_register_item_status
  ON public.risk_register_item (status, sort_order, reference_code);

CREATE TABLE IF NOT EXISTS public.risk_register_link (
  risk_id UUID NOT NULL
    REFERENCES public.risk_register_item (id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL
    CHECK (target_kind IN ('requirement', 'matrix')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (risk_id, target_kind, target_id)
);

CREATE INDEX IF NOT EXISTS idx_risk_register_link_target
  ON public.risk_register_link (target_kind, target_id);

CREATE TABLE IF NOT EXISTS public.project_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  CONSTRAINT project_document_reference_code_key UNIQUE (reference_code)
);

CREATE INDEX IF NOT EXISTS idx_project_document_title
  ON public.project_document (title);

CREATE TABLE IF NOT EXISTS public.project_document_asset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL
    REFERENCES public.project_document (id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL
    CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/gif', 'image/webp')),
  byte_size INTEGER NOT NULL
    CHECK (byte_size > 0 AND byte_size <= 1200000),
  content_base64 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_document_asset_document
  ON public.project_document_asset (document_id);

CREATE TABLE IF NOT EXISTS public.project_document_link (
  document_id UUID NOT NULL
    REFERENCES public.project_document (id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL
    CHECK (target_kind IN ('requirement', 'matrix', 'risk')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, target_kind, target_id)
);

CREATE INDEX IF NOT EXISTS idx_project_document_link_target
  ON public.project_document_link (target_kind, target_id);

CREATE OR REPLACE FUNCTION public.touch_project_admin_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_touch_risk_register_item_updated_at
  ON public.risk_register_item;
CREATE TRIGGER trigger_touch_risk_register_item_updated_at
  BEFORE UPDATE ON public.risk_register_item
  FOR EACH ROW EXECUTE FUNCTION public.touch_project_admin_updated_at();

DROP TRIGGER IF EXISTS trigger_touch_project_document_updated_at
  ON public.project_document;
CREATE TRIGGER trigger_touch_project_document_updated_at
  BEFORE UPDATE ON public.project_document
  FOR EACH ROW EXECUTE FUNCTION public.touch_project_admin_updated_at();

COMMENT ON TABLE public.risk_register_item IS
  'Project risk register. Treatments point at Requirements Log and Functionality Matrix rows by link.';
COMMENT ON TABLE public.project_document IS
  'Lightweight project documents. Body is Markdown. Images live in project_document_asset.';
COMMENT ON TABLE public.project_document_link IS
  'Assignment of a document onto a requirement, matrix cell, or risk.';
