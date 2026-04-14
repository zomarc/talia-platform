# Environments, deploys, and backups

## Three places code and data run

| Name | Where | Role |
|------|--------|------|
| **local** | Your laptop | Day-to-day development (`npm run dev`, local Docker, etc.). |
| **staging** | MiniPC on your LAN (`192.168.1.120` in default `targets.env`) | Integration testing on real hardware near you. |
| **mvp** | Azure VM (e.g. public IP in `MVP_SSH_HOST`) | Cloud-shaped test instance; same stack as staging, different host and secrets. |

None of these names imply GitHub. **Staging** and **mvp** are updated by **deploying from your laptop** with the scripts below, not by “mystery” remote git unless you explicitly use the optional git-based script.

## How code reaches staging and MVP

- **Staging:** `./scripts/deploy-to-staging.sh` (default: `--ui-only` or `--full`)  
  Builds UI (and GraphQL for `--full`) **on your laptop**, ships a tarball + `dist` artifacts, applies them over SSH. **No GitHub required.**

- **MVP:** `./scripts/deploy-to-mvp.sh` (same flags)  
  Same mechanism; sets `VITE_ENVIRONMENT=mvp` so the UI banner shows **mvp**, not a misleading **staging** label.

Optional legacy path: `deploy-to-azure-staging.sh` only if the VM has its **own git clone** and you **want** `git pull` there.

## Why MVP once looked “reverted” to old v0.1.1

1. **Git-on-VM deploys** reset the server to **whatever was on GitHub**. If **`git push` failed**, GitHub stayed old while your laptop was new — the VM correctly matched **stale GitHub**, not your laptop.

2. **Pinned UI version in compose:** `docker-compose.staging.yml` used to hardcode `VITE_APP_VERSION: "0.1.1"` for image builds, so the corner version could stay **0.1.1** even when `package.json` was newer. That is now avoided: UI version comes from **`talia-ui/package.json`** at build time unless you override.

3. **Misleading “Source: STAGING”:** Production builds without `VITE_ENVIRONMENT` used to default the label to **staging** in the UI. Deploy scripts now set **`VITE_ENVIRONMENT=staging`** or **`mvp`** when building.

## Moving **business data** (Postgres) between instances

- Data lives in **Supabase Postgres** (application schemas + `talia_config`, etc.).
- Use **pg_dump / restore** (see `talia-server/scripts/BACKUP-RESTORE.md` and repo `scripts/restore-db-to-staging.sh`, `scripts/restore-db-to-mvp.sh`).
- After restore on a **new** host, align **role passwords** and **JWT-related env** with that host (`scripts/supabase/align-db-role-passwords.sh`, etc.). **Secrets do not travel** inside the dump the way your `.env` expects them.

## Ops checks

- **`./scripts/validate`** — interactive menu; header shows **script version**, **UTC time**, and **local time** each run.
- **Data Management → Instance & keys** — shows **GraphQL server version**, **validate script doc version** (must match `SCRIPT_VERSION` in `scripts/validate`), and **UI build** (`VITE_*`). Use this on **local, staging, and MVP** to confirm you are on the build you expect.

When the validate menu / Instance cross-check contract changes, bump the **same** token in both `SCRIPT_VERSION` (`scripts/validate`) and `VALIDATE_SCRIPT_DOC_VERSION` (`instanceConnectionResolvers.ts`) — use a neutral monotonic value (e.g. `ops-4`), not calendar dates.
