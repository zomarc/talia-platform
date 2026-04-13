#!/usr/bin/env bash
# Report largest tables and row counts (local Supabase Postgres).
# Default: postgresql://postgres:postgres@127.0.0.1:54322/postgres
# Override: export DATABASE_URL=... or PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
set -euo pipefail

export PGPASSWORD="${PGPASSWORD:-postgres}"
export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-54322}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-postgres}"

if [[ -n "${DATABASE_URL:-}" ]]; then
  CONN=("$DATABASE_URL")
else
  CONN=(-h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE")
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Install psql (e.g. brew install postgresql)." >&2
  exit 1
fi

echo "=== Top relations by total size (incl. indexes) ==="
psql "${CONN[@]}" -X -c "
SELECT n.nspname || '.' || c.relname AS relation,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total,
       pg_total_relation_size(c.oid) AS bytes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND c.relkind = 'r'
ORDER BY bytes DESC
LIMIT 25;
"

echo ""
echo "=== Row counts (Talia + heavy candidates) ==="
psql "${CONN[@]}" -X -c "
SELECT relname AS table,
       n_live_tup AS est_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN (
    'published_rates_changes','published_rates_current_state','reservation',
    'reservation_changes','master_sail','sail_by_cabin_occupancy',
    'inventory_status_by_day','demand_heatmap_data'
  )
ORDER BY n_live_tup DESC NULLS LAST;
"

echo ""
echo "Exact count for public.published_rates_changes (may take a minute):"
psql "${CONN[@]}" -X -Atc "SELECT COUNT(*) FROM public.published_rates_changes;" || true
