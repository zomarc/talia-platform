#!/bin/bash
#
# Staging database schema guard:
# - verifies required tables exist before deployment is considered healthy
# - applies targeted table-specific migrations if required tables are missing
#
# Usage:
#   ./scripts/staging-db-guard.sh
#   COMPOSE_FILE=docker-compose.staging.yml MIGRATIONS_DIR=/tmp/migrations REQUIRED_TABLES="inventory_item inventory_item_memo" ./scripts/staging-db-guard.sh
#
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-talia-server/supabase/migrations}"
DB_CONTAINER="${DB_CONTAINER:-talia-supabase-db}"
REQUIRED_TABLES="${REQUIRED_TABLES:-inventory_item inventory_item_memo talia_users}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "❌ Compose file not found: $COMPOSE_FILE"
  exit 1
fi

echo "🗄️  Schema guard: ensuring migration tracking table..."
docker compose -f "$COMPOSE_FILE" exec -T supabase-db \
  psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c "CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());" < /dev/null

table_exists() {
  local table_name="$1"
  docker compose -f "$COMPOSE_FILE" exec -T supabase-db \
    psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${table_name}');" < /dev/null | tr -d '[:space:]'
}

applied_migration() {
  local migration_name="$1"
  docker compose -f "$COMPOSE_FILE" exec -T supabase-db \
    psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1 FROM public.schema_migrations WHERE name='${migration_name}' LIMIT 1;" < /dev/null | tr -d '[:space:]'
}

record_migration() {
  local migration_name="$1"
  docker compose -f "$COMPOSE_FILE" exec -T supabase-db \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    -c "INSERT INTO public.schema_migrations(name) VALUES ('${migration_name}') ON CONFLICT (name) DO NOTHING;" < /dev/null
}

apply_migration_file() {
  local file="$1"
  local name
  name="$(basename "$file")"
  if [ "$(applied_migration "$name")" = "1" ]; then
    return 0
  fi

  echo "  ➜ Applying $name"
  docker cp "$file" "${DB_CONTAINER}:/tmp/${name}"
  docker compose -f "$COMPOSE_FILE" exec -T supabase-db \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "/tmp/${name}" < /dev/null
  record_migration "$name"
}

find_candidates_for_table() {
  local table_name="$1"
  case "$table_name" in
    inventory_item)
      ls -1 "$MIGRATIONS_DIR"/20260302000000_create_inventoy_item_and_memos.sql "$MIGRATIONS_DIR"/20260302000001_rename_inventoy_item_to_inventory_item.sql 2>/dev/null | sort || true
      ;;
    inventory_item_memo)
      ls -1 "$MIGRATIONS_DIR"/20260302000000_create_inventoy_item_and_memos.sql 2>/dev/null | sort || true
      ;;
    talia_users)
      ls -1 "$MIGRATIONS_DIR"/20260327000000_create_talia_users.sql 2>/dev/null | sort || true
      ;;
    *)
      rg --files-with-matches "$table_name" "$MIGRATIONS_DIR" --glob "*.sql" | sort || true
      ;;
  esac
}

echo "🔎 Verifying required tables..."
missing=()
for table in $REQUIRED_TABLES; do
  if [ "$(table_exists "$table")" != "t" ]; then
    missing+=("$table")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "❌ Required tables missing (${missing[*]}) and migration directory not found: $MIGRATIONS_DIR"
    exit 1
  fi

  echo "🧩 Missing required tables detected: ${missing[*]}"
  echo "🗂️  Applying targeted migrations from $MIGRATIONS_DIR"

  declare -A seen_files=()
  for table in "${missing[@]}"; do
    while IFS= read -r candidate; do
      [ -z "$candidate" ] && continue
      seen_files["$candidate"]=1
    done < <(find_candidates_for_table "$table")
  done

  if [ "${#seen_files[@]}" -eq 0 ]; then
    echo "❌ No candidate migrations found for missing required tables: ${missing[*]}"
    exit 1
  fi

  while IFS= read -r file; do
    [ -z "$file" ] && continue
    apply_migration_file "$file"
  done < <(printf '%s\n' "${!seen_files[@]}" | sort)
fi

echo "🔎 Re-checking required tables..."
missing_after=()
for table in $REQUIRED_TABLES; do
  if [ "$(table_exists "$table")" != "t" ]; then
    missing_after+=("$table")
  fi
done

if [ "${#missing_after[@]}" -gt 0 ]; then
  echo "❌ Required tables still missing after remediation: ${missing_after[*]}"
  exit 1
fi

echo "✅ Schema guard passed"
