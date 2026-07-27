# AGENTS.md

## Cursor Cloud specific instructions

Talia Platform is a 3-tier local dev stack (see `README.md` / `README-DEVELOPMENT.md` for the product overview and standard commands):

- **talia-ui** — React + Vite frontend, dev server on **:5173**. Start: `cd talia-ui && npm run dev`.
- **talia-server** — Apollo GraphQL (**:4000/graphql**) + Express SSE (**:4001**). Start: `cd talia-server && npm run dev` (runs `tsx watch`, hot-reloads on `src/**`).
- **Supabase (local)** — Postgres/PostgREST/Auth/Studio. API **:54321**, DB **:54322**, Studio **:54323**. Runs in Docker via the Supabase CLI.

Vite proxies `/api/graphql` → `localhost:4000` and `/api/*/stream` → `localhost:4001`, so the UI must be reached at `http://localhost:5173` (not the backend directly).

### Dependencies
`npm install` at the repo root installs both workspaces (`talia-ui`, `talia-server`) — this is the update-script step. Do NOT run `npm test` (no `test` script exists in either workspace) and there is no backend `lint` script; only `cd talia-ui && npm run lint` exists (it runs, but the repo currently has many pre-existing eslint errors, so a non-zero exit is expected/normal).

### Startup sequence (not handled by the update script)
Docker + the Supabase CLI are system-level and are pre-installed in the VM snapshot; they are not reinstalled by the update script. Bring the stack up in this order:

1. **Docker daemon** (no systemd in the VM): `sudo dockerd > /tmp/dockerd.log 2>&1 &` then `sudo chmod 666 /var/run/docker.sock`. It uses `fuse-overlayfs` + iptables-legacy (already configured in `/etc/docker/daemon.json`).
2. **Supabase**: `cd talia-server && supabase start` (uses `talia-server/supabase/config.toml`, applies `supabase/migrations/*`, then `supabase/seed.sql`). Use `supabase status` for URLs/keys; `supabase db reset` re-applies migrations + seed.
3. **Backend**: `cd talia-server && npm run dev`.
4. **Frontend**: `cd talia-ui && npm run dev`.

Run long-lived processes (dockerd, supabase, the two dev servers) under tmux.

### Env files (git-ignored; recreate if missing)
- `talia-server/.env`: copy from `talia-server/.env.updated`, but set `SUPABASE_URL=http://127.0.0.1:54321` (the `.env.updated` default of `54323` is the Studio port and is wrong — PostgREST/API is `54321`). The legacy demo `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` in that file match the local CLI's issued keys, so they work as-is.
- `talia-ui/.env`: optional. Dev mode auto-creates a mock **ADMIN** user (`dev@talia.local`), so **no login is required**; the UI's Supabase auth vars are only needed for real email/password login.

### Non-obvious gotchas
- **No login needed in dev.** The UI (`SupabaseAuthContext`) injects a mock ADMIN user when `import.meta.env.DEV` is true.
- **Fresh local DB fixes are committed and required:** `talia-server/supabase/migrations/20251206500000_add_error_to_sync_metadata.sql` (otherwise the unified-metadata migration aborts with `column "error" does not exist`) and `talia-server/supabase/seed.sql` (grants `anon`/`authenticated`/`service_role` DML on `public`; without it the app shows `permission denied for table ...` and Supabase reads as offline). Seeds are local-only and are not pushed to remote by `supabase db push`.
- **No cruise data locally.** Migrations create empty tables; real data comes from Azure Synapse sync which requires the customer VPN (unavailable here), so `synapseConnectionStatus` is expected to be offline and most business tables have 0 rows. This is normal — the app, GraphQL, and Supabase still function (e.g. Focus CRUD writes/reads work end-to-end).
- Creating a Focus in the UI triggers a full dashboard/layout re-initialization (brief full-screen spinning-cube loading screen) before the new focus appears in the sidebar — this is expected, not a hang.
