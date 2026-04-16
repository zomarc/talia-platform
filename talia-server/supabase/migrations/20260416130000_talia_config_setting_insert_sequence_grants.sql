-- Fixes: permission denied for sequence setting_id_seq (and INSERT into talia_config.setting)
-- when upserting appearance / theme registry rows via public.config_setting on some stacks.
-- 20260126000002 granted SELECT,UPDATE only on talia_config.setting to authenticated; inserts
-- from the view need INSERT on the base table + USAGE on the SERIAL sequence.

GRANT INSERT, DELETE ON talia_config.setting TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE talia_config.setting_id_seq TO authenticated;

-- Ensure new sequences/tables in this schema keep working for service_role deployments.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA talia_config TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA talia_config TO service_role;
