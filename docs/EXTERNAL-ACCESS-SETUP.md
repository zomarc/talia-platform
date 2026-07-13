# External Access Setup (ngrok + Cloudflare)

Single source of truth for exposing **taliahub.com** (and subdomains) with a holding page when the endpoint is offline.

## Goal

- **ngrok running** → `taliahub.com` serves the app
- **ngrok stopped** → `taliahub.com` serves the holding page
- **Subdomains** (e.g. `celestyal.taliahub.com`) follow the same behavior

## Architecture (minimal)

```
User -> Cloudflare Worker -> ngrok tunnel
                 |
                 +-- if origin fails -> holding page
```

## Requirements

- **ngrok** paid plan with **custom domain**
- **Cloudflare** zone for `taliahub.com`, DNS records **proxied (orange cloud)**
- **Worker route**: `*taliahub.com/*` → `taliahub-gateway`

## Setup

### 1) ngrok domain

1. ngrok Dashboard → **Domains** → add `taliahub.com`
2. Copy the **CNAME target** (example: `xxxxx.ngrok-cname.com`)

### 2) Cloudflare DNS

Cloudflare → **DNS**:
- `taliahub.com` CNAME → ngrok CNAME target (proxied)
- `www` CNAME → ngrok CNAME target (proxied)
- `celestyal` CNAME → ngrok CNAME target (proxied)

### 3) Worker route

Cloudflare → **Workers Routes**:
- `*taliahub.com/*` → `taliahub-gateway`

### 4) Worker config

Edit `cloudflare-worker/index.js`:

- Set `NGROK_RESOLVE` to the ngrok CNAME target (no scheme)
- Update `HOST_MAP` if you later want per-customer tunnels
- Update `HOLDING_HTML` to change the holding page design/copy

Deploy:

```bash
cd cloudflare-worker
npx wrangler deploy
```

## Local vs staging vs MVP

| Target | How you reach it | Owns `taliahub.com`? |
|--------|------------------|----------------------|
| **local** | `http://127.0.0.1:5173` | Only when **local ngrok** is running (`./scripts/validate external-on` with working target `local`) |
| **staging** (MiniPC) | `http://192.168.1.120:5173` (LAN) | Only when **staging** `ngrok-taliahub` systemd unit is active |
| **mvp** (Azure) | `http://<MVP_UI_HOST>:5173` from `scripts/config/targets.env` | **Never** via this repo’s validate/ngrok path |

`./scripts/validate set-target …` only sets the **working target** (check / start-core / deploy scope). It does **not** move `taliahub.com`.

To put the public demo on local:

```bash
./scripts/validate set-target local
# UI must be up on :5173
./scripts/validate external-on   # type ENABLE_NGROK_EXTERNAL
```

To stop public demo from this laptop:

```bash
./scripts/validate external-off
```

`external-off` behavior:

1. Stops **local** ngrok immediately (`pkill` for the reserved domain).
2. Attempts to stop staging `ngrok-taliahub` over SSH with a **2s** connect timeout; soft-fails if MiniPC is unreachable (does not hang).
3. Re-probes `https://taliahub.com`:
   - **Holding page (success):** HTTP **503** and `X-TaliaHub-Gateway: fallback` → status `OFF (HOLDING)`.
   - **Still live:** HTTP 200/302/401/403 or `gateway=proxied` → **ORPHAN** (another host still owns the reserved domain; stop that tunnel in the ngrok dashboard or on MiniPC, then re-run).

If staging MiniPC SSH is unreachable, local stop still completes; reclaim an orphan by stopping the endpoint in the ngrok dashboard, then `external-on` on the laptop when ready.

## Local workflow

Start app:

```bash
cd talia-ui && npm run dev
cd talia-server && npm start
```

Start ngrok (or use validate menu 5):

```bash
ngrok http --url=taliahub.com 5173
```

Prefer: `./scripts/validate external-on` after `set-target local` (stops staging ngrok first when SSH works).

## Verification

```bash
curl -sI https://taliahub.com
curl -sI https://celestyal.taliahub.com
./scripts/validate status   # shows working target vs public presenter
```

- **ngrok running** → HTTP 200/302 (or **401** if basic-auth challenge) and `X-TaliaHub-Gateway: proxied`
- **ngrok stopped** → HTTP **503** + `X-TaliaHub-Gateway: fallback` (holding page)
- **`validate status` Public row** must agree with the External line (e.g. `vX.Y.Z (LOCAL)` when local holds the domain; `holding page` when offline — not `n/a (DOWN)` while External says UP)
- **MVP check** → curl `http://$MVP_UI_HOST:5173/` (not taliahub.com)
- Remote/VPN: staging LAN/SSH probes use **1–2s** timeouts so MiniPC-down fails fast

## Notes

- All subdomains map to the same tunnel by default (see `HOST_MAP`).
- If you later add per-customer ngrok custom domains, add them to `HOST_MAP`.
- Reserved ngrok domain is single-claim: only one of local / staging can present at a time.