#!/usr/bin/env bash
#
# Non-destructive sync: copy ui_appearance theme registry + optional per-user appearance
# rows from a source Supabase (local) to a target (staging). Only upserts listed keys;
# no table drops, truncates, or unrelated data changes.
#
# Env (typical: source from talia-server/.env, target from your staging env):
#   SOURCE_SUPABASE_URL   default http://127.0.0.1:54321
#   SOURCE_SUPABASE_KEY   anon or service role for source
#   TARGET_SUPABASE_URL   staging Kong URL, e.g. http://192.168.1.120:8000
#   TARGET_SUPABASE_KEY   anon or service role for target
#
# Optional:
#   SYNC_APPEARANCE_USER_IDS   comma-separated Talia user ids (talia_user_id, e.g. 1000,1001) to also sync
#                              current_settings:<id>, profiles:<id>, active_profile_id:<id>
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

SOURCE_SUPABASE_URL="${SOURCE_SUPABASE_URL:-http://127.0.0.1:54321}"
TARGET_SUPABASE_URL="${TARGET_SUPABASE_URL:-}"
SOURCE_SUPABASE_KEY="${SOURCE_SUPABASE_KEY:-}"
TARGET_SUPABASE_KEY="${TARGET_SUPABASE_KEY:-}"
SYNC_APPEARANCE_USER_IDS="${SYNC_APPEARANCE_USER_IDS:-}"

if [[ -f "${ROOT_DIR}/talia-server/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ROOT_DIR}/talia-server/.env"
  set +a
  SOURCE_SUPABASE_URL="${SOURCE_SUPABASE_URL:-${SUPABASE_URL:-http://127.0.0.1:54321}}"
  SOURCE_SUPABASE_KEY="${SOURCE_SUPABASE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_ANON_KEY:-}}}"
fi

if [[ -z "${TARGET_SUPABASE_URL}" || -z "${TARGET_SUPABASE_KEY}" ]]; then
  echo "TARGET_SUPABASE_URL and TARGET_SUPABASE_KEY must be set for staging." >&2
  echo "SOURCE defaults from talia-server/.env when present." >&2
  exit 1
fi

if [[ -z "${SOURCE_SUPABASE_KEY}" ]]; then
  echo "SOURCE_SUPABASE_KEY (or talia-server/.env SUPABASE_* key) is required." >&2
  exit 1
fi

export SOURCE_SUPABASE_URL SOURCE_SUPABASE_KEY TARGET_SUPABASE_URL TARGET_SUPABASE_KEY SYNC_APPEARANCE_USER_IDS

python3 <<'PY'
import json
import os
import sys
import urllib.error
import urllib.request

def rest_get(base: str, key: str, query: str):
    url = f"{base.rstrip('/')}/rest/v1/config_setting?{query}"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())

def rest_upsert(base: str, key: str, rows: list):
    if not rows:
        return
    url = f"{base.rstrip('/')}/rest/v1/config_setting"
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
        with urllib.request.urlopen(req, timeout=120) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")
        print(f"HTTP {e.code} upserting to {base}: {detail}", file=sys.stderr)
        raise

def main():
    src_url = os.environ["SOURCE_SUPABASE_URL"]
    src_key = os.environ["SOURCE_SUPABASE_KEY"]
    tgt_url = os.environ["TARGET_SUPABASE_URL"]
    tgt_key = os.environ["TARGET_SUPABASE_KEY"]
    extra_users = [
        u.strip()
        for u in os.environ.get("SYNC_APPEARANCE_USER_IDS", "").split(",")
        if u.strip()
    ]

    keys = ["theme_registry", "theme_asset_overrides"]
    for uid in extra_users:
        keys.extend([
            f"current_settings:{uid}",
            f"profiles:{uid}",
            f"active_profile_id:{uid}",
        ])

    # PostgREST `in` filter
    in_list = "(" + ",".join(keys) + ")"
    query = f"category=eq.ui_appearance&setting_key=in.{in_list}"

    try:
        rows = rest_get(src_url, src_key, query)
    except urllib.error.HTTPError as e:
        print(f"Failed to read source: HTTP {e.code} {e.read().decode()}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Failed to reach source Supabase: {e}", file=sys.stderr)
        sys.exit(1)

    if not rows:
        print("No matching ui_appearance rows on source; nothing to sync.")
        sys.exit(0)

    payload = []
    for row in rows:
        payload.append({
            "category": row["category"],
            "setting_key": row["setting_key"],
            "setting_value": row["setting_value"],
            "display_name": row.get("display_name"),
            "description": row.get("description"),
            "is_editable": row.get("is_editable", True),
        })

    print(f"Upserting {len(payload)} row(s) onto target (non-destructive merge)...")
    rest_upsert(tgt_url, tgt_key, payload)
    print("Done.")

if __name__ == "__main__":
    main()
PY
