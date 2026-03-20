CREATE TABLE IF NOT EXISTS ui_activity_events (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT,
  user_email TEXT,
  user_role TEXT,
  kind TEXT,
  report TEXT,
  panel_component TEXT,
  purpose TEXT,
  status TEXT,
  performance_ms INTEGER,
  query_count INTEGER,
  source_query_id TEXT,
  criteria JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ui_activity_events_at ON ui_activity_events(at DESC);
CREATE INDEX IF NOT EXISTS idx_ui_activity_events_user_id ON ui_activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ui_activity_events_user_email ON ui_activity_events(user_email);
CREATE INDEX IF NOT EXISTS idx_ui_activity_events_report ON ui_activity_events(report);
