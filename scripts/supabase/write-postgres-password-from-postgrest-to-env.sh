#!/usr/bin/env bash
# Read the DB password from a running PostgREST container (PGRST_DB_URI) and write POSTGRES_PASSWORD
# into an env file. Use after align-db-role-passwords.sh so the file matches what compose uses.
#
# Usage (on Docker host, from talia-docker):
#   ./scripts/supabase/write-postgres-password-from-postgrest-to-env.sh .env.staging
#
set -euo pipefail

ENV_FILE="${1:-.env.staging}"
POSTGREST_CONTAINER="${POSTGREST_CONTAINER:-talia-supabase-rest}"
ENV_ABS="$(cd "$(dirname "$ENV_FILE")" && pwd)/$(basename "$ENV_FILE")"

if [[ "$(id -u)" -eq 0 ]] || docker info >/dev/null 2>&1; then
  DOCKER=(docker)
else
  DOCKER=(sudo docker)
fi

URI="$("${DOCKER[@]}" inspect "$POSTGREST_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^PGRST_DB_URI=' | cut -d= -f2- || true)"
if [[ -z "$URI" ]]; then
  echo "Could not read PGRST_DB_URI from ${POSTGREST_CONTAINER}" >&2
  exit 1
fi
PW=$(printf '%s' "$URI" | sed -n 's|^postgres://authenticator:\([^@]*\)@.*|\1|p')
if [[ -z "$PW" ]]; then
  echo "Could not parse password from PGRST_DB_URI" >&2
  exit 1
fi
PW=$(printf '%b' "${PW//%/\\x}")

export _TALIA_PG_PW="$PW"
export _TALIA_ENV_FILE="$ENV_ABS"
python3 <<'PY'
import os, pathlib, re
path = pathlib.Path(os.environ["_TALIA_ENV_FILE"])
pw = os.environ["_TALIA_PG_PW"]
text = path.read_text() if path.exists() else ""
lines = [ln for ln in text.splitlines() if not re.match(r"^\s*POSTGRES_PASSWORD\s*=", ln)]
# Double-quote for .env; escape backslashes and double-quotes in value
escaped = pw.replace("\\", "\\\\").replace('"', '\\"')
lines.append(f'POSTGRES_PASSWORD="{escaped}"')
path.write_text("\n".join(lines) + "\n")
print(f"Wrote POSTGRES_PASSWORD to {path}")
PY

unset _TALIA_PG_PW _TALIA_ENV_FILE
