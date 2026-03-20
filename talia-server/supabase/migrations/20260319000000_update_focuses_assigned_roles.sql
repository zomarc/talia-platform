-- Ensure all active focuses include 'USER' in assigned_roles
-- so that all role levels (USER, MANAGER, ADMIN) can see them.
-- The resolver uses role hierarchy: higher roles can see all focuses
-- assigned to lower roles.
UPDATE focuses
SET assigned_roles = ARRAY(
  SELECT DISTINCT unnest(
    CASE
      WHEN 'USER' = ANY(assigned_roles) THEN assigned_roles
      ELSE assigned_roles || ARRAY['USER']
    END
  )
)
WHERE is_active = true
  AND NOT ('USER' = ANY(assigned_roles));
