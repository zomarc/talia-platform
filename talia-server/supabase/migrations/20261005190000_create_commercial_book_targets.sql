-- Commercial booking targets from lkp.Commercial_Book_Targets.
-- Weekly pace by master voyage, market, channel, and pax type.
-- Guest and revenue amounts are fractional weekly targets, not a cumulative curve.
CREATE TABLE IF NOT EXISTS commercial_book_targets (
  id BIGSERIAL PRIMARY KEY,
  pax_type TEXT,
  accounting_month DATE,
  itinerary_type_old TEXT,
  agency_market TEXT,
  agency_subchannel TEXT,
  agency_channel TEXT,
  master_voyage_length INTEGER,
  label TEXT,
  bud_gross_pre_post_revenue_eur NUMERIC,
  wc_snapshot_date DATE,
  master_voyage TEXT,
  guest_count NUMERIC,
  pax_nights NUMERIC,
  gross_ticket_revenue_eur NUMERIC,
  gross_pre_emb_revenue_eur NUMERIC,
  gross_pre_post_revenue_eur NUMERIC,
  shorex_rev_eur NUMERIC,
  addon_rev_eur NUMERIC,
  other_ps_rev_eur NUMERIC,
  res_status TEXT,
  group_status TEXT,
  pax_status TEXT,
  accounting_year TEXT,
  itinerary_type TEXT,
  market_grouping TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_book_targets_voyage_week
  ON commercial_book_targets (master_voyage, wc_snapshot_date);

CREATE INDEX IF NOT EXISTS idx_commercial_book_targets_week
  ON commercial_book_targets (wc_snapshot_date);

CREATE INDEX IF NOT EXISTS idx_commercial_book_targets_market_group
  ON commercial_book_targets (market_grouping);

COMMENT ON TABLE commercial_book_targets IS
  'Synapse lkp.Commercial_Book_Targets. Weekly commercial booking pace by voyage, market, channel, and pax type.';
