-- Restore GoTrue access to auth.* after restores / ownership drift.
-- Symptom: OAuth callback returns
--   error=server_error&error_description=permission denied for table identities (SQLSTATE 42501)
-- Cause: auth tables owned by postgres with no grants to supabase_auth_admin.
-- Run as postgres (grants/ownership) then supabase_admin (BYPASSRLS).

GRANT USAGE, CREATE ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA auth TO supabase_auth_admin;

DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS obj, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'auth'
      AND c.relkind IN ('r', 'p', 'v', 'm')
      AND c.relowner <> (SELECT oid FROM pg_roles WHERE rolname = 'supabase_auth_admin')
  LOOP
    IF r.relkind IN ('v', 'm') THEN
      EXECUTE format('ALTER VIEW %s OWNER TO supabase_auth_admin', r.obj);
    ELSE
      EXECUTE format('ALTER TABLE %s OWNER TO supabase_auth_admin', r.obj);
    END IF;
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS obj
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth'
      AND p.proowner <> (SELECT oid FROM pg_roles WHERE rolname = 'supabase_auth_admin')
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO supabase_auth_admin', r.obj);
  END LOOP;
END
$do$;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth
  GRANT ALL ON TABLES TO postgres, dashboard_user;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth
  GRANT ALL ON SEQUENCES TO postgres, dashboard_user;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth
  GRANT ALL ON FUNCTIONS TO postgres, dashboard_user;

-- Must be run as a superuser (supabase_admin), not postgres:
--   ALTER ROLE supabase_auth_admin BYPASSRLS;
