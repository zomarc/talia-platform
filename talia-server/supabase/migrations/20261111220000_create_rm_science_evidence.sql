-- Science Evidence store for talia-engine discrete Python driver analysis.
-- Advisory first (role=advisory); may later be promoted to source for prior/peerset consumers.
-- Must not be confused with rm_findings (Finding score + recommended_action).

CREATE TABLE IF NOT EXISTS rm_science_evidence (
  evidence_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL DEFAULT 'science.driver_analysis.v0',
  method_version TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'advisory'
    CHECK (role IN ('advisory', 'source')),
  as_of TIMESTAMPTZ NOT NULL,
  scope_type TEXT NOT NULL,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject JSONB NOT NULL DEFAULT '{}'::jsonb,
  peerset JSONB NOT NULL DEFAULT '{}'::jsonb,
  prior JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_moments JSONB NOT NULL DEFAULT '[]'::jsonb,
  material_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  revenue_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  covariate_ranks JSONB NOT NULL DEFAULT '[]'::jsonb,
  forward_now JSONB,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  tenant_id TEXT,
  run_id TEXT REFERENCES rm_engine_runs(run_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rm_science_evidence_subject
  ON rm_science_evidence (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_rm_science_evidence_role_asof
  ON rm_science_evidence (role, as_of DESC);
CREATE INDEX IF NOT EXISTS idx_rm_science_evidence_task
  ON rm_science_evidence (task_id, as_of DESC);
CREATE INDEX IF NOT EXISTS idx_rm_science_evidence_run
  ON rm_science_evidence (run_id);

CREATE OR REPLACE FUNCTION update_rm_science_evidence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_rm_science_evidence_updated_at ON rm_science_evidence;
CREATE TRIGGER trigger_update_rm_science_evidence_updated_at
  BEFORE UPDATE ON rm_science_evidence
  FOR EACH ROW EXECUTE FUNCTION update_rm_science_evidence_updated_at();

COMMENT ON TABLE rm_science_evidence IS
  'talia-engine science.driver_analysis Evidence (prior/peerset/value). Advisory until promoted to source. Not Findings.';

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE rm_science_evidence TO anon, authenticated, service_role;
