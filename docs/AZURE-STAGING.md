# Azure staging (Ubuntu VM + Docker)

This runbook matches the repo layout: [`docker-compose.staging.yml`](../docker-compose.staging.yml) (Supabase + GraphQL + UI), optional TLS via Caddy in [`infra/azure/`](../infra/azure/), and automation in [`scripts/deploy-to-azure-staging.sh`](../scripts/deploy-to-azure-staging.sh).

## 1. Provision the VM

Prerequisites: [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) logged in (`az login`), an SSH key pair.

From the repo:

```bash
cd infra/azure
chmod +x deploy-vm.sh   # if needed
./deploy-vm.sh talia-staging-rg eastus
```

Optional environment variables:

- `VM_SIZE` — default in Bicep is `Standard_D4s_v5` (4 vCPU / 16 GiB RAM).
- `ADMIN_SSH_SOURCE_CIDR` — set to `203.0.113.4/32` (your public IP) to avoid exposing SSH globally. If unset, the script tries `https://ifconfig.me/ip` and otherwise falls back to `*`.
- `SSH_KEY_FILE` — path to your public key (default `~/.ssh/id_rsa.pub`).
- `VM_NAME` — VM resource name (default `talia-staging`).

The template creates a VNet, NSG (inbound **22**, **80**, **443** only), public IP, and Ubuntu 22.04 LTS VM with your SSH key. Note the output **publicIpAddress** and optional **fqdn**.

## 2. Install Docker on the VM

```bash
scp scripts/azure/install-docker.sh "${USER}@${VM_IP}:~/"
ssh "${USER}@${VM_IP}" 'sudo bash ~/install-docker.sh'
```

Add your user to the `docker` group (log out and back in after):

```bash
ssh "${USER}@${VM_IP}" 'sudo usermod -aG docker "$USER"'
```

## 3. Copy the app tree and configure `.env.staging`

```bash
ssh "${USER}@${VM_IP}"
sudo apt-get update && sudo apt-get install -y git
# Place the monorepo on the VM (same tree you ship with deploy-to-staging / deploy-to-mvp).
cd talia-docker
cp .env.staging.example .env.staging
```

Edit `.env.staging`:

- Set **public URLs** to how users reach the VM (HTTP + ports, or HTTPS hostname with Caddy in the next section).
- Set **POSTGRES_PASSWORD**, **SUPABASE_JWT_SECRET**, and JWT keys (**SUPABASE_ANON_KEY**, **SUPABASE_SERVICE_ROLE_KEY**) for a **new** environment (do not reuse committed demo values for anything sensitive).
- Extend **GOTRUE_URI_ALLOW_LIST** with your UI origins if you use auth redirects.
- For **Celestyal Entra OIDC**, set `GOTRUE_EXTERNAL_AZURE_*`, `GOTRUE_SITE_URL`, `GOTRUE_DISABLE_SIGNUP=true`, and UI flags `VITE_AUTH_MODE=oidc` (see [D014-CELESTYAL-SSO-HANDOFF.md](./D014-CELESTYAL-SSO-HANDOFF.md) §8).

**Without Caddy (HTTP only):** use `http://<PUBLIC_IP>:54321` for `SUPABASE_PUBLIC_URL` and `VITE_SUPABASE_URL`, and `http://<PUBLIC_IP>:4000/graphql` for `VITE_GRAPHQL_ENDPOINT`. Ensure any cloud firewall allows those ports if you need them from the internet (the provided NSG only opens 80/443 by default).

**With Caddy (HTTPS on 443):** use one hostname (DNS **A** record to the VM IP). Set `TALIA_TLS_DOMAIN`, `SUPABASE_PUBLIC_URL`, `VITE_SUPABASE_URL`, and `VITE_GRAPHQL_ENDPOINT` to `https://<hostname>` (GraphQL path should be `/api/graphql` so the UI nginx proxies to the API). For public DNS, comment out the `tls internal` line in [`infra/azure/Caddyfile`](../infra/azure/Caddyfile) so Caddy obtains a Let’s Encrypt certificate.

## 4. Start the stack

From the repo root on the VM:

```bash
cd ~/talia-docker
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d
```

With Caddy:

```bash
docker compose --env-file .env.staging \
  -f docker-compose.staging.yml \
  -f infra/azure/docker-compose.caddy.yml up -d
```

Check status:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml ps
```

## 5. Deploy updates from your laptop

In [`scripts/config/targets.env`](../scripts/config/targets.env), set:

- `AZURE_STAGING_HOST` — VM IP or DNS name  
- `AZURE_STAGING_USER` — SSH user (often `azureuser`)  
- `AZURE_STAGING_DIR` — app directory on the VM (default `/home/azureuser/talia-docker`)

Then:

```bash
# Stack restart / pull images (no rebuild)
AZURE_STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_AZURE_STACK ./scripts/deploy-to-azure-staging.sh

# Rebuild UI + GraphQL images after git pull
AZURE_STAGING_DEPLOY_CONFIRM_TOKEN=DEPLOY_AZURE_FULL ./scripts/deploy-to-azure-staging.sh --full

# Include Caddy in compose
./scripts/deploy-to-azure-staging.sh --with-caddy
```

The script requires `.env.staging` on the server and a git clone in `AZURE_STAGING_DIR`.

## 6. Synapse and CORS

- Allow the VM **outbound** IP in any Synapse or corporate firewall rules if the GraphQL server must reach Azure Synapse.
- If the browser reports CORS errors against Kong, update [`supabase/kong.yml`](../supabase/kong.yml) (or your Supabase gateway CORS settings) for your new origin.

## 7. MVP instance: copy local Supabase DB to Azure

The **mvp** environment is the personal Azure Docker host. Configure `MVP_*` in [`scripts/config/targets.env`](../scripts/config/targets.env). [`scripts/validate`](../scripts/validate) shows MVP UI / GraphQL / Kong when `MVP_VALIDATE=1` and `MVP_UI_HOST` is set.

**Code deploy ≠ database.** `deploy-to-mvp` ships UI/GraphQL images and applies a thin schema guard (`inventory_item`, `agency`, …). It does **not** copy row data. Panels like Distribution need a restore (below) or they fail with `relation "public.agency" does not exist` / empty tables.

After deploy, `./scripts/validate` → working target **MVP** → service check probes **Demo DB** (public table count + `agency` rows) and warns if thin.

**Backup locally** (Supabase running; `pg_dump`/`psql` on PATH):

```bash
./scripts/backup-local-db-for-mvp.sh
```

This runs [`talia-server/scripts/backup-db.sh`](../talia-server/scripts/backup-db.sh) (excludes **`published_rates_changes`** data, **size guard** on other large tables) and copies the dump to `backups/mvp/mvp-local-*.sql.gz`. Same logic with an `mvp-core-*` filename: `./scripts/backup-core-for-mvp.sh`.

Inspect a dump: `./scripts/db-inspect-backup-gz.sh backups/mvp/*.sql.gz`

**Restore on MVP** (overwrites Postgres in `talia-supabase-db`; stops other stack containers briefly):

```bash
./scripts/restore-db-to-mvp.sh
# or: ./scripts/restore-db-to-mvp.sh backups/mvp/mvp-local-YYYYMMDD_HHMMSS.sql.gz
```

Non-interactive: `RESTORE_MVP_CONFIRM=yes ./scripts/restore-db-to-mvp.sh <file.sql.gz>`.

PostgreSQL major versions must be compatible between local dump and the image in [`docker-compose.staging.yml`](../docker-compose.staging.yml). Review the remote `psql` output after restore; restart the stack if anything looks inconsistent.

## Files reference

| Path | Purpose |
|------|---------|
| [`infra/azure/main.bicep`](../infra/azure/main.bicep) | VM + VNet + NSG + public IP |
| [`infra/azure/deploy-vm.sh`](../infra/azure/deploy-vm.sh) | `az deployment group create` wrapper |
| [`scripts/azure/install-docker.sh`](../scripts/azure/install-docker.sh) | Docker Engine + Compose v2 on Ubuntu |
| [`infra/azure/docker-compose.caddy.yml`](../infra/azure/docker-compose.caddy.yml) | Caddy reverse proxy service |
| [`infra/azure/Caddyfile`](../infra/azure/Caddyfile) | Path routing to UI / Kong |
| [`.env.staging.example`](../.env.staging.example) | Environment template for staging |
| [`scripts/backup-local-db-for-mvp.sh`](../scripts/backup-local-db-for-mvp.sh) | Local Supabase dump → `backups/mvp/` |
| [`scripts/restore-db-to-mvp.sh`](../scripts/restore-db-to-mvp.sh) | Restore dump into MVP `talia-supabase-db` |
