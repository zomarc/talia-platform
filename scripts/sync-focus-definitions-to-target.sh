#!/usr/bin/env bash
#
# Non-destructive sync: copy all rows from public.focuses on source Supabase to target (merge on id).
# Omits created_by (often no matching auth.users on target). No truncates or unrelated tables.
#
# Env:
#   SOURCE_SUPABASE_URL, SOURCE_SUPABASE_KEY — local (defaults from talia-server/.env)
#   TARGET_SUPABASE_URL, TARGET_SUPABASE_KEY — staging or MVP Kong + service role or anon
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

SOURCE_SUPABASE_URL="${SOURCE_SUPABASE_URL:-http://127.0.0.1:54321}"
TARGET_SUPABASE_URL="${TARGET_SUPABASE_URL:-}"
SOURCE_SUPABASE_KEY="${SOURCE_SUPABASE_KEY:-}"
TARGET_SUPABASE_KEY="${TARGET_SUPABASE_KEY:-}"

if [[ -f "${ROOT_DIR}/talia-server/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ROOT_DIR}/talia-server/.env"
  set +a
  SOURCE_SUPABASE_URL="${SOURCE_SUPABASE_URL:-${SUPABASE_URL:-http://127.0.0.1:54321}}"
  SOURCE_SUPABASE_KEY="${SOURCE_SUPABASE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_ANON_KEY:-}}}"
fi

if [[ -z "${TARGET_SUPABASE_URL}" || -z "${TARGET_SUPABASE_KEY}" ]]; then
  echo "TARGET_SUPABASE_URL and TARGET_SUPABASE_KEY must be set." >&2
  exit 1
fi
if [[ -z "${SOURCE_SUPABASE_KEY}" ]]; then
  echo "SOURCE_SUPABASE_KEY (or talia-server/.env SUPABASE_* key) is required." >&2
  exit 1
fi

export SOURCE_SUPABASE_URL SOURCE_SUPABASE_KEY TARGET_SUPABASE_URL TARGET_SUPABASE_KEY

python3 <<'PY'
import json
import os
import sys
import urllib.error
import urllib.request

FOCUS_COLUMNS = (
    "id",
    "name",
    "description",
    "type",
    "is_standard",
    "assigned_roles",
    "is_default",
    "is_active",
    "layout_data",
    "assigned_user_id",
    "created_at",
    "updated_at",
)


def rest_get_json(url: str, key: str):
    req = urllib.request.Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


def rest_post_upsert(base: str, key: str, path: str, rows: list):
    if not rows:
        return
    url = f"{base.rstrip('/')}/rest/v1/{path}"
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")
        print(f"HTTP {e.code} upserting to {url}: {detail}", file=sys.stderr)
        raise


def main():
    src_url = os.environ["SOURCE_SUPABASE_URL"].rstrip("/")
    src_key = os.environ["SOURCE_SUPABASE_KEY"]
    tgt_url = os.environ["TARGET_SUPABASE_URL"].rstrip("/")
    tgt_key = os.environ["TARGET_SUPABASE_KEY"]

    sel = ",".join(FOCUS_COLUMNS)
    q = f"{src_url}/rest/v1/focuses?select={sel}&limit=5000"
    try:
        rows = rest_get_json(q, src_key)
    except urllib.error.HTTPError as e:
        print(f"Failed to read source focuses: HTTP {e.code} {e.read().decode()}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Failed to reach source Supabase: {e}", file=sys.stderr)
        sys.exit(1)

    if not rows:
        print("No focuses on source; nothing to sync.")
        sys.exit(0)

    payload = []
    for row in rows:
        item = {k: row.get(k) for k in FOCUS_COLUMNS}
        payload.append(item)

    print(f"Upserting {len(payload)} focus row(s) onto target (merge on id)...")
    rest_post_upsert(tgt_url, tgt_key, "focuses", payload)
    print("Done.")


if __name__ == "__main__":
    main()
PY
