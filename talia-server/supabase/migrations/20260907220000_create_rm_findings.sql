-- Finding store for talia-engine (Phase A / Advise).
-- Engine writes; talia-server reads for Checklist / Activity.

CREATE TABLE IF NOT EXISTS rm_engine_runs (
  run_id TEXT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'ok', 'error')),
  agent_ids TEXT[] NOT NULL DEFAULT '{}',
  finding_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  trigger TEXT NOT NULL DEFAULT 'on_demand',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rm_engine_runs_started
  ON rm_engine_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS rm_findings (
  finding_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject JSONB NOT NULL DEFAULT '{}'::jsonb,
  as_of TIMESTAMPTZ NOT NULL,
  score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 1),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'watch', 'action', 'critical')),
  recommended_action JSONB NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'dismissed', 'applied', 'expired')),
  tenant_id TEXT,
  run_id TEXT REFERENCES rm_engine_runs(run_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rm_findings_status_score
  ON rm_findings (status, score DESC);
CREATE INDEX IF NOT EXISTS idx_rm_findings_subject
  ON rm_findings (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_rm_findings_agent
  ON rm_findings (agent_id);
CREATE INDEX IF NOT EXISTS idx_rm_findings_run
  ON rm_findings (run_id);

CREATE OR REPLACE FUNCTION update_rm_findings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_rm_findings_updated_at ON rm_findings;
CREATE TRIGGER trigger_update_rm_findings_updated_at
  BEFORE UPDATE ON rm_findings
  FOR EACH ROW EXECUTE FUNCTION update_rm_findings_updated_at();

COMMENT ON TABLE rm_findings IS 'Normalised RM Agent Findings (ADR-001). Engine writes; UI Checklist reads via talia-server.';
COMMENT ON TABLE rm_engine_runs IS 'talia-engine evaluation runs for Activity visualisation.';
