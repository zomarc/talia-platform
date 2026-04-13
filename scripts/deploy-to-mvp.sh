#!/usr/bin/env bash
# Git pull + docker compose on the MVP Azure host (same flow as deploy-to-azure-staging.sh).
# Configure MVP_SSH_* in scripts/config/targets.env.
#
# Usage:
#   ./scripts/deploy-to-mvp.sh [--full] [--with-caddy] [--dry-run]
#
# Non-interactive:
#   AZURE_STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_AZURE_FULL ./scripts/deploy-to-mvp.sh --full

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config/targets.env"
if [[ -f "${CONFIG_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CONFIG_FILE}"
fi

export AZURE_STAGING_USER="${MVP_SSH_USER:-azureuser}"
export AZURE_STAGING_HOST="${MVP_SSH_HOST:-}"
export AZURE_STAGING_DIR="${MVP_APP_DIR:-/home/${AZURE_STAGING_USER}/talia-docker}"

if [[ -z "$AZURE_STAGING_HOST" ]]; then
  echo "Set MVP_SSH_HOST in scripts/config/targets.env (or export it)." >&2
  exit 1
fi

exec "${SCRIPT_DIR}/deploy-to-azure-staging.sh" "$@"
