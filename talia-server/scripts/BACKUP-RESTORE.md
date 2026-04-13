# Database Backup & Restore Guide

Quick reference for backing up and restoring the Supabase database.

## Quick Start

### Backup
```bash
npm run db-backup
```

### Restore
```bash
npm run db-restore <backup-file>
```

## Detailed Usage

### Creating a Backup

The backup script creates a compressed SQL dump of the entire database:

```bash
# From talia-server directory
npm run db-backup

# Or directly
./scripts/backup-db.sh
```

**What it does:**
- Requires local Postgres (Supabase CLI `supabase status` must be OK if CLI is installed)
- Runs a **size guard**: aborts if any table in `public` or `talia_config` exceeds **100 MiB** on disk (configurable); tables listed in `BACKUP_EXCLUDE_TABLE_DATA` are **ignored** by the guard (their row data is not dumped)
- Dumps with **`pg_dump`**, **excluding row data** for `public.published_rates_changes` by default (schema still present)
- Compresses with gzip → `backups/supabase_backup_YYYYMMDD_HHMMSS.sql.gz`

**Environment overrides:**
- `BACKUP_EXCLUDE_TABLE_DATA` — space-separated `schema.table` (default includes `public.published_rates_changes`)
- `BACKUP_MAX_RELATION_BYTES` — guard threshold (default `104857600`)
- `BACKUP_GUARD_SCHEMAS` — schemas checked (default `public talia_config`)
- `BACKUP_SKIP_SIZE_GUARD=1` — disable the failsafe (not recommended)

**Example output:**
```
=== Supabase Database Backup ===

Database: postgres
Host: 127.0.0.1:54322
Backup file: backups/supabase_backup_20251125_143022.sql

Creating backup...
Compressing backup...

✓ Backup completed successfully!
  File: backups/supabase_backup_20251125_143022.sql.gz
  Size: 2.3M
```

### Restoring from Backup

**⚠️ WARNING: This will replace ALL data in the database!**

```bash
# List available backups first
ls backups/

# Restore from backup
npm run db-restore backups/supabase_backup_20251125_143022.sql.gz

# Or just the filename
npm run db-restore supabase_backup_20251125_143022.sql.gz
```

The restore script will:
1. Ask for confirmation before proceeding
2. Decompress the backup if needed
3. Restore the database schema and data
4. Show success/failure status

## Prerequisites

PostgreSQL client tools must be installed:

- **macOS**: `brew install postgresql`
- **Ubuntu/Debian**: `sudo apt-get install postgresql-client`
- **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)

Verify installation:
```bash
which pg_dump
which psql
```

## When backups jump to hundreds of MB

`backup-db.sh` / `supabase db dump --local` dumps **every** schema and **all** row data. The usual cause of a **~30MB → ~400MB+** jump is **`public.published_rates_changes`**: it stores one row per detected published-rate change during syncs and can reach **tens of millions of rows**. That table is audit/history; **`published_rates_current_state`** holds the latest snapshot for comparisons.

**Inspect locally (sizes + exact row count):**
```bash
./scripts/db-inspect-local.sh
```

**See which tables dominate a `.sql.gz` backup:**
```bash
./scripts/db-inspect-backup-gz.sh path/to/backup.sql.gz
```

**Smaller MVP / dev restore (schema + all data except that table’s rows):**
```bash
./scripts/backup-core-for-mvp.sh
# optional: EXCLUDE_TABLE_DATA="public.published_rates_changes public.other_table" ./scripts/backup-core-for-mvp.sh
```

Restore to Azure MVP with `./scripts/restore-db-to-mvp.sh` as usual. To **shrink the live DB**, you can `TRUNCATE public.published_rates_changes` (or archive then truncate) after you no longer need that history—**back up first**.

## Troubleshooting

### "pg_dump: command not found"
Install PostgreSQL client tools (see Prerequisites above).

### "Cannot connect to database"
Ensure Supabase is running:
```bash
cd talia-server
supabase start
supabase status
```

### "Permission denied"
Make scripts executable:
```bash
chmod +x scripts/backup-db.sh scripts/restore-db.sh
```

### Backup file not found
Check the backups directory:
```bash
ls -lh backups/
```

## Best Practices

1. **Create backups before migrations**: Always backup before running `supabase migration up`
2. **Regular backups**: Create backups after major data syncs or important changes
3. **Version backups**: Keep multiple backups with descriptive names if needed
4. **Test restores**: Periodically test restoring from backups to ensure they work
5. **Store safely**: Backups are excluded from git, but consider storing important backups elsewhere

## Backup File Format

- **Format**: Plain SQL dump compressed with gzip
- **Includes**: Schema, data, indexes, constraints, functions, triggers
- **Excludes**: Ownership and ACL information (for portability)
- **Size**: Often tens of MB compressed for a normal app dataset; **hundreds of MB** usually means huge sync history (see *When backups jump to hundreds of MB* above)

## Configuration

The scripts use these default settings (from `supabase/config.toml`):
- Host: `127.0.0.1`
- Port: `54322`
- Database: `postgres`
- User: `postgres`
- Password: `postgres`

To modify these, edit the variables at the top of the script files.

## Multi-environment restores (local, staging, MVP)

Each environment must stay **self-consistent**: the same secrets power Postgres roles, JWT signing, and the browser/UI build.

### 1. Secrets and URLs (per instance)

| Item | Why it matters |
|------|----------------|
| `POSTGRES_PASSWORD` | `authenticator`, `supabase_admin`, etc. connect with this. If you clone data from another machine but the **cluster** was initialized with a different password, PostgREST can fail → Kong returns 502 → GraphQL shows *invalid response from the upstream server*. |
| `SUPABASE_JWT_SECRET` | Must match the signing key used to generate `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Baked into the UI image at build time. The URL must be whatever the **browser** uses to reach Kong (e.g. `http://MVP_IP:54321`), not another host. |
| `SUPABASE_URL` in `graphql-server` | In Docker this is usually `http://supabase-kong:8000` (internal); leave as compose default. |

**Practical rule:** For a **new** VM, pick one `POSTGRES_PASSWORD` and `SUPABASE_JWT_SECRET`, generate matching JWT keys (Supabase docs / CLI), put them in that env’s `.env.staging`, **rebuild the UI** so `VITE_*` match, then restore. Cloning only the `postgres` database from local is fine if the **target** cluster roles already match that env’s password (typical when the DB was always on that VM and you only replace data).

### 2. Postgres major version

Source and target should share the **same major** Postgres (or use `BACKUP_COMPAT_PG15=1` when dumping from PG17 for a PG15 stack, as in `./scripts/backup-core-for-mvp.sh`).

### 3. After restore (API health)

**Role passwords:** PostgREST connects as `authenticator` using `PGRST_DB_URI`, which embeds `POSTGRES_PASSWORD` from compose. A restored dump can leave **role password hashes** out of sync with that URI (or your `.env.staging` may omit `POSTGRES_PASSWORD`, so every service uses the compose default while the data directory was first initialized with something else). Symptom: GraphQL / Supabase errors like *invalid response from the upstream server* and PostgREST logs show `password authentication failed for user "authenticator"`.

Run on the Docker host (repo includes the script):

```bash
./scripts/supabase/align-db-role-passwords.sh --from-running-postgrest
./scripts/supabase/write-postgres-password-from-postgrest-to-env.sh .env.staging
```

The first command reads the password from the running PostgREST container and applies it to `authenticator`, `supabase_auth_admin`, `supabase_storage_admin`, and `supabase_admin` via `supabase_admin`. The second persists `POSTGRES_PASSWORD` into `.env.staging` so future `docker compose` runs stay consistent. `scripts/restore-db-to-mvp.sh` runs both when those scripts are present on the server.

**Caches:** Large DDL restores can leave PostgREST’s schema cache stale. The same restore script restarts `supabase-rest`, `supabase-kong`, and `graphql-server`. If you restore manually, run the align step above, then those restarts.

**Quick checks on the host:**

```bash
docker logs talia-supabase-rest --tail 80
docker exec talia-graphql-server wget -qO- http://supabase-kong:8000/rest/v1/  | head
```

### 4. Kong `kong.yml` and storage

`supabase/kong.yml` pins demo **key-auth** credentials for storage. If you rotate anon keys in `.env.staging`, align Kong or storage calls can fail (REST for app tables usually still works via JWT).

### 5. Backup flavours

- **`./scripts/backup-core-for-mvp.sh`** — portable “core” dump: excludes huge tables, `--clean` for reload, PG15 preamble strip when needed.
- **Full** local backup — use `./scripts/backup-db.sh` when you need all row data and accept size guard / excludes.

### 6. Separate but operational

- **Local:** `supabase start` + `talia-server` `.env` pointing at `127.0.0.1:54322`.
- **Staging / MVP:** one `.env.staging` (or named copy) **per machine**, public URLs for `VITE_*`, NSG/firewall for Kong/UI ports, then restore from the artefact built for that Postgres major.














