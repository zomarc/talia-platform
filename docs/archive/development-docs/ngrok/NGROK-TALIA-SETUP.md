# ngrok talia.ngrok.dev Setup

## ✅ Configuration Complete

### External URL
**https://talia.ngrok.dev/celestyal**

## What Was Done

1. ✅ **Updated Vite Config**
   - Added `talia.ngrok.dev` to `allowedHosts`
   - Added wildcard `*.ngrok.dev` for flexibility

2. ✅ **Started ngrok Tunnel**
   - Domain: `talia.ngrok.dev`
   - Port: `5173` (Vite dev server)
   - Forwarding: `http://localhost:5173`

3. ✅ **Verified Tunnel Status**
   - Tunnel is active and operational
   - External URL is accessible

## Quick Commands

### Start ngrok with talia.ngrok.dev:
```bash
./scripts/start-ngrok-talia.sh
```

### Or manually:
```bash
ngrok http 5173 --domain=talia.ngrok.dev
```

### Check status:
```bash
./scripts/get-ngrok-url.sh
```

### Stop ngrok:
```bash
pkill -f "ngrok http"
```

## Important Notes

### Port Configuration
- **Your command used port 80**, but the UI runs on **port 5173**
- The correct command is: `ngrok http 5173 --domain=talia.ngrok.dev`
- Port 80 is typically for production web servers, not Vite dev server

### Vite Configuration
- ✅ `talia.ngrok.dev` is now in `allowedHosts`
- ✅ Restart Vite if it was already running to pick up the change:
  ```bash
  # Stop Vite (Ctrl+C)
  cd talia-ui
  VITE_BASE_PATH=/celestyal npm run dev
  ```

## Current Status

- ✅ **ngrok**: Running with `talia.ngrok.dev`
- ✅ **Frontend**: Port 5173
- ✅ **Backend**: Port 4000 (local-only)
- ✅ **External URL**: `https://talia.ngrok.dev/celestyal`

## Testing

### Test in Browser:
```
https://talia.ngrok.dev/celestyal
```

### Test API:
```bash
curl https://talia.ngrok.dev/celestyal/api/graphql \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
```

## Architecture

```
External Request
    ↓
https://talia.ngrok.dev/celestyal
    ↓
ngrok Tunnel (talia.ngrok.dev)
    ↓
http://localhost:5173/celestyal (Vite)
    ↓
API Proxy: /celestyal/api/graphql
    ↓
http://localhost:4000/graphql (Backend)
```

## Troubleshooting

### "Host not allowed" error
- Make sure Vite is restarted after config change
- Check that `talia.ngrok.dev` is in `allowedHosts`

### Tunnel not working
- Verify ngrok is running: `pgrep -f "ngrok http"`
- Check ngrok dashboard: http://localhost:4040
- Verify Vite is running on port 5173

### Wrong port
- UI runs on **5173**, not 80
- Use: `ngrok http 5173 --domain=talia.ngrok.dev`

