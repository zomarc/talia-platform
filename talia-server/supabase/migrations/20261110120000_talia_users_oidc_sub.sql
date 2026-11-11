-- Persist Celestyal / Entra OIDC subject on talia_users (stable external id).

ALTER TABLE public.talia_users
  ADD COLUMN IF NOT EXISTS oidc_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_talia_users_oidc_sub
  ON public.talia_users (oidc_sub)
  WHERE oidc_sub IS NOT NULL;

COMMENT ON COLUMN public.talia_users.oidc_sub IS
  'OIDC subject (Entra sub). Set on first SSO login; used for stable lookup ahead of email.';
