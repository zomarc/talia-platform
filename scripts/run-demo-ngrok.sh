#!/usr/bin/env bash
# ngrok reserved domain → local public preview port (not Vite-dev).
# Intended to run under launchd KeepAlive.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# launchd provides a minimal PATH — include Homebrew + common bins.
export PATH="/opt/homebrew/bin:/usr/local/bin:/Users/russell/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/config/targets.env" 2>/dev/null || true

DOMAIN="${LOCAL_NGROK_DOMAIN:-${PUBLIC_MAIN_URL#https://}}"
DOMAIN="${DOMAIN#http://}"
PUBLIC_PORT="${LOCAL_PUBLIC_UI_PORT:-4173}"
USER_NAME="${NGROK_BASIC_USER:-talia}"
PASS_WORD="${NGROK_BASIC_PASS:-dev2025tal}"
# Set NGROK_BASIC_AUTH=0 (or empty user/pass) to publish without the browser login wall.
BASIC_AUTH_ENABLED="${NGROK_BASIC_AUTH:-1}"

NGROK_BIN="$(command -v ngrok || true)"
if [[ -z "$NGROK_BIN" ]]; then
  echo "ngrok not found on PATH=${PATH}" >&2
  exit 127
fi

if [[ "${BASIC_AUTH_ENABLED}" != "0" && -n "${USER_NAME}" && -n "${PASS_WORD}" ]]; then
  exec "$NGROK_BIN" http \
    --url="${DOMAIN}" \
    --pooling-enabled \
    --basic-auth="${USER_NAME}:${PASS_WORD}" \
    --log=stdout \
    --log-format=logfmt \
    "${PUBLIC_PORT}"
fi

exec "$NGROK_BIN" http \
  --url="${DOMAIN}" \
  --pooling-enabled \
  --log=stdout \
  --log-format=logfmt \
  "${PUBLIC_PORT}"
