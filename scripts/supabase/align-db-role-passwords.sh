#!/usr/bin/env bash
# Re-align Supabase Postgres role passwords with POSTGRES_PASSWORD from an env file.
# Needed after restoring a pg_dump from another machine: role password hashes in the cluster
# may no longer match this host's compose URI (PostgREST uses authenticator → Kong → GraphQL).
#
# Usage (on the Docker host, from repo root or talia-docker dir):
#   ./scripts/supabase/align-db-role-passwords.sh [.env.staging]
#   POSTGRES_PASSWORD=secret ./scripts/supabase/align-db-role-passwords.sh -
#   ./scripts/supabase/align-db-role-passwords.sh --from-running-postgrest
#
set -euo pipefail

CONTAINER="${CONTAINER:-talia-supabase-db}"
POSTGREST_CONTAINER="${POSTGREST_CONTAINER:-talia-supabase-rest}"
# Reserved roles (e.g. authenticator) require a superuser; plain "postgres" is not superuser in Supabase images.
PSQL_SUPERUSER="${PSQL_SUPERUSER:-supabase_admin}"

ENV_FILE="${1:-.env.staging}"

if [[ "${1:-}" == "--from-running-postgrest" ]]; then
  if [[ "$(id -u)" -eq 0 ]] || docker info >/dev/null 2>&1; then
    DOCKER=(docker)
  else
    DOCKER=(sudo docker)
  fi
  URI="$("${DOCKER[@]}" inspect "$POSTGREST_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^PGRST_DB_URI=' | cut -d= -f2- || true)"
  if [[ -z "$URI" ]]; then
    echo "Could not read PGRST_DB_URI from container ${POSTGREST_CONTAINER}" >&2
    exit 1
  fi
  # postgres://authenticator:PASSWORD@host:port/db  (PASSWORD may be URL-encoded)
  POSTGRES_PASSWORD="$(printf '%s' "$URI" | sed -n 's|^postgres://authenticator:\([^@]*\)@.*|\1|p')"
  if [[ -z "$POSTGRES_PASSWORD" ]]; then
    echo "Could not parse password from PGRST_DB_URI" >&2
    exit 1
  fi
  # Basic URL-decode for %xx (common in generated URIs)
  POSTGRES_PASSWORD="$(printf '%b' "${POSTGRES_PASSWORD//%/\\x}")"
elif [[ "$ENV_FILE" == "-" ]]; then
  : # use POSTGRES_PASSWORD already exported in the environment
elif [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "Usage: $0 <env-file|-> | --from-running-postgrest" >&2
  echo "  (use - and export POSTGRES_PASSWORD first to avoid storing it in a file)" >&2
  exit 1
fi

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "POSTGRES_PASSWORD is not set (add it to the env file, or export it and pass - as the argument)." >&2
  exit 1
fi

sql_escape() {
  printf '%s' "$1" | sed "s/'/''/g"
}

P="$(sql_escape "$POSTGRES_PASSWORD")"

# Roles used by docker-compose.staging.yml style stacks (same password at init).
ROLES=(
  authenticator
  supabase_auth_admin
  supabase_storage_admin
  supabase_admin
)

echo "Updating passwords for: ${ROLES[*]} (container ${CONTAINER})"

SQL=""
for role in "${ROLES[@]}"; do
  SQL+="ALTER ROLE \"${role}\" WITH PASSWORD '${P}';"
done

if ! command -v docker >/dev/null 2>&1 && command -v sudo >/dev/null 2>&1; then
  DOCKER=(sudo docker)
else
  DOCKER=(docker)
fi

# Password for supabase_admin matches POSTGRES_PASSWORD in the DB container env (same as compose).
DB_PW="$POSTGRES_PASSWORD"
if [[ -z "$DB_PW" ]]; then
  DB_PW="$("${DOCKER[@]}" inspect "$CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^POSTGRES_PASSWORD=' | cut -d= -f2- || true)"
fi
if [[ -z "$DB_PW" ]]; then
  echo "Could not determine DB password for ${PSQL_SUPERUSER} (set POSTGRES_PASSWORD)." >&2
  exit 1
fi

"${DOCKER[@]}" exec -e PGPASSWORD="$DB_PW" -i "$CONTAINER" psql -U "$PSQL_SUPERUSER" -d postgres -v ON_ERROR_STOP=on -c "$SQL"

echo "Done. Restart PostgREST (and optionally Kong + graphql-server) if they were running."
