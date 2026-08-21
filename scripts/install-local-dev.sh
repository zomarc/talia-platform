#!/usr/bin/env bash
# Install / start durable local Vite-dev (:5173) under macOS launchd KeepAlive.
# Survives Cursor agent shells. Does not touch vite preview :4173 (demo presenter).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/config/targets.env" 2>/dev/null || true

UID_NUM="$(id -u)"
UI_PORT="${LOCAL_UI_PORT:-5173}"
AGENTS_DIR="${HOME}/Library/LaunchAgents"
UI_LABEL="com.taliahub.ui-dev"
UI_PLIST="${AGENTS_DIR}/${UI_LABEL}.plist"
UI_SCRIPT="${ROOT_DIR}/scripts/run-local-ui-dev.sh"
GQL_PORT="${LOCAL_GRAPHQL_PORT:-4000}"
GQL_LABEL="com.taliahub.graphql"
GQL_PLIST="${AGENTS_DIR}/${GQL_LABEL}.plist"
GQL_SCRIPT="${ROOT_DIR}/scripts/run-local-graphql.sh"

mkdir -p "$AGENTS_DIR"
chmod +x "$UI_SCRIPT" "$GQL_SCRIPT"

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
    <string>/opt/homebrew/bin:/usr/local/bin:${HOME}/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
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

free_port() {
  local port="$1"
  local pids
  pids=$( { lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null || true; } | tr '\n' ' ')
  if [[ -n "${pids// /}" ]]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
}

free_ui_port() { free_port "$UI_PORT"; }
free_gql_port() { free_port "$GQL_PORT"; }

ui_http() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:${UI_PORT}/" 2>/dev/null || echo "000"
}

gql_http() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:${GQL_PORT}/" 2>/dev/null || echo "000"
}

gql_ok() {
  case "$(gql_http)" in
    200|400|404) return 0 ;;
  esac
  return 1
}

wait_ui() {
  local code="000"
  local _
  for _ in $(seq 1 40); do
    code=$(ui_http)
    [[ "$code" == "200" ]] && { echo "$code"; return 0; }
    sleep 0.5
  done
  echo "$code"
  return 1
}

wait_gql() {
  local _
  for _ in $(seq 1 40); do
    if gql_ok; then return 0; fi
    sleep 0.5
  done
  return 1
}

agent_loaded() {
  local label="$1"
  launchctl print "gui/${UID_NUM}/${label}" >/dev/null 2>&1
}

ACTION="${1:-start}"

case "$ACTION" in
  stop)
    echo "Stopping durable local Vite-dev + GraphQL..."
    bootout "$UI_LABEL"
    bootout "$GQL_LABEL"
    free_ui_port
    free_gql_port
    echo "Stopped. Demo preview :4173 was not touched."
    ;;
  status)
    echo "Vite-dev agent:"
    launchctl print "gui/${UID_NUM}/${UI_LABEL}" 2>&1 | head -12 || echo "  (not loaded)"
    curl -sS -o /dev/null -w "local :${UI_PORT} HTTP %{http_code}\n" --max-time 2 \
      "http://127.0.0.1:${UI_PORT}/" || echo "local :${UI_PORT} down"
    echo "GraphQL agent:"
    launchctl print "gui/${UID_NUM}/${GQL_LABEL}" 2>&1 | head -12 || echo "  (not loaded)"
    curl -sS -o /dev/null -w "local :${GQL_PORT} HTTP %{http_code}\n" --max-time 2 \
      "http://127.0.0.1:${GQL_PORT}/" || echo "local :${GQL_PORT} down"
    ;;
  start|restart|*)
    echo "Installing durable local edit stack (launchd KeepAlive). Supabase stays on Docker."
    write_plist "$UI_LABEL" "$UI_SCRIPT" "$UI_PLIST" \
      /tmp/talia-ui.log /tmp/talia-ui.err.log
    write_plist "$GQL_LABEL" "$GQL_SCRIPT" "$GQL_PLIST" \
      /tmp/talia-server.log /tmp/talia-server.err.log

    if ! agent_loaded "$UI_LABEL" || [[ "$(ui_http)" != "200" ]]; then
      bootout "$UI_LABEL"
      free_ui_port
      sleep 1
      bootstrap "$UI_PLIST"
      wait_ui >/dev/null || { echo "Vite-dev did not answer on :${UI_PORT}. See /tmp/talia-ui.log" >&2; exit 1; }
    fi
    echo "  Edit UI: http://127.0.0.1:${UI_PORT}/  (${UI_LABEL})"

    if ! agent_loaded "$GQL_LABEL" || ! gql_ok; then
      bootout "$GQL_LABEL"
      free_gql_port
      sleep 1
      bootstrap "$GQL_PLIST"
      wait_gql || { echo "GraphQL did not answer on :${GQL_PORT}. See /tmp/talia-server.log" >&2; exit 1; }
    fi
    echo "  GraphQL: http://127.0.0.1:${GQL_PORT}/  (${GQL_LABEL})"
    echo "  Stop: ${ROOT_DIR}/scripts/install-local-dev.sh stop"
    ;;
esac
