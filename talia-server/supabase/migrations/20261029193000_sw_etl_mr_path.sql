-- Historic MR path. One hold per sailed group: the last header change on or before departure.
-- n_of_delegate_guests on the header is optional. Null means the path still uses the final group count.

ALTER TABLE sw_etl_group_header
  ADD COLUMN IF NOT EXISTS n_of_delegate_guests INTEGER;

COMMENT ON COLUMN sw_etl_group_header.n_of_delegate_guests IS
  'Named guests on this header version, when the warehouse sends them. Null keeps the historic path in hindsight.';

CREATE OR REPLACE FUNCTION sw_etl_mr_path_holds()
RETURNS TABLE (
  group_id bigint,
  ship_code text,
  sail_date_from date,
  sail_date_to date,
  final_named integer,
  change_days integer,
  hold_date date,
  hold_status text,
  hold_requested integer,
  hold_probability numeric,
  hold_manual boolean,
  hold_named integer
)
LANGUAGE sql
STABLE
AS $$
  WITH feed AS (
    SELECT MAX(changed_date)::date AS through
    FROM sw_etl_group
  ),
  days AS (
    SELECT DISTINCT ON (h.group_id, h.changed_date::date)
      h.group_id,
      h.changed_date::date AS changed_on,
      NULLIF(BTRIM(h.group_status), '') AS group_status,
      h.n_of_guests,
      h.probability,
      COALESCE(h.is_prob_manual, false) AS is_prob_manual,
      h.n_of_delegate_guests AS named_guests
    FROM sw_etl_group_header h
    ORDER BY h.group_id, h.changed_date::date, h.changed_date DESC
  ),
  sailed AS (
    SELECT
      g.group_id,
      NULLIF(BTRIM(s.ship_code), '') AS ship_code,
      g.sail_date_from,
      g.sail_date_to,
      g.n_of_delegate_guests AS final_named,
      NULLIF(BTRIM(g.group_status), '') AS current_status,
      g.n_of_guests AS current_requested,
      g.probability AS current_probability,
      COALESCE(g.is_prob_manual, false) AS current_manual,
      g.changed_date::date AS current_changed
    FROM sw_etl_group g
    LEFT JOIN sw_etl_group_ship s ON s.group_id = g.group_id
    CROSS JOIN feed f
    WHERE g.sail_date_from IS NOT NULL
      AND g.sail_date_from <= f.through
  ),
  pre AS (
    SELECT d.*
    FROM days d
    JOIN sailed g ON g.group_id = d.group_id AND d.changed_on <= g.sail_date_from
  ),
  counts AS (
    SELECT pre.group_id, COUNT(*)::int AS change_days
    FROM pre
    GROUP BY pre.group_id
  ),
  last_hold AS (
    SELECT DISTINCT ON (pre.group_id)
      pre.group_id,
      pre.changed_on,
      pre.group_status,
      pre.n_of_guests,
      pre.probability,
      pre.is_prob_manual,
      pre.named_guests
    FROM pre
    ORDER BY pre.group_id, pre.changed_on DESC
  )
  SELECT
    g.group_id,
    g.ship_code,
    g.sail_date_from,
    g.sail_date_to,
    g.final_named,
    COALESCE(c.change_days, 0)::int AS change_days,
    COALESCE(l.changed_on, g.current_changed) AS hold_date,
    COALESCE(l.group_status, g.current_status) AS hold_status,
    COALESCE(l.n_of_guests, g.current_requested) AS hold_requested,
    COALESCE(l.probability, g.current_probability) AS hold_probability,
    COALESCE(l.is_prob_manual, g.current_manual) AS hold_manual,
    l.named_guests AS hold_named
  FROM sailed g
  LEFT JOIN counts c ON c.group_id = g.group_id
  LEFT JOIN last_hold l ON l.group_id = g.group_id
  ORDER BY g.group_id;
$$;

CREATE OR REPLACE FUNCTION sw_etl_mr_path_days(p_group_id bigint)
RETURNS TABLE (
  changed_on date,
  group_status text,
  n_of_guests integer,
  probability numeric,
  is_prob_manual boolean,
  named_guests integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (h.changed_date::date)
    h.changed_date::date AS changed_on,
    NULLIF(BTRIM(h.group_status), ''),
    h.n_of_guests,
    h.probability,
    COALESCE(h.is_prob_manual, false),
    h.n_of_delegate_guests
  FROM sw_etl_group_header h
  WHERE h.group_id = p_group_id
  ORDER BY h.changed_date::date, h.changed_date DESC;
$$;

GRANT EXECUTE ON FUNCTION sw_etl_mr_path_holds() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sw_etl_mr_path_days(bigint) TO anon, authenticated, service_role;
