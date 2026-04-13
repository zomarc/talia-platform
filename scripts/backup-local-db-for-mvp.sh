#!/usr/bin/env bash
# Dump local Supabase DB for MVP restore — same rules as backup-core-for-mvp.sh (large tables excluded).
# Prerequisite: local Postgres reachable (Supabase: talia-server stack / supabase_db_talia-server).
#
# Inspect: ./scripts/db-inspect-backup-gz.sh backups/mvp/mvp-local-*.sql.gz
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

export BACKUP_MVP_FILENAME_PREFIX=mvp-local
exec "${ROOT_DIR}/scripts/backup-core-for-mvp.sh"
