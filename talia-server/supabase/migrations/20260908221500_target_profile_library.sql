-- Library / standard target profiles are not sailing assignments.
-- They live with inventory_item_id NULL and profile_scope = 'global'.
-- A sailing still has at most one active assignment.

ALTER TABLE inventory_target_profile
  ALTER COLUMN inventory_item_id DROP NOT NULL;

ALTER TABLE inventory_target_profile
  DROP CONSTRAINT IF EXISTS inventory_target_profile_inventory_item_id_name_perspective_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_target_profile_item_name
  ON inventory_target_profile (inventory_item_id, name, perspective)
  WHERE inventory_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_target_profile_library_name
  ON inventory_target_profile (lower(btrim(name)), perspective)
  WHERE inventory_item_id IS NULL;

DROP INDEX IF EXISTS idx_inventory_target_profile_one_active;
CREATE UNIQUE INDEX idx_inventory_target_profile_one_active
  ON inventory_target_profile (inventory_item_id)
  WHERE is_active = true AND inventory_item_id IS NOT NULL;

COMMENT ON COLUMN inventory_target_profile.inventory_item_id IS
  'Sailing assignment. NULL = reusable library / standard profile (profile_scope global).';

-- Promote existing General / Generic named sailing copies into the library.
DO $$
DECLARE
  src RECORD;
  new_id BIGINT;
BEGIN
  FOR src IN
    SELECT DISTINCT ON (lower(btrim(name)), perspective)
      id,
      btrim(name) AS name,
      perspective,
      description,
      metric,
      owner_key
    FROM inventory_target_profile
    WHERE inventory_item_id IS NOT NULL
      AND (
        btrim(name) ~* '^(general|generic)$'
        OR btrim(name) ~* '^(general|generic)[[:space:][:punct:]]'
      )
    ORDER BY lower(btrim(name)), perspective, updated_at DESC
  LOOP
    IF EXISTS (
      SELECT 1
      FROM inventory_target_profile
      WHERE inventory_item_id IS NULL
        AND lower(btrim(name)) = lower(src.name)
        AND perspective = src.perspective
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO inventory_target_profile (
      inventory_item_id,
      name,
      perspective,
      description,
      metric,
      profile_scope,
      owner_key,
      is_active
    ) VALUES (
      NULL,
      src.name,
      src.perspective,
      src.description,
      src.metric,
      'global',
      src.owner_key,
      false
    )
    RETURNING id INTO new_id;

    INSERT INTO inventory_target_profile_node (
      profile_id,
      dimension_level,
      dimension_key,
      parent_node_id,
      week_label,
      weeks_until_sailing,
      lf_pct,
      point_order,
      metadata
    )
    SELECT
      new_id,
      dimension_level,
      dimension_key,
      NULL,
      week_label,
      weeks_until_sailing,
      lf_pct,
      point_order,
      metadata
    FROM inventory_target_profile_node
    WHERE profile_id = src.id
    ORDER BY point_order, id;
  END LOOP;
END $$;
