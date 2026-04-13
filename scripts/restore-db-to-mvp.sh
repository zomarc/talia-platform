#!/usr/bin/env bash
# Restore a SQL backup into the MVP Azure host's talia-supabase-db container (replaces DB content; disruptive).
# Config: scripts/config/targets.env — MVP_SSH_*, MVP_APP_DIR
#
# Usage:
#   ./scripts/restore-db-to-mvp.sh [path/to/backup.sql.gz]
#   # default: newest backups/mvp/*.sql.gz
#
# Non-interactive:
#   RESTORE_MVP_CONFIRM=yes ./scripts/restore-db-to-mvp.sh backups/mvp/mvp-local-....sql.gz

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config/targets.env"
if [[ -f "${CONFIG_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CONFIG_FILE}"
fi

MVP_SSH_USER="${MVP_SSH_USER:-azureuser}"
MVP_SSH_HOST="${MVP_SSH_HOST:-}"
MVP_APP_DIR="${MVP_APP_DIR:-/home/${MVP_SSH_USER}/talia-docker}"
MVP_COMPOSE_ENV="${MVP_COMPOSE_ENV:-.env.staging}"
MVP_COMPOSE_FILE="${MVP_COMPOSE_FILE:-docker-compose.staging.yml}"

if [[ -z "${MVP_SSH_HOST}" ]]; then
  echo "Set MVP_SSH_HOST in scripts/config/targets.env (or export it)." >&2
  exit 1
fi

BACKUP="${1:-}"
if [[ -z "${BACKUP}" ]]; then
  BACKUP="$(ls -t "${ROOT_DIR}/backups/mvp"/*.sql.gz 2>/dev/null | head -1 || true)"
fi
if [[ -z "${BACKUP}" || ! -f "${BACKUP}" ]]; then
  echo "Usage: $0 <backup.sql.gz>" >&2
  echo "Or create backups/mvp/*.sql.gz via ./scripts/backup-local-db-for-mvp.sh" >&2
  exit 1
fi

BACKUP="$(cd "$(dirname "${BACKUP}")" && pwd)/$(basename "${BACKUP}")"

if [[ "${RESTORE_MVP_CONFIRM:-}" != "yes" ]]; then
  echo "This will REPLACE the postgres database on MVP (${MVP_SSH_USER}@${MVP_SSH_HOST})."
  echo "Backup file: ${BACKUP}"
  read -r -p "Type RESTORE_MVP_NOW to continue: " ans
  if [[ "$ans" != "RESTORE_MVP_NOW" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

REMOTE_GZ="/tmp/mvp-restore-$$.sql.gz"
MVP_SSH_TARGET="${MVP_SSH_USER}@${MVP_SSH_HOST}"

echo "Copying backup to ${MVP_SSH_TARGET}:${REMOTE_GZ} ..."
scp -o StrictHostKeyChecking=accept-new "${BACKUP}" "${MVP_SSH_TARGET}:${REMOTE_GZ}"

REMOTE_SCRIPT=$(cat <<EOS
set -euo pipefail
cd "${MVP_APP_DIR}"
if [[ ! -f "${MVP_COMPOSE_ENV}" ]]; then
  echo "Missing ${MVP_COMPOSE_ENV} in ${MVP_APP_DIR}" >&2
  exit 1
fi
echo "Stopping dependent containers (keeping Postgres)..."
sudo docker compose --env-file "${MVP_COMPOSE_ENV}" -f "${MVP_COMPOSE_FILE}" stop \
  graphql-server ui supabase-kong supabase-auth supabase-rest supabase-realtime \
  supabase-storage supabase-studio supabase-pg-meta supabase-imgproxy 2>/dev/null || true
echo "Restoring into talia-supabase-db (use mvp-core backups with pg_dump --clean; ON_ERROR_STOP off)..."
gunzip -c "${REMOTE_GZ}" | sudo docker exec -i talia-supabase-db psql -q -U postgres -d postgres --set ON_ERROR_STOP=off || true
echo "Starting full stack..."
sudo docker compose --env-file "${MVP_COMPOSE_ENV}" -f "${MVP_COMPOSE_FILE}" up -d
echo "Aligning Postgres role passwords with PostgREST (fixes authenticator vs .env / defaults after restore)..."
if [[ -f scripts/supabase/align-db-role-passwords.sh ]]; then
  sudo bash scripts/supabase/align-db-role-passwords.sh --from-running-postgrest
else
  echo "Warning: missing scripts/supabase/align-db-role-passwords.sh — run it on the host or PostgREST may fail auth." >&2
fi
echo "Persisting POSTGRES_PASSWORD into ${MVP_COMPOSE_ENV} (matches running PostgREST; do not commit real .env)..."
if [[ -f scripts/supabase/write-postgres-password-from-postgrest-to-env.sh ]]; then
  sudo bash scripts/supabase/write-postgres-password-from-postgrest-to-env.sh "${MVP_COMPOSE_ENV}"
else
  echo "Warning: missing scripts/supabase/write-postgres-password-from-postgrest-to-env.sh" >&2
fi
echo "Restarting PostgREST, Kong, and GraphQL (reload schema cache / upstreams after DDL restore)..."
sudo docker compose --env-file "${MVP_COMPOSE_ENV}" -f "${MVP_COMPOSE_FILE}" restart \
  supabase-rest supabase-kong graphql-server
rm -f "${REMOTE_GZ}"
echo "Done."
EOS
)

echo "Running remote restore..."
ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${MVP_SSH_TARGET}" bash <<EOF
${REMOTE_SCRIPT}
EOF

echo "Restore finished. Check UI: http://${MVP_SSH_HOST}:5173/"
