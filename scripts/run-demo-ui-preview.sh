#!/usr/bin/env bash
# Serve talia-ui dist on LOCAL_PUBLIC_UI_PORT (default 4173) for public discuss portal.
# Intended to run under launchd KeepAlive (outside Cursor/agent process trees).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# launchd provides a minimal PATH — include Homebrew + common bins.
export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/russell/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/config/targets.env" 2>/dev/null || true

PUBLIC_PORT="${LOCAL_PUBLIC_UI_PORT:-4173}"
UI_DIR="${ROOT_DIR}/talia-ui"
DIST_HTML="${UI_DIR}/dist/index.html"

if [[ ! -f "$DIST_HTML" ]]; then
  echo "Missing ${DIST_HTML} — run Start Demo / npm run build first" >&2
  exit 1
fi

NPX_BIN="$(command -v npx || true)"
if [[ -z "$NPX_BIN" ]]; then
  echo "npx not found on PATH=${PATH}" >&2
  exit 127
fi

cd "$UI_DIR"
exec "$NPX_BIN" vite preview --port "${PUBLIC_PORT}" --host --strictPort
