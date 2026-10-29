-- Frozen Seaware group-MR extract (stg.SW_ETL_*).
-- Replace-all template: the same sync keys reload this shape after the warehouse refresh.
-- Analytical columns only. Agency names, agent contacts, addresses, and comments stay in Synapse.

CREATE TABLE IF NOT EXISTS sw_etl_group (
  id BIGSERIAL PRIMARY KEY,
  rec_group_id BIGINT NOT NULL,
  group_id BIGINT NOT NULL,
  group_status TEXT,
  group_init_date DATE,
  group_status_date DATE,
  changed_date TIMESTAMPTZ,
  sail_date_from DATE,
  sail_date_to DATE,
  n_of_guests INTEGER,
  n_of_cabins INTEGER,
  n_of_delegate_guests INTEGER,
  probability NUMERIC,
  is_prob_manual BOOLEAN,
  agency_id BIGINT,
  ownership_code TEXT,
  -- Warehouse field. Not a guest count; do not use it as expected pax.
  group_expected_addition NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (rec_group_id)
);

CREATE INDEX IF NOT EXISTS idx_sw_etl_group_group_id ON sw_etl_group (group_id);
CREATE INDEX IF NOT EXISTS idx_sw_etl_group_status_sail ON sw_etl_group (group_status, sail_date_from);

COMMENT ON TABLE sw_etl_group IS
  'Current SW_ETL_GROUPS snapshot for source MR review. No agency or agent identity fields.';
COMMENT ON COLUMN sw_etl_group.group_expected_addition IS
  'Source GROUP_ExpectedAddition. Large decimal; not a guest count.';

CREATE TABLE IF NOT EXISTS sw_etl_group_header (
  id BIGSERIAL PRIMARY KEY,
  rec_group_id BIGINT NOT NULL,
  group_id BIGINT NOT NULL,
  group_status TEXT,
  group_init_date DATE,
  changed_date TIMESTAMPTZ,
  n_of_guests INTEGER,
  probability NUMERIC,
  is_prob_manual BOOLEAN,
  agency_id BIGINT,
  ownership_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (rec_group_id)
);

CREATE INDEX IF NOT EXISTS idx_sw_etl_group_header_group ON sw_etl_group_header (group_id, changed_date);

COMMENT ON TABLE sw_etl_group_header IS
  'SW_ETL_GROUP_HEADER versions for one group''s source MR over time. No contact fields.';

CREATE TABLE IF NOT EXISTS sw_etl_group_ship (
  id BIGSERIAL PRIMARY KEY,
  rec_ship_req_id BIGINT,
  rec_group_id BIGINT NOT NULL,
  group_id BIGINT NOT NULL,
  ship_code TEXT,
  sail_id BIGINT,
  sail_date_from DATE,
  sail_date_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (rec_group_id)
);

CREATE INDEX IF NOT EXISTS idx_sw_etl_group_ship_ship_sail ON sw_etl_group_ship (ship_code, sail_date_from);

COMMENT ON TABLE sw_etl_group_ship IS
  'One ship and sail per current SW_ETL_GROUPS row, from SW_ETL_GROUP_SHIP_REQUEST.';

CREATE TABLE IF NOT EXISTS sw_etl_sail_inv_alloc (
  id BIGSERIAL PRIMARY KEY,
  rec_id BIGINT NOT NULL,
  allocation_id BIGINT,
  allocation_timestamp TIMESTAMPTZ,
  owner_type TEXT,
  owner_id BIGINT,
  owner_status TEXT,
  probability NUMERIC,
  occupancy INTEGER,
  request_category TEXT,
  sail_date_from DATE,
  sail_date_to DATE,
  port_from TEXT,
  port_to TEXT,
  agency_id BIGINT,
  is_internal BOOLEAN,
  ownership_code TEXT,
  reserve_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (rec_id)
);

CREATE INDEX IF NOT EXISTS idx_sw_etl_sail_inv_alloc_owner ON sw_etl_sail_inv_alloc (owner_type, owner_id);

COMMENT ON TABLE sw_etl_sail_inv_alloc IS
  'SW_ETL_SAIL_INVENTORY_DATA_ALLOC probabilities. Agency names are not stored.';

CREATE TABLE IF NOT EXISTS sw_etl_extract_load (
  id BIGSERIAL PRIMARY KEY,
  rec_id BIGINT NOT NULL,
  entity_type TEXT,
  entity_id BIGINT,
  entity_origin_id BIGINT,
  load_date TIMESTAMPTZ,
  is_invalid BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (rec_id)
);

CREATE INDEX IF NOT EXISTS idx_sw_etl_extract_load_type_date ON sw_etl_extract_load (entity_type, load_date);

COMMENT ON TABLE sw_etl_extract_load IS
  'GRP rows only from SW_ETL_EXTRACT_LOAD. RES, SAIL, and activity rows are not synced.';

CREATE OR REPLACE VIEW sw_etl_alloc_by_owner AS
SELECT
  COALESCE(NULLIF(BTRIM(owner_type), ''), 'UNKNOWN') AS owner_type,
  COUNT(*)::bigint AS allocation_rows,
  COUNT(DISTINCT owner_id)::bigint AS owners,
  ROUND(AVG(probability)::numeric, 2) AS avg_probability
FROM sw_etl_sail_inv_alloc
GROUP BY 1;

COMMENT ON VIEW sw_etl_alloc_by_owner IS
  'Allocation probability by owner type for the source MR review.';

GRANT SELECT ON sw_etl_group, sw_etl_group_header, sw_etl_group_ship,
  sw_etl_sail_inv_alloc, sw_etl_extract_load, sw_etl_alloc_by_owner
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION sw_etl_header_activity(group_ids bigint[])
RETURNS TABLE(group_id bigint, versions integer, change_days integer)
LANGUAGE sql STABLE AS $$
  SELECT
    h.group_id,
    COUNT(*)::int AS versions,
    COUNT(DISTINCT h.changed_date::date)::int AS change_days
  FROM sw_etl_group_header h
  WHERE h.group_id = ANY(group_ids)
  GROUP BY h.group_id;
$$;

GRANT EXECUTE ON FUNCTION sw_etl_header_activity(bigint[]) TO anon, authenticated, service_role;
