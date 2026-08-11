#!/usr/bin/env bash
# Install / start durable laptop demo presenter (preview :4173 + ngrok → taliahub.com).
# Survives Cursor agent shells; keeps https://dev.taliahub.com pointed at this machine.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/config/targets.env" 2>/dev/null || true

UID_NUM="$(id -u)"
DOMAIN="${LOCAL_NGROK_DOMAIN:-taliahub.com}"
PUBLIC_PORT="${LOCAL_PUBLIC_UI_PORT:-4173}"
AGENTS_DIR="${HOME}/Library/LaunchAgents"
PREVIEW_LABEL="com.taliahub.ui-preview"
NGROK_LABEL="com.taliahub.ngrok-demo"
PREVIEW_PLIST="${AGENTS_DIR}/${PREVIEW_LABEL}.plist"
NGROK_PLIST="${AGENTS_DIR}/${NGROK_LABEL}.plist"
PREVIEW_SCRIPT="${ROOT_DIR}/scripts/run-demo-ui-preview.sh"
NGROK_SCRIPT="${ROOT_DIR}/scripts/run-demo-ngrok.sh"

mkdir -p "$AGENTS_DIR"
chmod +x "$PREVIEW_SCRIPT" "$NGROK_SCRIPT"

write_plist() {
  local label="$1" script="$2" outfile="$3" outlog="$4" errlog="$5"
  cat >"$outfile" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${script}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/Users/russell/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>StandardOutPath</key>
  <string>${outlog}</string>
  <key>StandardErrorPath</key>
  <string>${errlog}</string>
</dict>
</plist>
EOF
}

bootout() {
  local label="$1"
  launchctl bootout "gui/${UID_NUM}/${label}" 2>/dev/null || true
  launchctl unload "${AGENTS_DIR}/${label}.plist" 2>/dev/null || true
}

bootstrap() {
  local plist="$1"
  launchctl bootstrap "gui/${UID_NUM}" "$plist" 2>/dev/null \
    || launchctl load -w "$plist" 2>/dev/null \
    || true
  launchctl kickstart -k "gui/${UID_NUM}/$(basename "$plist" .plist)" 2>/dev/null || true
}

ACTION="${1:-start}"

case "$ACTION" in
  stop)
    echo "Stopping durable demo presenter (preview + ngrok)..."
    bootout "$PREVIEW_LABEL"
    bootout "$NGROK_LABEL"
    # Also clear any stray listeners started outside launchd
    pids=$( { lsof -nP -iTCP:"${PUBLIC_PORT}" -sTCP:LISTEN -t 2>/dev/null || true; } | tr '\n' ' ')
    if [[ -n "${pids// /}" ]]; then
      # shellcheck disable=SC2086
      kill $pids 2>/dev/null || true
      sleep 1
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
    pkill -f "ngrok .*${DOMAIN}" 2>/dev/null || true
    echo "Stopped."
    ;;
  status)
    echo "Preview agent:"
    launchctl print "gui/${UID_NUM}/${PREVIEW_LABEL}" 2>&1 | head -20 || echo "  (not loaded)"
    echo "ngrok agent:"
    launchctl print "gui/${UID_NUM}/${NGROK_LABEL}" 2>&1 | head -20 || echo "  (not loaded)"
    curl -sS -o /dev/null -w "local :${PUBLIC_PORT} HTTP %{http_code}\n" --max-time 2 "http://127.0.0.1:${PUBLIC_PORT}/" || echo "local :${PUBLIC_PORT} down"
    curl -sSI --max-time 8 -u "${NGROK_BASIC_USER:-talia}:${NGROK_BASIC_PASS:-dev2025tal}" \
      "${PUBLIC_DEV_URL:-https://dev.taliahub.com}/" 2>/dev/null | awk 'NR==1 || tolower($0) ~ /x-taliahub-gateway/'
    ;;
  start|restart|*)
    if [[ ! -f "${ROOT_DIR}/talia-ui/dist/index.html" ]]; then
      echo "Building UI preview bundle first..."
      (cd "${ROOT_DIR}/talia-ui" && VITE_ENABLE_DEV_MODE=true npm run build >/tmp/talia-ui-preview-build.log 2>&1) \
        || { echo "Build failed — see /tmp/talia-ui-preview-build.log"; exit 1; }
    fi

    write_plist "$PREVIEW_LABEL" "$PREVIEW_SCRIPT" "$PREVIEW_PLIST" \
      /tmp/talia-ui-preview.log /tmp/talia-ui-preview.err.log
    write_plist "$NGROK_LABEL" "$NGROK_SCRIPT" "$NGROK_PLIST" \
      /tmp/ngrok-taliahub.log /tmp/ngrok-taliahub.err.log

    # Free port / conflict before KeepAlive agents claim it
    bootout "$PREVIEW_LABEL"
    bootout "$NGROK_LABEL"
    pids=$( { lsof -nP -iTCP:"${PUBLIC_PORT}" -sTCP:LISTEN -t 2>/dev/null || true; } | tr '\n' ' ')
    if [[ -n "${pids// /}" ]]; then
      # shellcheck disable=SC2086
      kill $pids 2>/dev/null || true
      sleep 1
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
    pkill -f "ngrok .*${DOMAIN}" 2>/dev/null || true
    sleep 1

    bootstrap "$PREVIEW_PLIST"
    # Preview must listen before ngrok origin checks
    for _ in $(seq 1 40); do
      code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:${PUBLIC_PORT}/" 2>/dev/null || echo 000)
      [[ "$code" == "200" ]] && break
      sleep 0.5
    done
    bootstrap "$NGROK_PLIST"

    echo "Durable demo presenter installed (launchd KeepAlive)."
    echo "  Preview: :${PUBLIC_PORT}  (agent ${PREVIEW_LABEL})"
    echo "  Tunnel:  ${DOMAIN} → :${PUBLIC_PORT}  (agent ${NGROK_LABEL})"
    echo "  Discuss: ${PUBLIC_DEV_URL:-https://dev.taliahub.com}"
    echo "  Stop:    ${ROOT_DIR}/scripts/install-demo-presenter.sh stop"
    ;;
esac
