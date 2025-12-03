# Quick Start: Exposing Talia UI to External Users

This guide helps you quickly expose **ONLY the UI** to external clients using ngrok. The backend stays local-only.

## Architecture

- ✅ **UI exposed**: `https://taliahub.com` (via ngrok)
- 🔒 **Backend local-only**: `localhost:4000` (NOT exposed)
- 🔄 **API requests**: Proxied through Vite (`/api/graphql` → `localhost:4000/graphql`)

## Prerequisites

- ✅ ngrok installed and authenticated
- ✅ Custom domain configured in ngrok dashboard (taliahub.com)
- ✅ DNS configured for your domain

## 2-Step Setup

### 1. Start Development Servers

```bash
./scripts/start-dev.sh
```

Wait for both servers to be running:
- Frontend: http://localhost:5173
- Backend: http://localhost:4000 (local-only, not exposed)

### 2. Start ngrok Tunnel (UI Only)

```bash
./scripts/start-ngrok.sh
```

**That's it!** No configuration files needed. The frontend automatically uses Vite's proxy.

## Access URLs

Once running, share this URL with your clients:

- **Frontend (for clients)**: https://taliahub.com
- **ngrok Dashboard**: http://localhost:4040

The backend is **not exposed** - all API requests go through the same tunnel and get proxied.

## Stopping

Press `Ctrl+C` in the ngrok terminal, or:

```bash
pkill -f "ngrok http"
```

## Troubleshooting

- **Frontend can't connect**: Ensure backend is running on `localhost:4000`
- **ngrok fails**: Check `ngrok config check` and verify domain in ngrok dashboard
- **Domain not working**: Check DNS propagation (can take time)

For detailed information, see: [docs/NGROK-SETUP.md](docs/NGROK-SETUP.md)

