# ngrok Configuration & Localhost References Fix Plan

## Issues Identified

### Issue 1: ngrok.yml Users Not Being Used
**Problem:** The `start-ngrok-simple.sh` script hardcodes `--basic-auth=demo:celestyal2024` instead of reading from `ngrok.yml`.

**Impact:** When you add users to `ngrok.yml`, they won't be used unless you manually update the script.

**Solution:** Update the script to read `basic_auth` users from `ngrok.yml` and pass them to ngrok.

### Issue 2: Hardcoded Localhost References
**Problem:** The frontend has hardcoded localhost URLs that won't work when accessed externally via ngrok.

**Found Issues:**
1. **SSE Endpoint** (`DataManagementPage.jsx:645`): `http://localhost:4001` - This will fail externally
2. **Supabase Display** (`serverServices.js:68`): Shows `http://127.0.0.1:54321` in UI (display only, but confusing)

**Impact:** 
- External users see "local devices on network" prompts
- SSE (Server-Sent Events) for sync progress won't work externally
- UI shows confusing localhost addresses

## Fix Plan

### Step 1: Update ngrok Script to Read from Config ✅

**File:** `scripts/start-ngrok-simple.sh`

**Changes:**
- Read `basic_auth` users from `ngrok.yml`
- Pass all users to ngrok command
- Support multiple users (ngrok accepts multiple `--basic-auth` flags)

**How it works:**
- Parse YAML to extract `basic_auth` entries
- Build ngrok command with all users
- If config file doesn't exist or has no users, fall back to default

### Step 2: Fix SSE Endpoint ✅

**File:** `talia-ui/src/components/DataManagementPage.jsx`

**Changes:**
- Change `http://localhost:4001` to relative path `/api/sync/stream/...`
- Add Vite proxy for SSE endpoint
- Use environment detection to determine base URL

**How it works:**
- In development (via ngrok): Use relative path `/api/sync/stream/...`
- Vite proxy forwards to `localhost:4001`
- Works both locally and externally

### Step 3: Add Vite Proxy for SSE ✅

**File:** `talia-ui/vite.config.js`

**Changes:**
- Add proxy rule for `/api/sync/stream/*` → `http://localhost:4001`
- Handle base path `/celestyal/api/sync/stream/*` → `http://localhost:4001`

**How it works:**
- All SSE requests go through Vite proxy
- Proxy forwards to local backend on port 4001
- Works transparently via ngrok

### Step 4: Fix Supabase Display Reference ✅

**File:** `talia-ui/src/config/serverServices.js`

**Changes:**
- Don't show `http://127.0.0.1:54321` when accessed externally
- Show generic "Local Supabase" or "Supabase" instead
- Only show actual URL when status is available

**How it works:**
- Check if we're in external context (can detect via window.location)
- Show user-friendly label instead of localhost URL

### Step 5: Testing ✅

**Test Cases:**
1. Add new user to `ngrok.yml` → Restart ngrok → Verify user can access
2. Access externally in incognito → No "local devices" prompt
3. Test SSE sync progress → Should work externally
4. Check UI → No localhost URLs visible

## Implementation Details

### ngrok.yml Format
```yaml
basic_auth:
  - "demo:celestyal2025"
  - "andy:test2025"
  - "test:test2025"
```

### ngrok Command Format
```bash
ngrok http 5173 --domain=taliahub.com \
  --basic-auth=demo:celestyal2025 \
  --basic-auth=andy:test2025 \
  --basic-auth=test:test2025
```

### SSE Endpoint Fix
**Before:**
```javascript
const sseBaseUrl = import.meta.env.PROD ? '' : 'http://localhost:4001';
const sseUrl = `${sseBaseUrl}/api/sync/stream/${tableName}`;
```

**After:**
```javascript
// Use relative path - Vite proxy handles routing
const sseUrl = `/api/sync/stream/${tableName}`;
// Or with base path:
const sseUrl = `${import.meta.env.VITE_BASE_PATH || ''}/api/sync/stream/${tableName}`;
```

### Vite Proxy Addition
```javascript
proxy: {
  '/api/sync/stream': {
    target: 'http://localhost:4001',
    changeOrigin: true,
    // SSE requires special handling
    ws: true,
  },
  '/celestyal/api/sync/stream': {
    target: 'http://localhost:4001',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/celestyal\/api\/sync\/stream/, '/api/sync/stream'),
    ws: true,
  }
}
```

## Verification Steps

1. **Add user to ngrok.yml:**
   ```yaml
   basic_auth:
     - "newuser:newpass"
   ```

2. **Restart ngrok:**
   ```bash
   ./scripts/start-ngrok-simple.sh
   ```

3. **Verify user works:**
   ```bash
   curl -u newuser:newpass https://taliahub.com/celestyal
   ```

4. **Test in incognito:**
   - Open incognito window
   - Visit `https://taliahub.com/celestyal`
   - Should NOT see "local devices" prompt
   - Should work normally

5. **Test SSE (if backend supports it):**
   - Start data sync
   - Should see progress updates
   - Should work externally

## Files to Modify

1. ✅ `scripts/start-ngrok-simple.sh` - Read from ngrok.yml
2. ✅ `talia-ui/src/components/DataManagementPage.jsx` - Fix SSE endpoint
3. ✅ `talia-ui/vite.config.js` - Add SSE proxy
4. ✅ `talia-ui/src/config/serverServices.js` - Fix display reference

## Notes

- **ngrok restart required:** After adding users to `ngrok.yml`, restart ngrok
- **No backend changes:** All fixes are frontend/Vite configuration
- **Backward compatible:** Works locally and externally
- **SSE support:** Requires backend to be running on port 4001 (may be optional)

