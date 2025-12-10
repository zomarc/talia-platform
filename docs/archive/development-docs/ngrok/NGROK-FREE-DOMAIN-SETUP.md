# ngrok Free Domain Setup (Temporary)

## ✅ Current Status: OPERATIONAL

### External URL
**https://kelley-resistless-sniffingly.ngrok-free.dev/celestyal**

## Step-by-Step Plan (Executed)

### ✅ Step 1: Stopped Previous Tunnel
- Stopped ngrok tunnel using `taliahub.com` (waiting for DNS)

### ✅ Step 2: Verified Vite Configuration
- Vite config already includes wildcards for `*.ngrok-free.dev`
- No additional configuration needed

### ✅ Step 3: Started ngrok with Free Domain
- Started ngrok with: `kelley-resistless-sniffingly.ngrok-free.dev`
- Tunnel is active and forwarding to `localhost:5173`

### ✅ Step 4: Verified Tunnel Status
- ngrok is running (PID: active)
- Tunnel is operational
- HTTP Status: 200 OK

### ✅ Step 5: Tested External Access
- URL is accessible: `https://kelley-resistless-sniffingly.ngrok-free.dev/celestyal`

## Quick Commands

### Start ngrok with free domain:
```bash
./scripts/start-ngrok-free-domain.sh
```

### Check status:
```bash
curl -s http://localhost:4040/api/tunnels | python3 -m json.tool
```

### Get current URL:
```bash
./scripts/get-ngrok-url.sh
```

### Stop ngrok:
```bash
pkill -f "ngrok http"
```

## Next Steps

Once DNS for `taliahub.com` propagates:

1. **Stop current tunnel:**
   ```bash
   pkill -f "ngrok http"
   ```

2. **Start with custom domain:**
   ```bash
   ./scripts/start-ngrok-celestyal.sh
   ```

3. **New URL will be:**
   `https://taliahub.com/celestyal`

## Current Configuration

- **Domain**: `kelley-resistless-sniffingly.ngrok-free.dev`
- **Port**: 5173 (Vite dev server)
- **Base Path**: `/celestyal`
- **Backend**: Local-only (localhost:4000)
- **API Proxy**: `/celestyal/api/graphql` → `localhost:4000/graphql`

## Notes

- This is a **temporary solution** while DNS propagates
- The free domain URL works immediately
- Once DNS is ready, switch to the custom domain for a stable URL
- Both URLs will work - the free domain is just for immediate access

