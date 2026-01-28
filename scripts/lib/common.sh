#!/bin/bash
#
# Common functions for Talia scripts
# Source this file: source "$(dirname "$0")/lib/common.sh"
#

# Colors
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export BOLD='\033[1m'
export DIM='\033[2m'
export NC='\033[0m'

# Configuration
export STAGING_HOST="${STAGING_HOST:-192.168.1.120}"
export STAGING_USER="${STAGING_USER:-zomarc}"
export STAGING_DIR="${STAGING_DIR:-/home/${STAGING_USER}/talia-docker}"
export NGROK_URL="${NGROK_URL:-https://taliahub.com}"
export NGROK_USER="${NGROK_USER:-talia}"
export NGROK_PASS="${NGROK_PASS:-dev2025tal}"
export EXPECTED_VPN_IP="${EXPECTED_VPN_IP:-149.40.48.92}"

# Detect environment
detect_environment() {
  local hostname=$(hostname)
  if [[ "$hostname" == "zomarcsvr" ]] || [[ -f /home/zomarc/talia-docker/docker-compose.staging.yml ]]; then
    echo "staging"
  else
    echo "local"
  fi
}

# Print functions
print_header() {
  local title="${1:-TALIA}"
  echo ""
  echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}${BOLD}  ${title}${NC}"
  echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BLUE}Host:${NC}      $(hostname)"
  echo -e "${BLUE}Timestamp:${NC} $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo ""
}

print_section() {
  local title="$1"
  echo ""
  echo -e "${CYAN}┌────────────────────────────────────────────────────────────┐${NC}"
  echo -e "${CYAN}│${NC} ${BOLD}${title}${NC}"
  echo -e "${CYAN}└────────────────────────────────────────────────────────────┘${NC}"
}

print_subsection() {
  local title="$1"
  echo ""
  echo -e "  ${BOLD}${title}${NC}"
}

# Status check function
# Usage: check_status "label" "OK|WARN|FAIL" "optional details"
check_status() {
  local label="$1"
  local status="$2"
  local details="${3:-}"
  local indent="${4:-  }"
  
  if [[ "$status" == "OK" ]]; then
    echo -e "${indent}${GREEN}[OK]${NC}   ${label}${details:+ - $details}"
    return 0
  elif [[ "$status" == "WARN" ]]; then
    echo -e "${indent}${YELLOW}[WARN]${NC} ${label}${details:+ - $details}"
    return 1
  else
    echo -e "${indent}${RED}[FAIL]${NC} ${label}${details:+ - $details}"
    return 1
  fi
}

# SSH helper - runs command on staging, returns output
# Usage: ssh_staging "command"
ssh_staging() {
  local cmd="$1"
  local timeout="${2:-10}"
  ssh -o ConnectTimeout="${timeout}" -o BatchMode=yes "${STAGING_USER}@${STAGING_HOST}" "$cmd" 2>/dev/null
}

# Test if SSH to staging works
test_ssh_staging() {
  ssh -o ConnectTimeout=5 -o BatchMode=yes "${STAGING_USER}@${STAGING_HOST}" "echo ok" >/dev/null 2>&1
}

# HTTP check helper
# Usage: http_check "url" [timeout]
# Returns: HTTP status code or "000" on failure
http_check() {
  local url="$1"
  local timeout="${2:-5}"
  curl -sS -o /dev/null -w '%{http_code}' --max-time "${timeout}" "$url" 2>/dev/null || echo "000"
}

# HTTP check with basic auth
http_check_auth() {
  local url="$1"
  local user="$2"
  local pass="$3"
  local timeout="${4:-5}"
  curl -sS --basic -u "${user}:${pass}" -o /dev/null -w '%{http_code}' --max-time "${timeout}" "$url" 2>/dev/null || echo "000"
}

# Ping latency test
# Usage: ping_latency "host" [count]
# Returns: avg latency in ms or "timeout"
ping_latency() {
  local host="$1"
  local count="${2:-3}"
  local result
  result=$(ping -c "$count" -q "$host" 2>/dev/null | grep "round-trip" | cut -d'/' -f5)
  if [[ -n "$result" ]]; then
    echo "$result"
  else
    echo "timeout"
  fi
}

# Format milliseconds nicely
format_ms() {
  local ms="$1"
  if [[ "$ms" == "timeout" ]]; then
    echo "${RED}timeout${NC}"
  elif (( $(echo "$ms < 50" | bc -l) )); then
    echo "${GREEN}${ms}ms${NC}"
  elif (( $(echo "$ms < 200" | bc -l) )); then
    echo "${YELLOW}${ms}ms${NC}"
  else
    echo "${RED}${ms}ms${NC}"
  fi
}

# Format bytes nicely
format_bytes() {
  local bytes="$1"
  if [[ "$bytes" -lt 1024 ]]; then
    echo "${bytes}B"
  elif [[ "$bytes" -lt 1048576 ]]; then
    echo "$(echo "scale=1; $bytes/1024" | bc)KB"
  else
    echo "$(echo "scale=1; $bytes/1048576" | bc)MB"
  fi
}

# Print final summary
print_summary() {
  local issues="$1"
  echo ""
  echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
  if [[ "$issues" -eq 0 ]]; then
    echo -e "${CYAN}║${NC}  ${GREEN}✅ ALL CHECKS PASSED${NC}                                      ${CYAN}║${NC}"
  else
    printf "${CYAN}║${NC}  ${YELLOW}⚠️  FOUND %d ISSUE(S)${NC}%*s${CYAN}║${NC}\n" "$issues" $((42 - ${#issues})) ""
  fi
  echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}
