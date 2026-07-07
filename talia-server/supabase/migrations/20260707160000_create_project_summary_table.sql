-- Project Summary: versioned executive overview stored for in-app display.
-- Content is the self-contained branded HTML (docs/EXECUTIVE-OVERVIEW.html),
-- published by scripts/generate-executive-overview-pdf.sh.

CREATE TABLE IF NOT EXISTS project_summary (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Project Summary',
  version TEXT,
  format TEXT NOT NULL DEFAULT 'html',
  content TEXT NOT NULL,
  source_path TEXT,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_summary_current
  ON project_summary (is_current, generated_at DESC);
