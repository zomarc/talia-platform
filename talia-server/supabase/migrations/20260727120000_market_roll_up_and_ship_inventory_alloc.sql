-- Market rollup lookup (lkp.MARKET_ROLL_UP)
CREATE TABLE IF NOT EXISTS market_roll_up (
  id BIGSERIAL PRIMARY KEY,
  agency_market TEXT NOT NULL,
  new_budget_roll_up TEXT,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  active_record_flag INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_market_roll_up_agency_market_active
  ON market_roll_up (agency_market)
  WHERE active_record_flag = 1;

CREATE INDEX IF NOT EXISTS idx_market_roll_up_agency_market ON market_roll_up(agency_market);
CREATE INDEX IF NOT EXISTS idx_market_roll_up_budget_roll_up ON market_roll_up(new_budget_roll_up);

-- Ship inventory allocations (stg.SHIP_INVENTORY_ALLOC)
-- allocation_owner_id is res_id when FIT/OBJ FIT, group_id when GROUP.
-- inventory_request_type 'GTY ONLY' = group booked, cabin not assigned.
CREATE TABLE IF NOT EXISTS ship_inventory_alloc (
  id BIGSERIAL PRIMARY KEY,
  allocation_id BIGINT,
  allocation_owner_type TEXT,
  allocation_owner_id BIGINT,
  ship_code TEXT,
  sail_date_from DATE,
  sail_date_to DATE,
  cabin_category TEXT,
  cabin_number TEXT,
  berth_number TEXT,
  occupancy INTEGER,
  price_category TEXT,
  inventory_request_type TEXT,
  inventory_result_type TEXT,
  probability NUMERIC,
  is_soft_assign TEXT,
  release_timestamp TIMESTAMPTZ,
  dlgt_res_id BIGINT,
  allocation_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ship_inv_alloc_ship_sail
  ON ship_inventory_alloc(ship_code, sail_date_from);
CREATE INDEX IF NOT EXISTS idx_ship_inv_alloc_owner
  ON ship_inventory_alloc(allocation_owner_type, allocation_owner_id);
CREATE INDEX IF NOT EXISTS idx_ship_inv_alloc_cabin
  ON ship_inventory_alloc(ship_code, cabin_number);
CREATE INDEX IF NOT EXISTS idx_ship_inv_alloc_request_type
  ON ship_inventory_alloc(inventory_request_type);
CREATE INDEX IF NOT EXISTS idx_ship_inv_alloc_category
  ON ship_inventory_alloc(cabin_category);
