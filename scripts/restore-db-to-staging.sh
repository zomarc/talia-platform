#!/usr/bin/env bash
# Restore a SQL backup into the LAN staging host's talia-supabase-db (replaces DB; disruptive).
# Config: scripts/config/targets.env — STAGING_SSH_*, STAGING_APP_DIR
#
# Usage:
#   ./scripts/restore-db-to-staging.sh /path/to/backup.sql.gz
#   RESTORE_STAGING_CONFIRM=yes ./scripts/restore-db-to-staging.sh /path/to/backup.sql.gz
#
# Pull newest backup from MVP, then restore on staging (copies via this machine):
#   RESTORE_STAGING_CONFIRM=yes ./scripts/restore-db-to-staging.sh --from-mvp
#
# Non-interactive requires RESTORE_STAGING_CONFIRM=yes

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config/targets.env"
if [[ -f "${CONFIG_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CONFIG_FILE}"
fi

STAGING_SSH_USER="${STAGING_SSH_USER:-zomarc}"
STAGING_SSH_HOST="${STAGING_SSH_HOST:-}"
STAGING_APP_DIR="${STAGING_APP_DIR:-/home/${STAGING_SSH_USER}/talia-docker}"
STAGING_COMPOSE_ENV="${STAGING_COMPOSE_ENV:-.env.staging}"
STAGING_COMPOSE_FILE="${STAGING_COMPOSE_FILE:-docker-compose.staging.yml}"

MVP_SSH_USER="${MVP_SSH_USER:-azureuser}"
MVP_SSH_HOST="${MVP_SSH_HOST:-}"
MVP_APP_DIR="${MVP_APP_DIR:-/home/${MVP_SSH_USER}/talia-docker}"

if [[ -z "${STAGING_SSH_HOST}" ]]; then
  echo "Set STAGING_SSH_HOST in scripts/config/targets.env (or export it)." >&2
  exit 1
fi

FROM_MVP=false
BACKUP="${1:-}"
if [[ "${BACKUP}" == "--from-mvp" ]]; then
  FROM_MVP=true
  BACKUP=""
fi

if [[ "${FROM_MVP}" == true ]]; then
  if [[ -z "${MVP_SSH_HOST}" ]]; then
    echo "Set MVP_SSH_HOST for --from-mvp (scripts/config/targets.env)." >&2
    exit 1
  fi
  TMP_LOCAL="${TMPDIR:-/tmp}/talia-staging-restore-$$.sql.gz"
  MVP_TARGET="${MVP_SSH_USER}@${MVP_SSH_HOST}"
  REMOTE_PATH="$(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${MVP_TARGET}" \
    "ls -t ${MVP_APP_DIR}/talia-server/backups/*.sql.gz 2>/dev/null | head -1 || ls -t ${MVP_APP_DIR}/*.sql.gz 2>/dev/null | head -1" || true)"
  if [[ -z "${REMOTE_PATH}" ]]; then
    echo "No *.sql.gz found on MVP under ${MVP_APP_DIR}." >&2
    exit 1
  fi
  echo "Copying from MVP: ${MVP_TARGET}:${REMOTE_PATH} -> ${TMP_LOCAL}"
  scp -o StrictHostKeyChecking=accept-new "${MVP_TARGET}:${REMOTE_PATH}" "${TMP_LOCAL}"
  BACKUP="${TMP_LOCAL}"
  trap 'rm -f "${TMP_LOCAL}"' EXIT
fi

if [[ -z "${BACKUP}" || ! -f "${BACKUP}" ]]; then
  echo "Usage: $0 <backup.sql.gz>" >&2
  echo "   or: $0 --from-mvp   (newest .sql.gz on MVP → staging)" >&2
  exit 1
fi

BACKUP="$(cd "$(dirname "${BACKUP}")" && pwd)/$(basename "${BACKUP}")"

if [[ "${RESTORE_STAGING_CONFIRM:-}" != "yes" ]]; then
  echo "This will REPLACE the postgres database on STAGING (${STAGING_SSH_USER}@${STAGING_SSH_HOST})."
  echo "Backup file: ${BACKUP}"
  read -r -p "Type RESTORE_STAGING_NOW to continue: " ans
  if [[ "$ans" != "RESTORE_STAGING_NOW" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

REMOTE_GZ="/tmp/staging-restore-$$.sql.gz"
STAGING_SSH_TARGET="${STAGING_SSH_USER}@${STAGING_SSH_HOST}"

echo "Copying backup to ${STAGING_SSH_TARGET}:${REMOTE_GZ} ..."
scp -o StrictHostKeyChecking=accept-new "${BACKUP}" "${STAGING_SSH_TARGET}:${REMOTE_GZ}"

REMOTE_SCRIPT=$(cat <<EOS
set -euo pipefail
cd "${STAGING_APP_DIR}"
if [[ ! -f "${STAGING_COMPOSE_ENV}" ]]; then
  echo "Missing ${STAGING_COMPOSE_ENV} in ${STAGING_APP_DIR}" >&2
  exit 1
fi
echo "Stopping dependent containers (keeping Postgres)..."
sudo docker compose --env-file "${STAGING_COMPOSE_ENV}" -f "${STAGING_COMPOSE_FILE}" stop \\
  graphql-server ui supabase-kong supabase-auth supabase-rest supabase-realtime \\
  supabase-storage supabase-studio supabase-pg-meta supabase-imgproxy 2>/dev/null || true
echo "Restoring into talia-supabase-db (pg_dump --clean style; ON_ERROR_STOP off)..."
gunzip -c "${REMOTE_GZ}" | sudo docker exec -i talia-supabase-db psql -q -U postgres -d postgres --set ON_ERROR_STOP=off || true
echo "Starting full stack..."
sudo docker compose --env-file "${STAGING_COMPOSE_ENV}" -f "${STAGING_COMPOSE_FILE}" up -d
echo "Aligning Postgres role passwords with PostgREST..."
if [[ -f scripts/supabase/align-db-role-passwords.sh ]]; then
  sudo bash scripts/supabase/align-db-role-passwords.sh --from-running-postgrest
else
  echo "Warning: missing scripts/supabase/align-db-role-passwords.sh" >&2
fi
echo "Persisting POSTGRES_PASSWORD into ${STAGING_COMPOSE_ENV}..."
if [[ -f scripts/supabase/write-postgres-password-from-postgrest-to-env.sh ]]; then
  sudo bash scripts/supabase/write-postgres-password-from-postgrest-to-env.sh "${STAGING_COMPOSE_ENV}"
else
  echo "Warning: missing scripts/supabase/write-postgres-password-from-postgrest-to-env.sh" >&2
fi
echo "Restarting PostgREST, Kong, GraphQL..."
sudo docker compose --env-file "${STAGING_COMPOSE_ENV}" -f "${STAGING_COMPOSE_FILE}" restart \\
  supabase-rest supabase-kong graphql-server
rm -f "${REMOTE_GZ}"
echo "Done."
EOS
)

echo "Running remote restore on staging..."
ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${STAGING_SSH_TARGET}" bash <<EOF
${REMOTE_SCRIPT}
EOF

echo "Restore finished. Check UI: http://${STAGING_SSH_HOST}:${STAGING_UI_PORT:-5173}/"
