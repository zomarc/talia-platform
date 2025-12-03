# ngrok Setup Guide for External Access

This guide explains how to expose **ONLY the UI** to external users using ngrok with a custom domain. The backend remains local-only and is not exposed externally.

## Architecture

When exposing the UI via ngrok:

- ✅ **UI exposed**: Accessible at `https://taliahub.com` (via ngrok)
- 🔒 **Backend local-only**: Runs on `localhost:4000` (NOT exposed)
- 🔄 **API requests**: Proxied through Vite dev server (`/api/graphql` → `localhost:4000/graphql`)

This means:
- External clients can access the UI
- All API requests from the UI go through the same ngrok tunnel
- Vite's proxy forwards them to your local backend
- The backend itself is never directly accessible from the internet

## Prerequisites

1. **ngrok installed**: Download from [ngrok.com](https://ngrok.com/download)
2. **ngrok account**: Sign up at [ngrok.com](https://dashboard.ngrok.com/signup)
3. **Custom domain configured**: You need a paid ngrok plan to use custom domains
4. **Domain DNS configured**: Point your domain to ngrok's servers

## Quick Start

### 1. Configure ngrok

First, authenticate ngrok with your authtoken:

```bash
ngrok config add-authtoken <your-token>
```

Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken

### 2. Configure Custom Domain in ngrok Dashboard

1. Go to [ngrok Dashboard](https://dashboard.ngrok.com/cloud-edge/domains)
2. Add your custom domain (e.g., `taliahub.com`)
3. Follow the DNS configuration instructions to point your domain to ngrok
4. Wait for DNS propagation (can take a few minutes to hours)

### 3. Start Your Development Servers

Start both frontend and backend:

```bash
./scripts/start-dev.sh
```

Or start them separately:
```bash
# Terminal 1: Backend
cd talia-server && npm start

# Terminal 2: Frontend  
cd talia-ui && npm run dev
```

### 4. Start ngrok Tunnel (UI Only)

Run the ngrok script:

```bash
./scripts/start-ngrok.sh
```

This will start **one tunnel** for the UI:
- **Frontend**: `https://taliahub.com` → `http://localhost:5173`
- **Backend**: Stays local-only (not exposed)

The Vite dev server is configured to proxy `/api/graphql` requests to `localhost:4000/graphql`, so all API calls from external clients go through the same tunnel and get proxied to your local backend.

## Custom Domain Configuration

### Using Environment Variables

You can customize the frontend domain by setting an environment variable:

```bash
export NGROK_FRONTEND_DOMAIN=taliahub.com
./scripts/start-ngrok.sh
```

### Using Different Domains

If you want to use a different domain:

```bash
# Example: Using a subdomain
export NGROK_FRONTEND_DOMAIN=app.taliahub.com
./scripts/start-ngrok.sh
```

## Manual ngrok Command

If you prefer to run ngrok manually (only one tunnel needed):

```bash
ngrok http 5173 --domain=taliahub.com
```

**Note**: Only the frontend tunnel is needed. The backend stays local and is accessed via Vite's proxy.

## Frontend Configuration

The frontend has been configured to use **relative paths** for API requests. This means:

- All GraphQL requests use `/api/graphql` (relative path)
- Vite's proxy configuration forwards these to `localhost:4000/graphql`
- This works both locally and when exposed via ngrok
- **No environment variables needed** - it just works!

### How It Works

1. External client accesses: `https://taliahub.com`
2. UI loads and makes API request to: `/api/graphql` (relative path)
3. Request goes through ngrok tunnel to your Vite dev server
4. Vite proxy forwards it to: `localhost:4000/graphql`
5. Backend processes request and responds
6. Response goes back through the same path

### Quick Setup Workflow

1. Start your development servers:
   ```bash
   ./scripts/start-dev.sh
   ```

2. Start ngrok tunnel (only one needed):
   ```bash
   ./scripts/start-ngrok.sh
   ```

3. Share the URL with clients:
   ```
   https://taliahub.com
   ```

That's it! No configuration files needed. The frontend automatically uses the proxy.

## Testing

1. **Check ngrok dashboard**: http://localhost:4040
2. **Test frontend**: https://taliahub.com
3. **Test API through UI**: The UI should load and make GraphQL requests successfully
4. **Verify backend is local-only**: Try accessing `https://taliahub.com/api/graphql` directly - it should work (proxied), but `localhost:4000` should NOT be accessible from external networks

## Troubleshooting

### ngrok tunnel fails to start

- **Check authentication**: `ngrok config check`
- **Verify domain is configured**: Check ngrok dashboard
- **Check DNS**: Ensure domain points to ngrok servers
- **Check port**: Ensure servers are running on correct ports

### Frontend can't connect to backend

- **Backend not running**: Ensure `localhost:4000` is running locally
- **Proxy not working**: Check Vite dev server is running and proxy config is correct
- **Check browser console**: Look for network errors in the browser's developer tools

### Domain not resolving

- **DNS propagation**: Can take up to 48 hours (usually much faster)
- **Check DNS**: Use `dig` or `nslookup` to verify DNS records
- **ngrok status**: Check domain status in ngrok dashboard

## Security Considerations

⚠️ **Important**: Exposing your local development environment has security implications:

1. **Development data**: Your local database is exposed
2. **No authentication**: Development servers may not have proper auth
3. **Temporary access**: Only use for client testing, not production
4. **Stop when done**: Always stop ngrok tunnels when not in use

## Stopping Tunnels

Press `Ctrl+C` in the terminal running the ngrok script, or:

```bash
pkill -f "ngrok http"
```

## Alternative: Free ngrok (No Custom Domain)

If you don't have a custom domain configured, ngrok will assign a random URL:

```bash
# Only frontend tunnel needed
ngrok http 5173
```

The URL will be something like:
- `https://abc123.ngrok-free.app`

This URL changes each time you restart ngrok, but works for quick testing. The backend still stays local-only and is accessed via the Vite proxy.

## Next Steps

1. Share the frontend URL with your clients: `https://taliahub.com`
2. Monitor usage in ngrok dashboard
3. Set up proper authentication if needed
4. Consider using ngrok's request inspection for debugging

