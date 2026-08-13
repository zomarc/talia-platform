-- Durable Talia user role (replaces email-heuristic-only roles in the UI).
-- Non-destructive: add column + backfill from known seed emails.

DO $$
BEGIN
  IF to_regclass('public.talia_users') IS NULL THEN
    RAISE NOTICE 'talia_users missing — skip role column (apply create_talia_users migration first)';
    RETURN;
  END IF;

  ALTER TABLE public.talia_users
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'USER';

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'talia_users_role_check'
  ) THEN
    ALTER TABLE public.talia_users
      ADD CONSTRAINT talia_users_role_check
      CHECK (upper(role) IN ('GUEST', 'USER', 'MANAGER', 'ADMIN', 'SUPER_USER', 'SUPERUSER'));
  END IF;

  CREATE INDEX IF NOT EXISTS idx_talia_users_role ON public.talia_users (role);

  UPDATE public.talia_users
  SET role = CASE lower(email)
    WHEN 'admin@talia.dev' THEN 'ADMIN'
    WHEN 'dev@talia.local' THEN 'ADMIN'
    WHEN 'russell@talia.local' THEN 'ADMIN'
    WHEN 'andy@talia.local' THEN 'MANAGER'
    WHEN 'analyst@talia.local' THEN 'USER'
    WHEN 'guest@talia.local' THEN 'GUEST'
    ELSE role
  END
  WHERE role = 'USER' OR role IS NULL;

  COMMENT ON COLUMN public.talia_users.role IS
    'Talia product role (GUEST|USER|MANAGER|ADMIN|SUPER_USER). Source of truth for access, focus list, and options.';
END $$;
