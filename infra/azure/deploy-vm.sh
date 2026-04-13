#!/usr/bin/env bash
# Provision Talia staging VM in Azure (Ubuntu 22.04 + NSG: 22 / 80 / 443).
# Prerequisites: az CLI logged in (az login), jq optional for pretty output.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RG="${1:-talia-staging-rg}"
LOCATION="${2:-eastus}"
VM_NAME="${VM_NAME:-talia-staging}"

SSH_KEY_FILE="${SSH_KEY_FILE:-$HOME/.ssh/id_rsa.pub}"
if [[ ! -f "$SSH_KEY_FILE" ]]; then
  echo "Missing SSH public key at $SSH_KEY_FILE. Set SSH_KEY_FILE or create a key." >&2
  exit 1
fi
SSH_PUBLIC_KEY="$(cat "$SSH_KEY_FILE")"

# Your current public IPv4 for SSH restriction (falls back to * with a warning)
if [[ "${ADMIN_SSH_SOURCE_CIDR:-}" == "" ]]; then
  if command -v curl >/dev/null 2>&1; then
    ME="$(curl -fsS --max-time 5 https://ifconfig.me/ip 2>/dev/null || true)"
    if [[ -n "$ME" ]]; then
      ADMIN_SSH_SOURCE_CIDR="${ME}/32"
      echo "Using SSH source restriction: $ADMIN_SSH_SOURCE_CIDR (from ifconfig.me)"
    fi
  fi
fi
if [[ "${ADMIN_SSH_SOURCE_CIDR:-}" == "" ]]; then
  ADMIN_SSH_SOURCE_CIDR='*'
  echo "Warning: SSH open to the world (0.0.0.0/0). Set ADMIN_SSH_SOURCE_CIDR=your.ip/32 for hardening." >&2
fi

az group create --name "$RG" --location "$LOCATION" --tags env=staging app=talia >/dev/null

echo "Deploying Bicep (VM size override: VM_SIZE=${VM_SIZE:-default})..."
DEPLOY_ARGS=(
  --resource-group "$RG"
  --template-file "${SCRIPT_DIR}/main.bicep"
  --parameters
  sshPublicKey="$SSH_PUBLIC_KEY"
  adminSshSourceCidr="$ADMIN_SSH_SOURCE_CIDR"
  vmName="$VM_NAME"
)
if [[ -n "${VM_SIZE:-}" ]]; then
  DEPLOY_ARGS+=(vmSize="$VM_SIZE")
fi

DEPLOY_JSON="${TMPDIR:-/tmp}/talia-azure-deploy.$$"
trap 'rm -f "${DEPLOY_JSON}"' EXIT
az deployment group create "${DEPLOY_ARGS[@]}" --output json >"${DEPLOY_JSON}"

if command -v jq >/dev/null 2>&1; then
  echo ""
  echo "Outputs:"
  jq -r '.properties.outputs | to_entries[] | "\(.key): \(.value.value)"' "${DEPLOY_JSON}"
else
  cat "${DEPLOY_JSON}"
fi

echo ""
echo "Next: ssh to the VM and run scripts/azure/install-docker.sh, then follow docs/AZURE-STAGING.md"
