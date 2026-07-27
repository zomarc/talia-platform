-- Local development seed.
--
-- Grants the standard Supabase API roles (anon / authenticated / service_role)
-- full DML access to everything in the public schema. On hosted Supabase these
-- privileges are configured automatically, but a fresh local `supabase start`
-- (with the current CLI/Postgres image) leaves migration-created tables without
-- SELECT/INSERT/UPDATE/DELETE for these roles, which surfaces in the app as
-- "permission denied for table ..." errors (e.g. supabaseConnectionStatus goes
-- offline). This seed runs after migrations on `supabase start` / `db reset`.
--
-- Seeds are local-only: they are NOT applied to remote projects by
-- `supabase db push`, so this does not affect staging/production.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Cover any objects created later in the same schema by the postgres role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
