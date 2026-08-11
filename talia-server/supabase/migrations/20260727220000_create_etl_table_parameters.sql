-- Local mirror of Synapse config.ETL_Table_Parameters (upstream source→target ETL mappings).
-- Read-only in UI; refreshed via sync (delete-all).

CREATE TABLE IF NOT EXISTS etl_table_parameters (
  id BIGSERIAL PRIMARY KEY,
  etl_id INTEGER NOT NULL,
  source_schema TEXT NOT NULL,
  source_tablename TEXT NOT NULL,
  target_schema TEXT NOT NULL,
  target_tablename TEXT NOT NULL,
  schema_overwrite_flag TEXT,
  load_type TEXT,
  upsert_id TEXT,
  storeproc TEXT,
  sp_flag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Source etl_id is not unique upstream (duplicate ids for distinct mappings).
CREATE INDEX IF NOT EXISTS idx_etl_table_parameters_etl_id
  ON etl_table_parameters (etl_id);

CREATE INDEX IF NOT EXISTS idx_etl_table_parameters_source
  ON etl_table_parameters (source_schema, source_tablename);

CREATE INDEX IF NOT EXISTS idx_etl_table_parameters_target
  ON etl_table_parameters (target_schema, target_tablename);

COMMENT ON TABLE etl_table_parameters IS
  'Mirror of config.ETL_Table_Parameters — upstream ETL source/target mappings (visualization only)';
