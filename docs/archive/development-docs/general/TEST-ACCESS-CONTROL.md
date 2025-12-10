# Testing ngrok Access Control

## Quick Test Guide

### Prerequisites

1. **Frontend must be running:**
   ```bash
   cd talia-ui
   VITE_BASE_PATH=/celestyal npm run dev
   ```

2. **ngrok must be running:**
   ```bash
   ./scripts/start-ngrok-celestyal.sh
   ```

### Test Basic Authentication

#### Method 1: Browser Test (Recommended)

1. **Open a new incognito/private window** (to avoid cached credentials)
   - Chrome/Edge: `Ctrl+Shift+N` (Windows) or `Cmd+Shift+N` (Mac)
   - Firefox: `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
   - Safari: `Cmd+Shift+N`

2. **Navigate to:**
   ```
   https://taliahub.com/celestyal
   ```

3. **Expected Behavior:**
   - Browser should show a login prompt/dialog
   - Enter username: `demo`
   - Enter password: `celestyal2024`
   - Click "Sign in" or "OK"

4. **Success:**
   - ✅ You should see your Talia UI application
   - ✅ No error messages

5. **Failure Test:**
   - Try wrong credentials (e.g., `wrong:password`)
   - Should see "401 Unauthorized" or "Authentication failed"
   - Should NOT see the application

#### Method 2: Command Line Test

Test with `curl`:

```bash
# Test without credentials (should fail)
curl -I https://taliahub.com/celestyal

# Expected: HTTP/1.1 401 Unauthorized

# Test with credentials (should succeed)
curl -u demo:celestyal2024 https://taliahub.com/celestyal

# Expected: HTML content of your application
```

#### Method 3: Test from Different Device/Network

1. **Get the URL:**
   ```
   https://taliahub.com/celestyal
   ```

2. **Open on phone/tablet/another computer**

3. **Should see login prompt**

4. **Enter credentials:**
   - Username: `demo`
   - Password: `celestyal2024`

5. **Should access the application**

### Verify Access Control is Working

#### Check 1: Login Prompt Appears

- ✅ Browser shows login dialog
- ✅ Can't access without credentials
- ✅ Wrong credentials are rejected

#### Check 2: Correct Credentials Work

- ✅ Can access with `demo:celestyal2024`
- ✅ Application loads correctly
- ✅ No errors in browser console

#### Check 3: ngrok Dashboard

1. **Open ngrok dashboard:**
   ```bash
   open http://localhost:4040
   ```

2. **Check "Requests" tab:**
   - Should see requests to `/celestyal`
   - Should see 401 responses for failed auth attempts
   - Should see 200 responses for successful auth

3. **Check "Auth" section:**
   - Should show basic auth is enabled
   - Should show authentication attempts

### Troubleshooting

#### No Login Prompt Appearing

**Problem:** Browser doesn't show login dialog

**Solutions:**
1. **Clear browser cache:**
   - Chrome: Settings → Privacy → Clear browsing data
   - Or use incognito/private window

2. **Check ngrok is using config file:**
   ```bash
   # Stop ngrok
   pkill -f "ngrok"
   
   # Restart with script (uses ngrok.yml)
   ./scripts/start-ngrok-celestyal.sh
   ```

3. **Verify config file:**
   ```bash
   cat ngrok.yml | grep -A 3 "basic_auth"
   ```
   Should show uncommented `basic_auth:` section

4. **Check ngrok logs:**
   ```bash
   tail -f .ngrok-frontend.log
   ```

#### Login Prompt But Wrong Credentials Work

**Problem:** Any credentials seem to work

**Solution:**
- Verify `ngrok.yml` has correct credentials
- Restart ngrok after config changes:
  ```bash
  pkill -f "ngrok"
  ./scripts/start-ngrok-celestyal.sh
  ```

#### Can't Access Even With Correct Credentials

**Problem:** Login works but can't see application

**Solutions:**
1. **Check frontend is running:**
   ```bash
   curl http://localhost:5173/celestyal
   ```

2. **Check Vite base path:**
   - Frontend should be started with: `VITE_BASE_PATH=/celestyal npm run dev`

3. **Check browser console for errors:**
   - Open DevTools (F12)
   - Check Console tab for errors

### Test Checklist

- [ ] Frontend is running on port 5173
- [ ] ngrok is running with `./scripts/start-ngrok-celestyal.sh`
- [ ] Can access `https://taliahub.com/celestyal`
- [ ] Login prompt appears
- [ ] Wrong credentials are rejected (401 error)
- [ ] Correct credentials (`demo:celestyal2024`) work
- [ ] Application loads correctly after authentication
- [ ] Tested from incognito/private window
- [ ] Tested from different device/network (optional)

### Current Credentials

**Default credentials (for testing):**
- Username: `demo`
- Password: `celestyal2024`

**To change credentials:**
1. Edit `ngrok.yml`
2. Update the `basic_auth:` section
3. Restart ngrok:
   ```bash
   pkill -f "ngrok"
   ./scripts/start-ngrok-celestyal.sh
   ```

### Quick Test Commands

```bash
# Test without auth (should fail)
curl -I https://taliahub.com/celestyal

# Test with auth (should work)
curl -u demo:celestyal2024 https://taliahub.com/celestyal

# Check ngrok status
./scripts/check-ngrok-celestyal-status.sh

# View ngrok dashboard
open http://localhost:4040
```

