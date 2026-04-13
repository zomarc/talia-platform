#!/usr/bin/env bash
# Summarise which tables dominate a Supabase/pg_dump plain-SQL .sql.gz backup.
# Usage: ./scripts/db-inspect-backup-gz.sh [path/to/file.sql.gz]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILE="${1:-}"
if [[ -z "$FILE" ]]; then
  FILE="$(ls -t "${ROOT_DIR}/backups/mvp"/*.sql.gz 2>/dev/null | head -1 || true)"
fi
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: $0 <backup.sql.gz>" >&2
  exit 1
fi

echo "Inspecting backup (read-only scan of .sql.gz; does not run SQL): ${FILE}" >&2

python3 - "$FILE" <<'PY'
import gzip
import re
import sys
from collections import Counter

path = sys.argv[1]
insert_re = re.compile(r'^INSERT INTO\s+"([^"]+)"\."([^"]+)"')
c = Counter()
with gzip.open(path, "rt", encoding="utf-8", errors="replace") as f:
    for line in f:
        if not line.startswith("INSERT INTO"):
            continue
        m = insert_re.match(line)
        if m:
            c[f"{m.group(1)}.{m.group(2)}"] += 1

print(f"File: {path}")
print("INSERT batches per table (many batches ≈ multi-meg row chunks; compare counts):")
for name, n in c.most_common(30):
    print(f"  {n:6d}  {name}")
if not c:
    print("  (no INSERT INTO \"schema\".\"table\" lines found — format may differ)")
PY
