#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -d node_modules ]]; then
  npm install
fi
exec npx tsx src/index.ts
