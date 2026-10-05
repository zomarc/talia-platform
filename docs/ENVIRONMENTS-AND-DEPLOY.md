# Environments, deploys, and backups

## Three places code and data run

| Name | Where | Role |
|------|--------|------|
| **local** | Your laptop | Day-to-day development (`npm run dev`, local Docker, etc.). |
| **staging** | MiniPC on your LAN (`192.168.1.120` in default `targets.env`) | Integration testing on real hardware near you. |
| **mvp** | Azure VM (e.g. public IP in `MVP_SSH_HOST`) | Cloud-shaped test instance; same stack as staging, different host and secrets. |

**Staging** and **mvp** are updated only by **deploying from your laptop** (`deploy-to-staging.sh` / `deploy-to-mvp.sh`): tarball over SSH and compose on the host. There is no `git push` or remote pull in that path.

## How code reaches staging and MVP

- **Staging:** `./scripts/deploy-to-staging.sh` (default: `--ui-only` or `--full`)  
  Builds UI (and GraphQL for `--full`) **on your laptop**, ships a tarball + `dist` artifacts, applies them over SSH.

- **MVP:** `./scripts/deploy-to-mvp.sh` (same flags)  
  Same mechanism; sets `VITE_ENVIRONMENT=mvp` so the UI banner shows **mvp**, not a misleading **staging** label.

Optional: `deploy-to-azure-staging.sh` is a separate recipe for VMs that update via **their own** git remote (not part of the laptop tarball flow).

## Why MVP once looked “reverted” to old v0.1.1

1. **Git-on-VM deploys** (if used) reset the server to **whatever commit the VM’s remote had**, which could lag **your laptop** if you never deployed the tarball path.

2. **Pinned UI version in compose:** `docker-compose.staging.yml` used to hardcode `VITE_APP_VERSION: "0.1.1"` for image builds, so the corner version could stay **0.1.1** even when `package.json` was newer. That is now avoided: UI version comes from **`talia-ui/package.json`** at build time unless you override.

3. **Misleading “Source: STAGING”:** Production builds without `VITE_ENVIRONMENT` used to default the label to **staging** in the UI. Deploy scripts now set **`VITE_ENVIRONMENT=staging`** or **`mvp`** when building.

## Moving **business data** (Postgres) between instances

- Data lives in **Supabase Postgres** (application schemas + `talia_config`, etc.).
- Use **pg_dump / restore** (see `talia-server/scripts/BACKUP-RESTORE.md` and repo `scripts/restore-db-to-staging.sh`, `scripts/restore-db-to-mvp.sh`).
- After restore on a **new** host, align **role passwords** and **JWT-related env** with that host (`scripts/supabase/align-db-role-passwords.sh`, etc.). **Secrets do not travel** inside the dump the way your `.env` expects them.
- **Requirements Log** (`talia_requirement_item`) rides the same DB backup/restore. For a selective copy without a full restore, use **Export JSON / Import** on the Requirements Log panel (`RequirementsLogExport` pack: merge-by-id or create-new).

## Ops checks

- **`./scripts/validate`** — interactive menu; header shows **script version**, **UTC time**, and **local time** each run.
- **Working target** (`set-target local|staging|mvp`) scopes check/start/stop/deploy. It does **not** move `https://taliahub.com`.
- **Public presenter** is whoever currently holds the ngrok reserved domain (local process or MiniPC `ngrok-taliahub`). **MVP** is reached only via `MVP_UI_URL` (Azure IP:ports in `targets.env`), never via validate ngrok.
- **Data Management → Instance & keys** — shows **GraphQL server version**, **validate script doc version** (must match `SCRIPT_VERSION` in `scripts/validate`), and **UI build** (`VITE_*`). Use this on **local, staging, and MVP** to confirm you are on the build you expect.

When the validate menu / Instance cross-check contract changes, bump the **same** token in both `SCRIPT_VERSION` (`scripts/validate`) and `VALIDATE_SCRIPT_DOC_VERSION` (`instanceConnectionResolvers.ts`) — use a neutral monotonic value (e.g. `ops-4`), not calendar dates.
