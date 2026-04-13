#!/bin/bash
#
# Local Postgres backup (plain SQL, gzip). Uses pg_dump so we can omit bloated tables' data.
#
# Default: excludes DATA for public.published_rates_changes (schema kept; sync audit log must not dominate backups).
# Failsafe: aborts if any checked table's total on-disk size exceeds BACKUP_MAX_RELATION_BYTES
#           (tables listed in BACKUP_EXCLUDE_TABLE_DATA are skipped for the guard — their data is not dumped).
#
# Environment (optional):
#   BACKUP_EXCLUDE_TABLE_DATA   space-separated schema.table (default: public.published_rates_changes)
#   BACKUP_MAX_RELATION_BYTES   default 104857600 (100 MiB per table)
#   BACKUP_GUARD_SCHEMAS        default "public talia_config"
#   BACKUP_SKIP_SIZE_GUARD=1    disable the oversize check
#   BACKUP_PGDOCKER_CONTAINER   if host has no pg_dump/psql, use this running DB container (default: supabase_db_talia-server)
#   BACKUP_COMPAT_PG15=1        strip PG17+ dump preamble (transaction_timeout, \\restrict) for restores to Postgres 15 (e.g. MVP stack)
#   BACKUP_PG_DUMP_CLEAN=1      add --clean --if-exists (DROP before CREATE; use when reloading into an existing DB, e.g. MVP restore)
#   PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
#
set -euo pipefail

BACKUP_DIR="$(dirname "$0")/../backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE_COMPRESSED="${BACKUP_DIR}/supabase_backup_${TIMESTAMP}.sql.gz"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

export PGPASSWORD="${PGPASSWORD:-postgres}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-54322}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"

BACKUP_EXCLUDE_TABLE_DATA="${BACKUP_EXCLUDE_TABLE_DATA:-public.published_rates_changes}"
BACKUP_MAX_RELATION_BYTES="${BACKUP_MAX_RELATION_BYTES:-104857600}"
BACKUP_GUARD_SCHEMAS="${BACKUP_GUARD_SCHEMAS:-public talia_config}"
BACKUP_SKIP_SIZE_GUARD="${BACKUP_SKIP_SIZE_GUARD:-0}"

echo -e "${GREEN}=== Supabase / local Postgres backup ===${NC}"
echo ""

mkdir -p "$BACKUP_DIR"

DOCKER_DB="${BACKUP_PGDOCKER_CONTAINER:-supabase_db_talia-server}"
USE_DOCKER_DB=0
if command -v pg_dump >/dev/null 2>&1 && command -v psql >/dev/null 2>&1; then
  USE_DOCKER_DB=0
elif docker info >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qxF "$DOCKER_DB"; then
  echo -e "${YELLOW}Host pg_dump/psql not found; using Postgres tools in Docker: ${DOCKER_DB}${NC}"
  USE_DOCKER_DB=1
else
  echo -e "${RED}Error: pg_dump and psql are required (e.g. brew install postgresql), or start local Supabase so container ${DOCKER_DB} is running.${NC}"
  exit 1
fi

if [[ "$USE_DOCKER_DB" -eq 1 ]]; then
  psql_exec() {
    docker exec -e PGPASSWORD="$PGPASSWORD" "$DOCKER_DB" \
      psql -h localhost -p 5432 -U "$PGUSER" -d "$PGDATABASE" "$@"
  }
  pg_dump_exec() {
    docker exec -e PGPASSWORD="$PGPASSWORD" "$DOCKER_DB" \
      pg_dump -h localhost -p 5432 -U "$PGUSER" -d "$PGDATABASE" "$@"
  }
  if ! psql_exec -Atq -c "select 1" >/dev/null 2>&1; then
    echo -e "${RED}Error: cannot connect to Postgres via ${DOCKER_DB}${NC}"
    exit 1
  fi
else
  psql_exec() { psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" "$@"; }
  pg_dump_exec() { pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" "$@"; }
  if command -v supabase >/dev/null 2>&1; then
    if ! supabase status &>/dev/null; then
      echo -e "${YELLOW}Warning: Supabase CLI reports stack not running.${NC}"
      echo "Start with: cd \"$(dirname "$0")/..\" && supabase start"
      exit 1
    fi
  else
    if ! command -v pg_isready >/dev/null 2>&1 || ! pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" &>/dev/null; then
      echo -e "${RED}Error: Postgres not reachable at ${PGHOST}:${PGPORT}${NC}"
      exit 1
    fi
  fi
fi

is_excluded_table() {
  local fq="$1"
  local x
  for x in $BACKUP_EXCLUDE_TABLE_DATA; do
    [[ "$x" == "$fq" ]] && return 0
  done
  return 1
}

build_schema_in_list() {
  local parts=() s q
  for s in $BACKUP_GUARD_SCHEMAS; do
    q="${s//\'/\'\'}"
    parts+=("'${q}'")
  done
  local IFS=,
  echo "${parts[*]}"
}

if [[ "$BACKUP_SKIP_SIZE_GUARD" != "1" ]]; then
  echo -e "${GREEN}Size guard: max ${BACKUP_MAX_RELATION_BYTES} bytes per table in [${BACKUP_GUARD_SCHEMAS}]${NC}"
  echo -e "${YELLOW}(data-excluded tables are reported but do not fail the guard)${NC}"
  SCHEMA_IN=$(build_schema_in_list)
  oversize=0
  while IFS='|' read -r fq sz; do
    [[ -z "${fq:-}" ]] && continue
    if is_excluded_table "$fq"; then
      echo -e "  ${YELLOW}allowed large table (data excluded from dump): ${fq} (${sz} bytes)${NC}"
      continue
    fi
    echo -e "${RED}BLOCKED: ${fq} is ${sz} bytes (limit ${BACKUP_MAX_RELATION_BYTES}).${NC}"
    echo -e "${RED}  Fix the app/sync bug, truncate/archive, add to BACKUP_EXCLUDE_TABLE_DATA, or set BACKUP_SKIP_SIZE_GUARD=1.${NC}"
    oversize=1
  done < <(psql_exec -Atq -c "
SELECT n.nspname || '.' || c.relname,
       pg_total_relation_size(c.oid)::bigint
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname IN (${SCHEMA_IN})
  AND pg_total_relation_size(c.oid) > ${BACKUP_MAX_RELATION_BYTES}
ORDER BY pg_total_relation_size(c.oid) DESC;
")
  if [[ "$oversize" -ne 0 ]]; then
    echo -e "${RED}Backup aborted (size guard).${NC}"
    exit 1
  fi
  echo -e "${GREEN}  Size guard OK.${NC}"
else
  echo -e "${YELLOW}Size guard skipped (BACKUP_SKIP_SIZE_GUARD=1).${NC}"
fi

echo ""
echo -e "${GREEN}Excluding table data:${NC} ${BACKUP_EXCLUDE_TABLE_DATA}"
echo -e "${GREEN}Writing:${NC} ${BACKUP_FILE_COMPRESSED}"

dump_args=(--no-owner --no-acl)
if [[ "${BACKUP_PG_DUMP_CLEAN:-}" == "1" ]]; then
  dump_args+=(--clean --if-exists)
  echo -e "${YELLOW}Dump includes DROP ... IF EXISTS before objects (BACKUP_PG_DUMP_CLEAN).${NC}"
fi
for t in $BACKUP_EXCLUDE_TABLE_DATA; do
  [[ -n "$t" ]] || continue
  dump_args+=(--exclude-table-data="$t")
done

backup_compat_pg15_filter() {
  sed -e '/^SET transaction_timeout/d' -e '/^\\restrict/d' -e '/^\\unrestrict/d'
}

if [[ "${BACKUP_COMPAT_PG15:-}" == "1" ]]; then
  echo -e "${YELLOW}PG15 compatibility: stripping PG17+-only dump lines before compress.${NC}"
  if ! pg_dump_exec "${dump_args[@]}" | backup_compat_pg15_filter | gzip -1 >"$BACKUP_FILE_COMPRESSED"; then
    echo -e "${RED}✗ pg_dump failed.${NC}"
    rm -f "$BACKUP_FILE_COMPRESSED"
    exit 1
  fi
else
  if ! pg_dump_exec "${dump_args[@]}" | gzip -1 >"$BACKUP_FILE_COMPRESSED"; then
    echo -e "${RED}✗ pg_dump failed.${NC}"
    rm -f "$BACKUP_FILE_COMPRESSED"
    exit 1
  fi
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE_COMPRESSED}" | cut -f1)

echo ""
echo -e "${GREEN}✓ Backup completed successfully!${NC}"
echo "  File: ${BACKUP_FILE_COMPRESSED}"
echo "  Size: ${BACKUP_SIZE}"
echo ""
echo -e "${YELLOW}Note: Schema is full; excluded tables have no row data in this dump.${NC}"
echo ""

echo -e "${YELLOW}Recent backups:${NC}"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -5 | awk '{print "  " $9 " (" $5 ")"}'
