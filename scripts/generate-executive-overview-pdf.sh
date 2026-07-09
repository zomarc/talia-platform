#!/usr/bin/env bash
#
# Regenerate the branded executive overview PDF from docs/EXECUTIVE-OVERVIEW.html
# (Chrome headless — landscape, edge-to-edge dark theme).
#
# Usage:
#   ./scripts/generate-executive-overview-pdf.sh
#   ./scripts/validate executive-overview-pdf
#   npm run generate:overview:pdf
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

HTML_SOURCE="${ROOT_DIR}/docs/EXECUTIVE-OVERVIEW.html"
HTML_PUBLIC="${ROOT_DIR}/talia-ui/public/executive-overview.html"
PDF_OUTPUT="${ROOT_DIR}/docs/EXECUTIVE-OVERVIEW.pdf"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'
DIM=$'\033[2m'
BOLD=$'\033[1m'
NC=$'\033[0m'

find_chrome() {
  local candidate
  for candidate in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
    "google-chrome" \
    "google-chrome-stable" \
    "chromium" \
    "chromium-browser"
  do
    if command -v "$candidate" >/dev/null 2>&1; then
      command -v "$candidate"
      return 0
    fi
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

main() {
  echo ""
  echo -e "${CYAN}${BOLD}Executive overview PDF${NC}"
  echo -e "${DIM}────────────────────────────────────────────────────────────${NC}"

  if [[ ! -f "$HTML_SOURCE" ]]; then
    echo -e "${RED}✗ Source HTML not found: ${HTML_SOURCE}${NC}"
    exit 1
  fi

  local chrome_bin
  if ! chrome_bin="$(find_chrome)"; then
    echo -e "${RED}✗ No Chrome/Chromium found for headless PDF export.${NC}"
    echo ""
    echo "Install Google Chrome, or on macOS ensure:"
    echo "  /Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    echo ""
    echo "Manual fallback: open docs/EXECUTIVE-OVERVIEW.html → Print → Save as PDF"
    echo "  (enable Background graphics; landscape)"
    exit 1
  fi

  echo -e "${DIM}Source:${NC}  ${HTML_SOURCE}"
  echo -e "${DIM}Chrome:${NC}  ${chrome_bin}"
  echo ""

  if command -v node >/dev/null 2>&1; then
    if node "${SCRIPT_DIR}/inject-executive-overview-commits.mjs"; then
      echo -e "  ${GREEN}✓${NC} Injected git commit summary into HTML"
    else
      echo -e "  ${YELLOW}!${NC} Could not inject commit summary (continuing with existing HTML)"
    fi
    echo ""
  else
    echo -e "  ${YELLOW}!${NC} node not found — skipped commit summary injection"
    echo ""
  fi

  mkdir -p "$(dirname "$HTML_PUBLIC")" "$(dirname "$PDF_OUTPUT")"
  cp "$HTML_SOURCE" "$HTML_PUBLIC"
  echo -e "  ${GREEN}✓${NC} Synced public copy → talia-ui/public/executive-overview.html"

  local file_url="file://${HTML_SOURCE}"
  if ! "$chrome_bin" \
    --headless=new \
    --disable-gpu \
    --no-pdf-header-footer \
    --print-to-pdf="$PDF_OUTPUT" \
    "$file_url" 2>/dev/null; then
    echo -e "  ${RED}✗${NC} Chrome headless PDF export failed"
    exit 1
  fi

  if [[ ! -f "$PDF_OUTPUT" ]]; then
    echo -e "  ${RED}✗${NC} PDF was not created: ${PDF_OUTPUT}"
    exit 1
  fi

  local size_kb
  size_kb="$(du -k "$PDF_OUTPUT" | awk '{print $1}')"
  echo -e "  ${GREEN}✓${NC} Wrote PDF (${size_kb} KB)"

  # Publish the HTML into the Talia database (project_summary) so the in-app
  # "Project Summary" panel shows the latest. Non-fatal if DB is unreachable.
  if command -v node >/dev/null 2>&1; then
    if node "${SCRIPT_DIR}/publish-project-summary.mjs"; then
      echo -e "  ${GREEN}✓${NC} Published summary to database (project_summary)"
    else
      echo -e "  ${YELLOW}!${NC} Could not publish to database (is Supabase up + migration applied?)"
      echo -e "    ${DIM}Retry later: node scripts/publish-project-summary.mjs${NC}"
    fi
  else
    echo -e "  ${YELLOW}!${NC} node not found — skipped database publish"
  fi
  echo ""
  echo -e "${BOLD}Outputs${NC}"
  echo -e "  PDF:  ${PDF_OUTPUT}"
  echo -e "  HTML: ${HTML_SOURCE}"
  echo -e "  Dev:  http://localhost:5173/executive-overview.html ${DIM}(when UI dev server is running)${NC}"
  echo ""
  echo -e "${YELLOW}Note:${NC} Edit ${DIM}docs/EXECUTIVE-OVERVIEW.html${NC} then re-run this command to refresh."
  echo -e "${DIM}Future:${NC} JIRA board page can be appended as an additional section/page."
  echo ""
}

main "$@"
