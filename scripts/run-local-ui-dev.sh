#!/usr/bin/env bash
# Vite-dev on LOCAL_UI_PORT (default 5173) for local edit/HMR.
# Intended to run under launchd KeepAlive (outside Cursor/agent process trees).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:${HOME}/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/config/targets.env" 2>/dev/null || true

UI_DIR="${ROOT_DIR}/talia-ui"
PORT="${LOCAL_UI_PORT:-5173}"

if [[ ! -d "$UI_DIR" ]]; then
  echo "Missing ${UI_DIR}" >&2
  exit 1
fi

NPM_BIN="$(command -v npm || true)"
if [[ -z "$NPM_BIN" ]]; then
  echo "npm not found on PATH=${PATH}" >&2
  exit 127
fi

cd "$UI_DIR"
exec "$NPM_BIN" run dev -- --port "${PORT}" --strictPort
