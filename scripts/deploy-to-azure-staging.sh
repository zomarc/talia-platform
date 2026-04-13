#!/usr/bin/env bash
# Optional: deploy from a VM that has a git clone — git pull origin + docker compose.
# For day-to-day work, prefer local → host sync: ./scripts/deploy-to-staging.sh or ./scripts/deploy-to-mvp.sh
# Configure via scripts/config/targets.env (AZURE_STAGING_* vars) or environment variables.
#
# Usage:
#   ./scripts/deploy-to-azure-staging.sh [--full] [--with-caddy] [--dry-run]
#
# Non-interactive:
#   AZURE_STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_AZURE_FULL ./scripts/deploy-to-azure-staging.sh --full

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config/targets.env"
if [[ -f "${CONFIG_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CONFIG_FILE}"
fi

AZURE_STAGING_USER="${AZURE_STAGING_USER:-azureuser}"
AZURE_STAGING_HOST="${AZURE_STAGING_HOST:-}"
AZURE_STAGING_DIR="${AZURE_STAGING_DIR:-/home/${AZURE_STAGING_USER}/talia-docker}"
COMPOSE_FILES=(docker-compose.staging.yml)
WITH_CADDY=false
FULL=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --full) FULL=true; shift ;;
    --with-caddy) WITH_CADDY=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 [--full] [--with-caddy] [--dry-run]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$AZURE_STAGING_HOST" ]]; then
  echo "Set AZURE_STAGING_HOST (e.g. in scripts/config/targets.env) to the VM public IP or DNS name." >&2
  exit 1
fi

if [[ "$WITH_CADDY" == true ]]; then
  COMPOSE_FILES+=(infra/azure/docker-compose.caddy.yml)
fi

REMOTE_COMPOSE_BASE="docker compose --env-file .env.staging"
for f in "${COMPOSE_FILES[@]}"; do
  REMOTE_COMPOSE_BASE+=" -f ${f}"
done
if [[ "$FULL" == true ]]; then
  REMOTE_COMPOSE_UP="${REMOTE_COMPOSE_BASE} up -d --build"
else
  REMOTE_COMPOSE_UP="${REMOTE_COMPOSE_BASE} up -d"
fi
REMOTE_COMPOSE_PS="${REMOTE_COMPOSE_BASE} ps"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

CONFIRM_TOKEN="DEPLOY_AZURE_STACK"
if [[ "$FULL" == true ]]; then
  CONFIRM_TOKEN="DEPLOY_AZURE_FULL"
fi

if [[ "$DRY_RUN" == false ]]; then
  if [[ -n "${AZURE_STAGING_DEPLOY_CONFIRM_TOKEN:-}" ]]; then
    if [[ "$AZURE_STAGING_DEPLOY_CONFIRM_TOKEN" != "$CONFIRM_TOKEN" ]]; then
      echo -e "${RED}AZURE_STAGING_DEPLOY_CONFIRM_TOKEN must be ${CONFIRM_TOKEN}${NC}" >&2
      exit 1
    fi
  else
    if [[ ! -t 0 ]]; then
      echo -e "${RED}Interactive confirmation required, or set AZURE_STAGING_DEPLOY_CONFIRM_TOKEN=${CONFIRM_TOKEN}${NC}" >&2
      exit 1
    fi
    echo -e "${BLUE}Remote:${NC} ${AZURE_STAGING_USER}@${AZURE_STAGING_HOST}:${AZURE_STAGING_DIR}"
    echo -e "${BLUE}Command:${NC} ${REMOTE_COMPOSE_UP}"
    read -r -p "Type ${CONFIRM_TOKEN} to continue: " ans
    if [[ "$ans" != "$CONFIRM_TOKEN" ]]; then
      echo "Aborted." >&2
      exit 1
    fi
  fi
fi

SSH_TARGET="${AZURE_STAGING_USER}@${AZURE_STAGING_HOST}"

echo -e "${BLUE}Running remote deploy...${NC}"
if [[ "$DRY_RUN" == true ]]; then
  echo "cd ${AZURE_STAGING_DIR} && git fetch && git reset --hard origin/\$(git rev-parse --abbrev-ref HEAD) && ${REMOTE_COMPOSE_UP} && ${REMOTE_COMPOSE_PS}"
  exit 0
fi

TMP_SCRIPT="$(mktemp)"
{
  printf '%s\n' 'set -euo pipefail'
  printf 'cd %q\n' "${AZURE_STAGING_DIR}"
  printf '%s\n' 'if [[ ! -d .git ]]; then echo "No .git; clone the repo first (docs/AZURE-STAGING.md)." >&2; exit 1; fi'
  printf '%s\n' 'git fetch origin'
  printf '%s\n' 'git reset --hard "origin/$(git rev-parse --abbrev-ref HEAD)"'
  printf '%s\n' "$REMOTE_COMPOSE_UP"
  printf '%s\n' "$REMOTE_COMPOSE_PS"
} >"${TMP_SCRIPT}"
ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$SSH_TARGET" bash <"${TMP_SCRIPT}"
rm -f "${TMP_SCRIPT}"
echo -e "${GREEN}Done.${NC}"
