#!/bin/bash
#
# Unified Talia Validation Script
# Checks local, staging environments and connectivity performance
#
# Usage:
#   ./scripts/validate-staging.sh              # Check both + performance
#   ./scripts/validate-staging.sh local        # Check local only
#   ./scripts/validate-staging.sh staging      # Check staging only  
#   ./scripts/validate-staging.sh perf         # Performance test only
#   ./scripts/validate-staging.sh --quick      # Skip performance tests
#   ./scripts/validate-staging.sh --azure      # Include Azure test
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Source common functions
if [[ -f "${SCRIPT_DIR}/lib/common.sh" ]]; then
  source "${SCRIPT_DIR}/lib/common.sh"
else
  # Fallback colors if common.sh not found
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
fi

# Parse arguments
CHECK_LOCAL=true
CHECK_STAGING=true
CHECK_PERF=true
QUICK_MODE=false
EXTRA_ARGS=""

for arg in "$@"; do
  case "$arg" in
    local)
      CHECK_STAGING=false
      CHECK_PERF=false
      ;;
    staging)
      CHECK_LOCAL=false
      ;;
    perf|performance)
      CHECK_LOCAL=false
      CHECK_STAGING=false
      CHECK_PERF=true
      ;;
    --quick|-q)
      QUICK_MODE=true
      CHECK_PERF=false
      ;;
    --azure)
      EXTRA_ARGS="--azure"
      ;;
    -h|--help)
      cat << 'EOF'
Usage: validate-staging.sh [target] [options]

Targets:
  local       Check local environment only
  staging     Check staging environment only
  perf        Performance/connectivity test only
  (none)      Check all (local + staging + performance)

Options:
  --quick, -q   Skip performance tests (faster)
  --azure       Include Azure Synapse connectivity test
  -h, --help    Show this help

Examples:
  ./scripts/validate-staging.sh                # Full check
  ./scripts/validate-staging.sh staging        # Staging only
  ./scripts/validate-staging.sh --quick        # Skip perf tests
  ./scripts/validate-staging.sh perf           # Only performance
EOF
      exit 0
      ;;
  esac
done

# Detect if running on staging server
IS_ON_STAGING=false
HOSTNAME=$(hostname)
if [[ "$HOSTNAME" == "zomarcsvr" ]] || [[ -f /home/zomarc/talia-docker/docker-compose.staging.yml ]]; then
  IS_ON_STAGING=true
fi

# ============================================================
# PERFORMANCE / CONNECTIVITY TESTS
# ============================================================
check_performance() {
  print_section "CONNECTIVITY PERFORMANCE"
  
  local perf_issues=0
  
  if $IS_ON_STAGING; then
    echo -e "  ${DIM}(Running from staging - testing outbound connectivity)${NC}"
    echo ""
    
    # Test outbound connectivity
    print_subsection "Outbound Latency:"
    
    # VPN endpoint
    local vpn_latency
    vpn_latency=$(curl -sS -o /dev/null -w '%{time_total}' --max-time 10 https://api.ipify.org 2>/dev/null || echo "timeout")
    if [[ "$vpn_latency" != "timeout" ]]; then
      vpn_latency=$(awk "BEGIN {printf \"%.0f\", $vpn_latency * 1000}")
      if [[ "$vpn_latency" -lt 500 ]]; then
        check_status "VPN → Internet" "OK" "${vpn_latency}ms"
      else
        check_status "VPN → Internet" "WARN" "${vpn_latency}ms (slow)" || ((perf_issues++))
      fi
    else
      check_status "VPN → Internet" "FAIL" "timeout" || ((perf_issues++))
    fi
    
    # ngrok
    local ngrok_latency
    ngrok_latency=$(curl -sS -o /dev/null -w '%{time_total}' --max-time 10 http://localhost:4040/api/tunnels 2>/dev/null || echo "timeout")
    if [[ "$ngrok_latency" != "timeout" ]]; then
      ngrok_latency=$(awk "BEGIN {printf \"%.0f\", $ngrok_latency * 1000}")
      check_status "ngrok API" "OK" "${ngrok_latency}ms"
    else
      check_status "ngrok API" "FAIL" "not responding" || ((perf_issues++))
    fi
    
  else
    echo -e "  ${DIM}(Running from ${HOSTNAME} - testing connectivity to staging)${NC}"
    echo ""
    
    print_subsection "Network Latency:"
    
    # Ping to staging
    local ping_result
    ping_result=$(ping -c 5 -q ${STAGING_HOST} 2>/dev/null)
    if [[ $? -eq 0 ]]; then
      local ping_avg=$(echo "$ping_result" | grep "round-trip" | cut -d'/' -f5)
      local ping_loss=$(echo "$ping_result" | grep "packet loss" | grep -oE '[0-9.]+%' | head -1)
      
      local ping_ok=$(awk "BEGIN {print ($ping_avg < 100) ? 1 : 0}")
      local ping_warn=$(awk "BEGIN {print ($ping_avg < 500) ? 1 : 0}")
      local loss_num="${ping_loss%\%}"
      local loss_ok=$(awk "BEGIN {print ($loss_num < 10) ? 1 : 0}")
      
      if [[ "$ping_ok" == "1" ]] && [[ "$ping_loss" == "0.0%" || "$ping_loss" == "0%" ]]; then
        check_status "Ping to staging" "OK" "avg ${ping_avg}ms, ${ping_loss} loss"
      elif [[ "$ping_warn" == "1" ]] && [[ "$loss_ok" == "1" ]]; then
        check_status "Ping to staging" "WARN" "avg ${ping_avg}ms, ${ping_loss} loss" || ((perf_issues++))
      else
        check_status "Ping to staging" "WARN" "avg ${ping_avg}ms (HIGH), ${ping_loss} loss" || ((perf_issues++))
      fi
    else
      check_status "Ping to staging" "FAIL" "unreachable" || ((perf_issues++))
    fi
    
    # SSH latency - use time command for macOS compatibility
    local ssh_time_output ssh_latency
    ssh_time_output=$( { time ssh -o ConnectTimeout=10 -o BatchMode=yes "${STAGING_USER}@${STAGING_HOST}" "echo ok" >/dev/null 2>&1; } 2>&1 )
    if [[ $? -eq 0 ]]; then
      # Extract real time and convert to ms
      ssh_latency=$(echo "$ssh_time_output" | grep real | awk '{print $2}' | sed 's/0m//' | sed 's/s//' | awk '{printf "%.0f", $1 * 1000}')
      if [[ -z "$ssh_latency" ]]; then ssh_latency="0"; fi
      if [[ "$ssh_latency" -lt 2000 ]]; then
        check_status "SSH connection" "OK" "${ssh_latency}ms"
      else
        check_status "SSH connection" "WARN" "${ssh_latency}ms (slow)" || ((perf_issues++))
      fi
    else
      check_status "SSH connection" "FAIL" "timeout" || ((perf_issues++))
    fi
    
    print_subsection "HTTP Response Times:"
    
    # taliahub.com (public)
    local talia_latency
    talia_latency=$(curl -sS -o /dev/null -w '%{time_total}' --max-time 15 --basic -u "${NGROK_USER}:${NGROK_PASS}" "${NGROK_URL}" 2>/dev/null || echo "timeout")
    if [[ "$talia_latency" != "timeout" ]]; then
      talia_latency=$(awk "BEGIN {printf \"%.0f\", $talia_latency * 1000}")
      if [[ "$talia_latency" -lt 2000 ]]; then
        check_status "taliahub.com (public)" "OK" "${talia_latency}ms"
      else
        check_status "taliahub.com (public)" "WARN" "${talia_latency}ms (slow)" || ((perf_issues++))
      fi
    else
      check_status "taliahub.com (public)" "FAIL" "timeout" || ((perf_issues++))
    fi
    
    # GraphQL via SSH tunnel test
    local gql_latency
    gql_latency=$(ssh -o ConnectTimeout=5 "${STAGING_USER}@${STAGING_HOST}" \
      "curl -sS -o /dev/null -w '%{time_total}' --max-time 5 -X POST http://localhost:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ __typename }\"}'" 2>/dev/null || echo "timeout")
    if [[ "$gql_latency" != "timeout" ]]; then
      gql_latency=$(awk "BEGIN {printf \"%.0f\", $gql_latency * 1000}")
      check_status "GraphQL (internal)" "OK" "${gql_latency}ms"
    else
      check_status "GraphQL (internal)" "WARN" "could not measure" || ((perf_issues++))
    fi
    
    print_subsection "Throughput Test:"
    
    # Simple throughput test - download small payload with timing
    local throughput_result throughput_bytes throughput_time
    throughput_result=$(ssh -o ConnectTimeout=5 "${STAGING_USER}@${STAGING_HOST}" \
      "curl -sS -w '\n%{time_total} %{size_download}' -X POST http://localhost:4000/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ databaseTables { tableName } }\"}' 2>/dev/null | tail -1" 2>/dev/null || echo "0 0")
    throughput_time=$(echo "$throughput_result" | awk '{printf "%.0f", $1 * 1000}')
    throughput_bytes=$(echo "$throughput_result" | awk '{print $2}')
    
    if [[ "$throughput_bytes" -gt 0 ]] && [[ "$throughput_time" -gt 0 ]]; then
      local throughput_kbps=$(awk "BEGIN {printf \"%.1f\", ($throughput_bytes * 8) / $throughput_time}")
      check_status "Data transfer" "OK" "${throughput_bytes} bytes in ${throughput_time}ms (~${throughput_kbps} Kbps)"
    else
      check_status "Data transfer" "WARN" "could not measure" || ((perf_issues++))
    fi
  fi
  
  echo ""
  if [[ $perf_issues -eq 0 ]]; then
    echo -e "  ${GREEN}✅ Performance OK${NC}"
  else
    echo -e "  ${YELLOW}⚠️  Performance: ${perf_issues} issue(s)${NC}"
  fi
  
  return $perf_issues
}

# ============================================================
# LOCAL ENVIRONMENT CHECKS
# ============================================================
check_local_environment() {
  print_section "LOCAL ENVIRONMENT (Mac Development)"
  echo -e "  ${BLUE}Source:${NC} ${HOSTNAME}"
  echo -e "  ${BLUE}Root:${NC}   ${ROOT_DIR}"
  
  local local_issues=0
  
  print_subsection "Services:"
  
  # GraphQL Server
  local gql_code
  gql_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:4000/graphql 2>/dev/null || echo "000")
  if [[ "$gql_code" == "200" ]] || [[ "$gql_code" == "400" ]]; then
    check_status "GraphQL (localhost:4000)" "OK" "HTTP ${gql_code}"
  else
    check_status "GraphQL (localhost:4000)" "FAIL" "HTTP ${gql_code}" || ((local_issues++))
  fi
  
  # UI Server
  local ui_code
  ui_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:5173/ 2>/dev/null || echo "000")
  if [[ "$ui_code" == "200" ]]; then
    check_status "UI (localhost:5173)" "OK" "HTTP ${ui_code}"
  else
    check_status "UI (localhost:5173)" "WARN" "HTTP ${ui_code} - run: cd talia-ui && npm run dev" || ((local_issues++))
  fi
  
  # Supabase Kong
  local kong_code
  kong_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:54321/ 2>/dev/null || echo "000")
  if echo "$kong_code" | grep -qE '^(200|301|302|401|403|404)$'; then
    check_status "Supabase Kong (localhost:54321)" "OK" "HTTP ${kong_code}"
  else
    check_status "Supabase Kong (localhost:54321)" "FAIL" "HTTP ${kong_code}" || ((local_issues++))
  fi
  
  print_subsection "Docker Containers:"
  if docker ps >/dev/null 2>&1; then
    local container_count
    container_count=$(docker ps --format '{{.Names}}' | grep -c "supabase_" || echo "0")
    if [[ "$container_count" -gt 0 ]]; then
      check_status "Supabase containers" "OK" "${container_count} running"
      echo ""
      docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | grep -E "(NAMES|supabase_)" | sed 's/^/    /'
    else
      check_status "Supabase containers" "WARN" "none running" || ((local_issues++))
    fi
  else
    check_status "Docker" "FAIL" "not available" || ((local_issues++))
  fi
  
  echo ""
  if [[ $local_issues -eq 0 ]]; then
    echo -e "  ${GREEN}✅ Local environment OK${NC}"
  else
    echo -e "  ${YELLOW}⚠️  Local: ${local_issues} issue(s)${NC}"
  fi
  
  return $local_issues
}

# ============================================================
# STAGING ENVIRONMENT CHECKS
# ============================================================
check_staging_environment() {
  print_section "STAGING ENVIRONMENT (MiniPC - taliahub.com)"
  
  local staging_issues=0
  
  if $IS_ON_STAGING; then
    echo -e "  ${BLUE}Source:${NC} localhost (on staging server)"
    echo -e "  ${BLUE}Target:${NC} Direct local checks"
    echo ""
    
    if [[ -f "${SCRIPT_DIR}/validate-staging-local.sh" ]]; then
      "${SCRIPT_DIR}/validate-staging-local.sh" $EXTRA_ARGS 2>&1 | sed 's/^/  /'
      staging_issues=$?
    elif [[ -f "/home/zomarc/talia-docker/scripts/validate-staging-local.sh" ]]; then
      "/home/zomarc/talia-docker/scripts/validate-staging-local.sh" $EXTRA_ARGS 2>&1 | sed 's/^/  /'
      staging_issues=$?
    fi
  else
    echo -e "  ${BLUE}Source:${NC} ${HOSTNAME} (remote)"
    echo -e "  ${BLUE}Target:${NC} ${STAGING_USER}@${STAGING_HOST}"
    echo ""
    
    print_subsection "Connectivity:"
    
    if ssh -o ConnectTimeout=5 -o BatchMode=yes "${STAGING_USER}@${STAGING_HOST}" "echo ok" >/dev/null 2>&1; then
      check_status "SSH connection" "OK" "connected"
      
      if [[ -f "${SCRIPT_DIR}/validate-staging-connectivity.sh" ]]; then
        echo ""
        "${SCRIPT_DIR}/validate-staging-connectivity.sh" $EXTRA_ARGS 2>&1 | tail -n +5 | sed 's/^/  /'
        staging_issues=$?
      fi
      
      print_subsection "Docker Containers:"
      ssh "${STAGING_USER}@${STAGING_HOST}" "cd '${STAGING_DIR}' && docker compose -f docker-compose.staging.yml ps --format 'table {{.Name}}\t{{.Status}}'" 2>/dev/null | sed 's/^/    /' || true
      
    else
      check_status "SSH connection" "FAIL" "cannot connect to ${STAGING_HOST}" || ((staging_issues++))
      echo ""
      echo -e "  ${YELLOW}Troubleshooting:${NC}"
      echo "    1. Check MiniPC is powered on"
      echo "    2. ping ${STAGING_HOST}"
      echo "    3. ssh ${STAGING_USER}@${STAGING_HOST}"
    fi
  fi
  
  return $staging_issues
}

# ============================================================
# MAIN
# ============================================================
print_header "TALIA ENVIRONMENT VALIDATION"

TOTAL_ISSUES=0

# Run performance first if requested standalone
if ! $CHECK_LOCAL && ! $CHECK_STAGING && $CHECK_PERF; then
  check_performance || TOTAL_ISSUES=$((TOTAL_ISSUES + $?))
  print_summary $TOTAL_ISSUES
  exit $TOTAL_ISSUES
fi

# Local checks (skip if on staging)
if $CHECK_LOCAL && ! $IS_ON_STAGING; then
  check_local_environment || TOTAL_ISSUES=$((TOTAL_ISSUES + $?))
fi

# Staging checks
if $CHECK_STAGING; then
  check_staging_environment || TOTAL_ISSUES=$((TOTAL_ISSUES + $?))
fi

# Performance tests (unless --quick)
if $CHECK_PERF && ! $QUICK_MODE; then
  check_performance || TOTAL_ISSUES=$((TOTAL_ISSUES + $?))
fi

print_summary $TOTAL_ISSUES
exit $TOTAL_ISSUES
