# External Access Architecture

This document explains how Talia exposes the UI to external users while keeping the backend secure and local-only.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    External Client Browser                   │
│                                                               │
│  Accesses: https://taliahub.com                              │
│  Makes API calls to: /api/graphql (relative path)            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTPS (via ngrok tunnel)
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    ngrok Tunnel                              │
│                                                               │
│  Domain: taliahub.com                                        │
│  Forwards to: localhost:5173 (Vite dev server)              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTP (local)
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Vite Dev Server (Port 5173)                      │
│                                                               │
│  • Serves React UI                                            │
│  • Proxies /api/* requests to localhost:4000               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTP (local)
                        │
┌───────────────────────▼─────────────────────────────────────┐
│         GraphQL Backend Server (Port 4000)                   │
│                                                               │
│  • NOT exposed externally                                    │
│  • Only accessible from localhost                            │
│  • Processes GraphQL requests                                │
└─────────────────────────────────────────────────────────────┘
```

## Key Points

### ✅ What IS Exposed

- **UI only**: The React frontend at `https://taliahub.com`
- **Via ngrok**: Single tunnel for the UI (port 5173)
- **API requests**: Go through the same tunnel, proxied by Vite

### 🔒 What is NOT Exposed

- **Backend server**: `localhost:4000` is **never** directly accessible from the internet
- **Supabase**: Local instance stays local-only
- **Database**: Not exposed externally

## Request Flow

1. **Client accesses UI**: `https://taliahub.com`
   - Request goes through ngrok tunnel
   - Reaches Vite dev server on `localhost:5173`
   - Vite serves the React app

2. **UI makes API request**: `/api/graphql`
   - Request goes through the **same** ngrok tunnel
   - Reaches Vite dev server
   - Vite proxy forwards to `localhost:4000/graphql`
   - Backend processes request
   - Response follows the same path back

3. **Backend stays local**: 
   - `localhost:4000` is never directly accessible from external networks
   - All access goes through Vite's proxy
   - Backend only accepts connections from localhost

## Security Benefits

1. **Backend isolation**: The GraphQL server is not exposed to the internet
2. **Single entry point**: All traffic goes through one ngrok tunnel
3. **Proxy control**: Vite can add authentication, rate limiting, etc. if needed
4. **Local data protection**: Supabase and database remain completely local

## Configuration

### Vite Proxy Setup

```javascript
// vite.config.js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:4000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

This means:
- Requests to `/api/graphql` → forwarded to `localhost:4000/graphql`
- Works both locally and when exposed via ngrok
- No code changes needed

### Frontend Configuration

All API calls use **relative paths**:
- `apolloClient.js`: Uses `/api/graphql`
- `serverServices.js`: Uses `/api/graphql`
- `sailingsService.js`: Uses `/api/graphql`

This ensures:
- Works locally (proxied to localhost:4000)
- Works via ngrok (proxied through same tunnel)
- No environment variables needed

## Comparison: Before vs After

### ❌ Incorrect Approach (What We Avoided)

```
External Client → ngrok → Backend (port 4000) [EXPOSED]
External Client → ngrok → Frontend (port 5173) [EXPOSED]
```

**Problems:**
- Backend directly exposed to internet
- Two separate tunnels to manage
- Security risk

### ✅ Correct Approach (What We Implemented)

```
External Client → ngrok → Frontend (port 5173) → Proxy → Backend (port 4000) [LOCAL]
```

**Benefits:**
- Only UI exposed
- Backend stays local-only
- Single tunnel
- Secure

## Testing the Architecture

1. **Verify backend is local-only**:
   ```bash
   # This should work (local)
   curl http://localhost:4000/graphql
   
   # This should NOT work from external network
   # (Backend is not exposed)
   ```

2. **Verify UI works via ngrok**:
   - Access `https://taliahub.com` from external browser
   - UI should load
   - API requests should work (proxied through Vite)

3. **Check ngrok dashboard**:
   - Visit `http://localhost:4040`
   - See all requests going through the tunnel
   - Verify only port 5173 is exposed

## Troubleshooting

### UI loads but API calls fail

- **Check backend is running**: `curl http://localhost:4000/graphql`
- **Check Vite proxy config**: Verify `vite.config.js` has proxy setup
- **Check browser console**: Look for network errors

### Backend appears exposed

- **Verify only one tunnel**: `./scripts/start-ngrok.sh` should only create one tunnel
- **Check ngrok dashboard**: Only port 5173 should be listed
- **Test direct access**: Try accessing `localhost:4000` from external network (should fail)

## Summary

✅ **Only the UI is exposed** via ngrok  
✅ **Backend stays local-only** (localhost:4000)  
✅ **API requests proxied** through Vite dev server  
✅ **Secure architecture** with single entry point  
✅ **No configuration needed** - uses relative paths

This architecture provides a secure way to share the UI with clients while keeping your backend infrastructure completely private.

