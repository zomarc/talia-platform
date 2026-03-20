-- Focus assignment model update:
--   STANDARD focuses: visible to all roles (assigned_roles ignored, everyone sees them)
--   ROLE focuses:     visible to users whose role is in assigned_roles (or higher via hierarchy)
--   USER focuses:     visible only to the assigned user (assigned_user_id)
--   TEMPLATE/SHARED:  visible to all roles (like STANDARD)

-- Add assigned_user_id for user-specific focuses
ALTER TABLE focuses ADD COLUMN IF NOT EXISTS assigned_user_id TEXT;

-- Update all existing focuses to be STANDARD type visible to all roles
UPDATE focuses
SET type = 'standard',
    assigned_roles = ARRAY['ADMIN', 'MANAGER', 'USER', 'GUEST']
WHERE is_active = true;

-- Index for user-assigned focus lookups
CREATE INDEX IF NOT EXISTS idx_focuses_assigned_user
  ON focuses(assigned_user_id) WHERE assigned_user_id IS NOT NULL;
