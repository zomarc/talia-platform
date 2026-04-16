-- Composite indexes for bounded UI/API queries on published_rates_changes
-- (sail + sailing window + newest snapshots) and rate-line history lookups.

CREATE INDEX IF NOT EXISTS idx_published_rates_changes_sail_departure_snapshot
  ON public.published_rates_changes (sail_code, departure_date, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_published_rates_changes_rate_key_snapshot
  ON public.published_rates_changes (rate_key, snapshot_date DESC);
