# External Access Setup (ngrok + Cloudflare)

How to present the laptop stack publicly, and how the Cloudflare Worker + reserved ngrok domain work.

## Day-to-day (preferred)

Edit on `:5173`. Present with **Start Demo** → **https://dev.taliahub.com**.

```bash
./scripts/validate start-core          # GraphQL + Supabase + Vite-dev :5173
./scripts/validate start-demo          # or menu D — rebuild preview :4173 + publish
# open https://dev.taliahub.com
```

After UI changes that should appear publicly, re-run `start-demo` (or menu **D**). Apex `taliahub.com` shares the same tunnel; prefer **dev.** for discussion.

Roles at a glance: **dev** = laptop discuss · **MiniPC / Azure MVP** = prove-deploy (not customer prod).

## Goal

- **ngrok running** → public hosts serve the app
- **ngrok stopped** → public hosts serve the holding page
- **Subdomains** share one reserved ngrok domain via the Worker `HOST_MAP`

## Architecture (minimal)

```
User -> Cloudflare Worker -> ngrok tunnel (reserved: taliahub.com)
                 |
                 +-- if origin fails -> holding page
```

Hostnames (browser) → Worker remaps Host → reserved domain:

| Browser URL | Role |
|-------------|------|
| **https://dev.taliahub.com** | **Laptop discussion / development portal** (prefer this) |
| https://taliahub.com | Same tunnel (legacy / bookmarks / staging claim) |
| https://celestyal.taliahub.com | Alias (same tunnel) |
| Azure MVP | Direct IP — not via this tunnel (UAT prove-deploy) |
| MiniPC | Docker prove-deploy; can claim apex when `external-on` target is staging |
| Customer Azure | Future production |

## Requirements

- **ngrok** paid plan with **custom domain** `taliahub.com`
- **Cloudflare** zone for `taliahub.com`, DNS records **proxied (orange cloud)**
- **Worker route**: `*taliahub.com/*` → `taliahub-gateway`

## Setup

### 1) ngrok domain

1. ngrok Dashboard → **Domains** → ensure `taliahub.com` is reserved
2. Copy the **CNAME target** (example: `xxxxx.ngrok-cname.com`)

You do **not** need a separate ngrok reserved domain for `dev.` — the Worker rewrites Host to `taliahub.com`.

### 2) Cloudflare DNS

Cloudflare → **DNS** (all proxied):

- `taliahub.com` / `@` → ngrok CNAME target (or CF A/AAAA when orange-cloud)
- `www` → same
- **`dev`** → same (required for `https://dev.taliahub.com`)
- `celestyal` → same (optional alias)

If `dev` already resolves to Cloudflare anycast (same as apex), you are done for DNS.

### 3) Worker route

Cloudflare → **Workers Routes**:

- `*taliahub.com/*` → `taliahub-gateway`

### 4) Worker config

Edit `cloudflare-worker/index.js`:

- Set `NGROK_RESOLVE` to the ngrok CNAME target (no scheme)
- Keep `HOST_MAP` entries for `dev.taliahub.com`, apex, www, aliases → `taliahub.com`

Deploy:

```bash
cd cloudflare-worker
npx wrangler deploy
```

## Local vs staging vs MVP

| Target | How you reach it | Owns reserved ngrok domain? |
|--------|------------------|------------------------------|
| **local** | Edit: `http://127.0.0.1:5173`. Public discuss: **https://dev.taliahub.com** (preview `:4173`) | When local ngrok is running (`external-on` + target `local`) |
| **staging** (MiniPC) | LAN `http://192.168.1.120:5173` — Docker prove | When staging `ngrok-taliahub` is active |
| **mvp** (your Azure) | `http://<MVP_UI_HOST>:5173` — deploy/UAT prove | **Never** via validate ngrok |
| **customer Azure** | Future production | Separate instance |

`./scripts/validate set-target …` only sets the **working target** (check / start-core / deploy scope). It does **not** move the tunnel by itself — use `external-on`.

### Why local public is preview, not Vite-dev

Vite-dev serves hundreds of ESM modules. Over ngrok + Cloudflare that waterfall often stalls on the HTML boot screen. A production **preview** build serves one bundled JS file and boots reliably.

Config (`scripts/config/targets.env`):

- `LOCAL_UI_PORT=5173` — edit / HMR
- `LOCAL_PUBLIC_UI_PORT=4173` — public presenter
- `PUBLIC_DEV_URL=https://dev.taliahub.com` — share with clients
- `PUBLIC_MAIN_URL=https://taliahub.com` — reserved domain / legacy probes

### Switch tunnel owner (advanced)

Menu **5** / `external-on` switches who owns the reserved domain (laptop ↔ MiniPC). Requires typing `ENABLE_NGROK_EXTERNAL`. Prefer **Start Demo** for day-to-day laptop presenting.

To stop public access:

```bash
./scripts/validate external-off
```

## Verification

```bash
curl -sI -u talia:dev2025tal https://dev.taliahub.com
curl -sS -u talia:dev2025tal https://dev.taliahub.com/ | grep -oE '/assets/index-[^"]+\.js'
# Expect /assets/index-*.js (preview), not /src/main.jsx (Vite-dev)
./scripts/validate status
```

- **ngrok running** → HTTP 200/302/401/403 + `X-TaliaHub-Gateway: proxied`
- **ngrok stopped** → HTTP **503** + `X-TaliaHub-Gateway: fallback`
- **MVP** → curl Azure IP directly, not taliahub hosts

## Notes

- One reserved ngrok domain (`taliahub.com`): only one of local / MiniPC can claim it at a time.
- `dev.` is an alias through the Worker, not a second tunnel.
- Later: `uat.` → Azure, customer production on customer Azure — add DNS + `HOST_MAP` (or separate tunnels) when ready.
