-- Create budget table
CREATE TABLE IF NOT EXISTS budget (
  id SERIAL PRIMARY KEY,
  passenger_type TEXT,
  length INTEGER,
  itinerary_type TEXT,
  cabin TEXT,
  market TEXT,
  channel TEXT,
  new_market_roll_up TEXT,
  old_old_market_roll_up TEXT,
  accounting_month DATE,
  master_voyage TEXT,
  master_departure_date TEXT,
  passengers DECIMAL(15,2),
  passenger_nights DECIMAL(15,2),
  currency TEXT,
  fx_1 DECIMAL(15,2),
  pppd DECIMAL(15,2),
  pppd_eur DECIMAL(15,2),
  gross_ticket_revenue_local DECIMAL(15,2),
  gross_ticket_revenue_eur DECIMAL(15,2),
  pre_emb_pppd DECIMAL(15,2),
  pre_emb_revenue_eur DECIMAL(15,2),
  fy DECIMAL(15,2),
  budget_name TEXT,
  version TEXT,
  unique_id TEXT,
  actuals_code TEXT,
  effective_from TIMESTAMP WITH TIME ZONE,
  effective_to TIMESTAMP WITH TIME ZONE,
  active_record_flag INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_budget_fy ON budget(fy);
CREATE INDEX IF NOT EXISTS idx_budget_accounting_month ON budget(accounting_month);
CREATE INDEX IF NOT EXISTS idx_budget_master_voyage ON budget(master_voyage);
CREATE INDEX IF NOT EXISTS idx_budget_active_record_flag ON budget(active_record_flag);


