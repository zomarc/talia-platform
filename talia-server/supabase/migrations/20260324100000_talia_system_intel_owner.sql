-- Canonical REAL/TARGET/BUDGET/MODEL curve rows are owned by the Talia system identity ('talia'),
-- not individual users. Humans edit only with MANAGER+ (enforced in API). last_edited_by stores audit.

ALTER TABLE inventory_item_profile_curve_point
  ADD COLUMN IF NOT EXISTS last_edited_by TEXT;

COMMENT ON COLUMN inventory_item_profile_curve_point.last_edited_by IS
  'Human editor id/email for audit; intelligence remains owned by system (owner_key = talia).';

-- Allow profile_scope = system
ALTER TABLE inventory_item_profile_curve_point
  DROP CONSTRAINT IF EXISTS inventory_item_profile_curve_point_profile_scope_check;

ALTER TABLE inventory_item_profile_curve_point
  ADD CONSTRAINT inventory_item_profile_curve_point_profile_scope_check
  CHECK (profile_scope IN ('system', 'global', 'user'));

COMMENT ON COLUMN inventory_item_profile_curve_point.profile_scope IS
  'system = Talia canonical intelligence (default); global/user legacy values may exist until backfill';

COMMENT ON COLUMN inventory_item_profile_curve_point.owner_key IS
  'Logical owner; canonical rows use talia (system super-user), not an end-user id';

-- Backfill: all curve points belong to Talia system
UPDATE inventory_item_profile_curve_point
SET profile_scope = 'system',
    owner_key = 'talia'
WHERE profile_scope IS DISTINCT FROM 'system'
   OR owner_key IS DISTINCT FROM 'talia'
   OR owner_key IS NULL;

-- target_profiles: system scope for org intelligence
ALTER TABLE target_profiles
  DROP CONSTRAINT IF EXISTS target_profiles_profile_scope_check;

ALTER TABLE target_profiles
  ADD CONSTRAINT target_profiles_profile_scope_check
  CHECK (profile_scope IN ('system', 'global', 'user'));

UPDATE target_profiles
SET profile_scope = 'system',
    created_by = NULL
WHERE profile_scope IS DISTINCT FROM 'system';

COMMENT ON COLUMN target_profiles.profile_scope IS
  'system = Talia-managed templates; created_by NULL means system-owned';

ALTER TABLE target_profiles
  ADD COLUMN IF NOT EXISTS last_edited_by TEXT;

COMMENT ON COLUMN target_profiles.last_edited_by IS
  'Human editor id/email for audit when a manager updates Talia-owned profiles';
