-- Per-user focus stars, last-used, and optional layout overrides.
-- user_id is the x-user-id header (text), not an auth.users uuid.

CREATE TABLE IF NOT EXISTS public.user_focus_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  focus_id UUID NOT NULL REFERENCES public.focuses(id) ON DELETE CASCADE,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  last_used TIMESTAMPTZ,
  custom_layout JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, focus_id)
);

CREATE INDEX IF NOT EXISTS idx_user_focus_preferences_user
  ON public.user_focus_preferences (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_focus_preferences TO anon, authenticated, service_role;

COMMENT ON TABLE public.user_focus_preferences IS
  'User stars and last-used timestamps for focuses.';

NOTIFY pgrst, 'reload schema';
