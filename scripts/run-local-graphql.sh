#!/usr/bin/env bash
# GraphQL API on LOCAL_GRAPHQL_PORT (default 4000).
# Intended to run under launchd KeepAlive (outside Cursor/agent process trees).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:${HOME}/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/config/targets.env" 2>/dev/null || true

SERVER_DIR="${ROOT_DIR}/talia-server"

if [[ ! -d "$SERVER_DIR" ]]; then
  echo "Missing ${SERVER_DIR}" >&2
  exit 1
fi

NPM_BIN="$(command -v npm || true)"
if [[ -z "$NPM_BIN" ]]; then
  echo "npm not found on PATH=${PATH}" >&2
  exit 127
fi

cd "$SERVER_DIR"
# Foreground tsx watch so launchd KeepAlive owns the process (do not use start.sh).
exec "$NPM_BIN" run dev
