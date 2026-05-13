-- Split Seaware GraphQL endpoints into explicit read/write data sources.
-- Read should typically point to business UAT (fresher).
-- Write should point to dedicated Talia sandbox to protect UAT/live operations.

INSERT INTO talia_config.data_source (
  source_name,
  display_name,
  source_type,
  description,
  connection_config,
  is_active
)
VALUES
  (
    'celestyal_b2b_api_read',
    'Celestyal B2B GraphQL (READ)',
    'api',
    'Direct source for read/query availability operations',
    '{"endpoint":"https://uat.b2b.celestyal.com:3000/graphql","mode":"read"}'::jsonb,
    true
  ),
  (
    'celestyal_b2b_api_write',
    'Celestyal B2B GraphQL (WRITE)',
    'api',
    'Direct source for write/mutation operations (dedicated safe instance)',
    '{"endpoint":"https://thaliatest.b2b.celestyal.com:3000/graphql","mode":"write","allowUatWrite":false}'::jsonb,
    true
  )
ON CONFLICT (source_name) DO NOTHING;

-- If legacy single-source exists, preserve its endpoint as the read endpoint
-- only when read endpoint is missing/blank.
UPDATE talia_config.data_source read_ds
SET connection_config = jsonb_set(
  COALESCE(read_ds.connection_config, '{}'::jsonb),
  '{endpoint}',
  to_jsonb(legacy.connection_config ->> 'endpoint'),
  true
)
FROM talia_config.data_source legacy
WHERE read_ds.source_name = 'celestyal_b2b_api_read'
  AND legacy.source_name = 'celestyal_b2b_api'
  AND COALESCE(trim(read_ds.connection_config ->> 'endpoint'), '') = ''
  AND COALESCE(trim(legacy.connection_config ->> 'endpoint'), '') <> '';
