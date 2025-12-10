# Setting up taliahub.com/celestyal

This guide explains how to configure the app to work at `taliahub.com/celestyal` instead of the root path.

## Quick Start

### Option 1: Use the Celestyal-specific script (Recommended)

```bash
# 1. Stop current dev server if running
# Press Ctrl+C in the terminal running the dev server

# 2. Start dev server with base path
cd talia-ui
VITE_BASE_PATH=/celestyal npm run dev

# 3. In another terminal, start ngrok with celestyal path
cd /Users/russell/Work/AA-Celestyal/Dev/talia
./scripts/start-ngrok-celestyal.sh
```

### Option 2: Manual setup

1. **Set environment variable and restart Vite:**
   ```bash
   cd talia-ui
   export VITE_BASE_PATH=/celestyal
   npm run dev
   ```

2. **Start ngrok (regular script works, but use the celestyal one for clarity):**
   ```bash
   ./scripts/start-ngrok-celestyal.sh
   ```

## Configuration Details

### What Changed

1. **Vite Configuration** (`talia-ui/vite.config.js`):
   - Added `base: process.env.VITE_BASE_PATH || '/'`
   - Added proxy rule for `/celestyal/api` paths
   - This makes Vite serve the app at the `/celestyal` base path

2. **New Script** (`scripts/start-ngrok-celestyal.sh`):
   - Same as regular ngrok script but with instructions for base path
   - Sets `VITE_BASE_PATH` environment variable
   - Shows the correct URL with `/celestyal` path

### How It Works

1. **ngrok** forwards `https://taliahub.com/*` to `http://localhost:5173/*`
2. **Vite** serves the app with base path `/celestyal`
3. **All assets** (JS, CSS, images) are served from `/celestyal/...`
4. **API requests** go to `/celestyal/api/graphql` which Vite proxies to `localhost:4000/graphql`

## Access URLs

- **External (for clients)**: `https://taliahub.com/celestyal`
- **Local**: `http://localhost:5173/celestyal`
- **ngrok Dashboard**: `http://localhost:4040`

## Important Notes

⚠️ **You must restart the Vite dev server** after setting `VITE_BASE_PATH` for it to take effect.

The environment variable must be set **before** starting the dev server, not after.

## Troubleshooting

### App doesn't load at /celestyal

1. **Check Vite is running with base path:**
   ```bash
   # Should see in Vite output:
   # Local:   http://localhost:5173/celestyal/
   ```

2. **Check ngrok is forwarding correctly:**
   ```bash
   curl -I https://taliahub.com/celestyal
   # Should return 200 OK
   ```

3. **Check browser console for 404 errors:**
   - If assets are 404, Vite base path isn't set correctly
   - Restart Vite with `VITE_BASE_PATH=/celestyal`

### API requests fail

- Check that the proxy rule in `vite.config.js` includes `/celestyal/api`
- Verify backend is running on `localhost:4000`
- Check browser network tab to see where requests are going

## Switching Back to Root Path

To use the root path again (`taliahub.com`):

1. Stop the dev server
2. Start without the environment variable:
   ```bash
   cd talia-ui
   npm run dev  # No VITE_BASE_PATH
   ```
3. Use the regular ngrok script:
   ```bash
   ./scripts/start-ngrok.sh
   ```

## Alternative: Use Subdomain

If you prefer a subdomain instead of a path:

1. Configure `celestyal.taliahub.com` in ngrok dashboard
2. Use: `ngrok http 5173 --domain=celestyal.taliahub.com`
3. No need for base path configuration
4. Access at: `https://celestyal.taliahub.com`

This is simpler but requires DNS configuration in ngrok.

