-- Scope MODEL / template data: organization-wide (global) vs per-user examples.
-- Global: admin/manager maintained; visible to all authenticated users for read.
-- User: created by a Talia user; visible to that user (+ admin/manager see all).

-- ---------------------------------------------------------------------------
-- inventory_item_profile_curve_point
-- ---------------------------------------------------------------------------
ALTER TABLE inventory_item_profile_curve_point
  ADD COLUMN IF NOT EXISTS profile_scope TEXT NOT NULL DEFAULT 'user';

ALTER TABLE inventory_item_profile_curve_point
  ADD COLUMN IF NOT EXISTS owner_key TEXT;

ALTER TABLE inventory_item_profile_curve_point
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_item_profile_curve_point_profile_scope_check'
  ) THEN
    ALTER TABLE inventory_item_profile_curve_point
      ADD CONSTRAINT inventory_item_profile_curve_point_profile_scope_check
      CHECK (profile_scope IN ('global', 'user'));
  END IF;
END $$;

COMMENT ON COLUMN inventory_item_profile_curve_point.profile_scope IS
  'global = org template (owner_key NULL); user = personal example tied to owner_key';
COMMENT ON COLUMN inventory_item_profile_curve_point.owner_key IS
  'Talia / auth subject id string for user-scoped series; NULL for global org profiles';

-- Existing MODEL rows: treat as organization templates so current behaviour is preserved.
UPDATE inventory_item_profile_curve_point
SET profile_scope = 'global',
    owner_key = NULL
WHERE series_kind = 'MODEL'
  AND profile_scope = 'user'
  AND owner_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_profile_point_scope_owner
  ON inventory_item_profile_curve_point (inventory_item_id, series_kind, model_key, profile_scope, owner_key);

-- ---------------------------------------------------------------------------
-- target_profiles (legacy JSON curves + listing)
-- ---------------------------------------------------------------------------
ALTER TABLE target_profiles
  ADD COLUMN IF NOT EXISTS profile_scope TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'target_profiles_profile_scope_check'
  ) THEN
    ALTER TABLE target_profiles
      ADD CONSTRAINT target_profiles_profile_scope_check
      CHECK (profile_scope IN ('global', 'user'));
  END IF;
END $$;

COMMENT ON COLUMN target_profiles.profile_scope IS
  'global = shared target template; user = personal example (see created_by)';

CREATE INDEX IF NOT EXISTS idx_target_profiles_profile_scope ON target_profiles(profile_scope);

-- Optional RLS: enable when using Supabase Auth from clients; service role bypasses.
-- ALTER TABLE inventory_item_profile_curve_point ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE target_profiles ENABLE ROW LEVEL SECURITY;
