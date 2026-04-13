#!/usr/bin/env bash
# Sensible local dump for MVP: full schema; row data omitted for huge tables so the file stays small.
#
# - Always excludes DATA for public.published_rates_changes (sync audit log).
# - Auto-excludes DATA for any table in public or talia_config over BACKUP_MAX_RELATION_BYTES
#   (default 100 MiB on-disk), same threshold as talia-server/scripts/backup-db.sh size guard.
# - Merges BACKUP_EXCLUDE_TABLE_DATA if you preset it (extra tables), unless
#   BACKUP_SKIP_AUTO_EXCLUDE_LARGE=1 (then only your list is used).
#
# Output: talia-server/backups/*.sql.gz plus backups/mvp/${BACKUP_MVP_FILENAME_PREFIX}-*.sql.gz
#
# Override: BACKUP_MAX_RELATION_BYTES=... BACKUP_EXCLUDE_TABLE_DATA="public.foo" ./scripts/backup-core-for-mvp.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
DEST_DIR="${ROOT_DIR}/backups/mvp"
PREFIX="${BACKUP_MVP_FILENAME_PREFIX:-mvp-core}"
mkdir -p "${DEST_DIR}"

export PGPASSWORD="${PGPASSWORD:-postgres}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"
DOCKER_DB="${BACKUP_PGDOCKER_CONTAINER:-supabase_db_talia-server}"
MAX="${BACKUP_MAX_RELATION_BYTES:-104857600}"
[[ "$MAX" =~ ^[0-9]+$ ]] || MAX=104857600

run_psql_at() {
  local sql=$1
  if docker info >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qxF "$DOCKER_DB"; then
    docker exec -e PGPASSWORD="$PGPASSWORD" "$DOCKER_DB" \
      psql -h localhost -p 5432 -U "$PGUSER" -d "$PGDATABASE" -Atq -c "$sql"
    return
  fi
  if command -v psql >/dev/null 2>&1; then
    psql -h "${PGHOST:-127.0.0.1}" -p "${PGPORT:-54322}" -U "$PGUSER" -d "$PGDATABASE" -Atq -c "$sql"
    return
  fi
  echo "backup-core-for-mvp: need Docker DB container ${DOCKER_DB} or psql (brew install postgresql)." >&2
  exit 1
}

if [[ "${BACKUP_SKIP_AUTO_EXCLUDE_LARGE:-0}" == "1" ]]; then
  export BACKUP_EXCLUDE_TABLE_DATA="${BACKUP_EXCLUDE_TABLE_DATA:-public.published_rates_changes}"
  echo "Auto large-table detection skipped; BACKUP_EXCLUDE_TABLE_DATA=${BACKUP_EXCLUDE_TABLE_DATA}" >&2
else
  large_sql="
SELECT n.nspname || '.' || c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname IN ('public', 'talia_config')
  AND pg_total_relation_size(c.oid) > ${MAX}
ORDER BY pg_total_relation_size(c.oid) DESC;
"
  _tmp="$(mktemp)"
  echo "public.published_rates_changes" >>"$_tmp"
  run_psql_at "$large_sql" | sed '/^$/d' >>"$_tmp"
  if [[ -n "${BACKUP_EXCLUDE_TABLE_DATA:-}" ]]; then
    for w in ${BACKUP_EXCLUDE_TABLE_DATA}; do
      echo "$w"
    done >>"$_tmp"
  fi
  _merged="$(sort -u "$_tmp")"
  rm -f "$_tmp"
  export BACKUP_EXCLUDE_TABLE_DATA
  BACKUP_EXCLUDE_TABLE_DATA=$(echo "$_merged" | xargs echo)
  export BACKUP_EXCLUDE_TABLE_DATA
  echo "Excluding row data for (schema still dumped):" >&2
  echo "$_merged" | sed 's/^/  /' >&2
fi

# MVP Docker image is Postgres 15.x; local Supabase is often PG17 — strip incompatible preamble.
export BACKUP_COMPAT_PG15="${BACKUP_COMPAT_PG15:-1}"
# MVP restore reloads into an existing Supabase DB without DROP DATABASE (permission-safe).
export BACKUP_PG_DUMP_CLEAN="${BACKUP_PG_DUMP_CLEAN:-1}"

(cd "${ROOT_DIR}/talia-server" && ./scripts/backup-db.sh)

latest="$(ls -t "${ROOT_DIR}/talia-server/backups"/*.sql.gz 2>/dev/null | head -1)"
if [[ -z "${latest}" ]]; then
  echo "No backup produced under talia-server/backups" >&2
  exit 1
fi

out="${DEST_DIR}/${PREFIX}-${TS}.sql.gz"
cp -f "${latest}" "${out}"
echo "MVP copy: ${out}"
ls -lh "${out}"
