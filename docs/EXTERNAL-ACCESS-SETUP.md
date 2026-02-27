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

## Local workflow

Start app:

```bash
cd talia-ui && npm run dev
cd talia-server && npm start
```

Start ngrok:

```bash
ngrok http --url=taliahub.com 5173
```

## Verification

```bash
curl -sI https://taliahub.com
curl -sI https://celestyal.taliahub.com
```

- **ngrok running** → HTTP 200/302
- **ngrok stopped** → HTTP 503 (holding page)

## Notes

- All subdomains map to the same tunnel by default (see `HOST_MAP`).
- If you later add per-customer ngrok custom domains, add them to `HOST_MAP`.
