-- Create Talia users mapping table used by focus assignment UX.
-- Non-destructive: create-if-missing and upsert-style seed inserts.

CREATE TABLE IF NOT EXISTS public.talia_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talia_user_id BIGINT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_talia_users_email ON public.talia_users (email);
CREATE INDEX IF NOT EXISTS idx_talia_users_last_login_at ON public.talia_users (last_login_at DESC);

CREATE OR REPLACE FUNCTION public.update_talia_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_talia_users_updated_at ON public.talia_users;
CREATE TRIGGER trigger_update_talia_users_updated_at
  BEFORE UPDATE ON public.talia_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_talia_users_updated_at();

-- Seed fallback/dev users so focus assignment works in environments
-- where auth.users is not yet provisioned.
INSERT INTO public.talia_users (talia_user_id, email)
VALUES
  (1000, 'admin@talia.dev'),
  (1001, 'russell@talia.local'),
  (1002, 'andy@talia.local'),
  (1003, 'analyst@talia.local'),
  (1004, 'guest@talia.local')
ON CONFLICT (email) DO NOTHING;
