# ngrok Setup - Step-by-Step Fix

## ✅ Current Status Check

### What's Working:
- ✅ Frontend running on port 5173
- ✅ Backend running on port 4000
- ✅ Basic auth configured (`demo:celestyal2024`)
- ✅ DNS configured for `taliahub.com`

### What's Not Working:
- ❌ **ngrok can't use `taliahub.com`** - Free plan doesn't support custom domains

## 🔍 Diagnosis

**Error:** `ERR_NGROK_314` - "Only paid plans may create endpoints with custom hostnames"

**Root Cause:** Your ngrok account is on the **Free plan**, which doesn't support custom domains.

## 🎯 Solution: Choose Your Path

### Path A: Upgrade to Paid Plan (Recommended) ⭐

**Best for:** Professional client presentations, stable URL

**Steps:**

1. **Upgrade ngrok account:**
   - Visit: https://dashboard.ngrok.com/billing/choose-a-plan
   - Choose **Starter plan** ($8/month)
   - Add payment method and complete checkout

2. **Verify domain in ngrok:**
   - Go to: https://dashboard.ngrok.com/cloud-edge/domains
   - Add `taliahub.com` if not already added
   - Verify it shows as "Active"

3. **Test the setup:**
   ```bash
   cd /Users/russell/Work/AA-Celestyal/Dev/talia
   ./scripts/start-ngrok-celestyal.sh
   ```

4. **Verify it works:**
   ```bash
   # Should show 401 (auth required)
   curl -I https://taliahub.com/celestyal
   
   # Should return HTML with correct credentials
   curl -u demo:celestyal2024 https://taliahub.com/celestyal | head -20
   ```

5. **Test in browser:**
   - Open incognito window
   - Visit: `https://taliahub.com/celestyal`
   - Should see login prompt
   - Enter: `demo` / `celestyal2024`
   - Should see your application

### Path B: Use Free Domain (Temporary) 💰

**Best for:** Testing, temporary access

**Steps:**

1. **Update `ngrok.yml` to remove custom domain:**
   ```bash
   cd /Users/russell/Work/AA-Celestyal/Dev/talia
   # Edit ngrok.yml and comment out the domain line
   ```

2. **Edit the file:**
   ```yaml
   tunnels:
     celestyal:
       proto: http
       addr: 5173
       # domain: taliahub.com  # Commented out for free plan
       basic_auth:
         - "demo:celestyal2024"
   ```

3. **Start ngrok:**
   ```bash
   ./scripts/start-ngrok-celestyal.sh
   ```

4. **Get the free URL:**
   ```bash
   # Check ngrok dashboard
   open http://localhost:4040
   
   # Or get URL programmatically
   curl -s http://localhost:4040/api/tunnels | python3 -c "import sys, json; data = json.load(sys.stdin); tunnels = data.get('tunnels', []); print(tunnels[0].get('public_url', 'N/A') + '/celestyal' if tunnels else 'N/A')"
   ```

5. **Test access:**
   - Visit the free URL (e.g., `https://xxxxx.ngrok-free.dev/celestyal`)
   - Should see login prompt
   - Enter: `demo` / `celestyal2024`
   - Should see your application

**Note:** Free URLs change each time you restart ngrok.

## 🧪 Complete Test Procedure

### Test 1: Verify Services Running

```bash
# Check frontend
curl -s http://localhost:5173 >/dev/null && echo "✅ Frontend OK" || echo "❌ Frontend NOT running"

# Check backend
curl -s http://localhost:4000/graphql >/dev/null && echo "✅ Backend OK" || echo "❌ Backend NOT running"
```

### Test 2: Start ngrok

```bash
cd /Users/russell/Work/AA-Celestyal/Dev/talia
./scripts/start-ngrok-celestyal.sh
```

**Expected output:**
- ✅ Shows "Basic HTTP Authentication: ENABLED"
- ✅ Shows "Frontend is running"
- ✅ Shows "Tunnel started"
- ✅ Shows public URL

### Test 3: Verify Access Control

```bash
# Get the URL (replace with your actual URL)
URL="https://taliahub.com/celestyal"  # or your free ngrok URL

# Test without auth (should fail)
echo "Test 1: Without credentials (should fail):"
curl -I "$URL" 2>&1 | grep -E "(401|HTTP)"

# Test with wrong credentials (should fail)
echo "Test 2: Wrong credentials (should fail):"
curl -u wrong:password -I "$URL" 2>&1 | grep -E "(401|HTTP)"

# Test with correct credentials (should work)
echo "Test 3: Correct credentials (should work):"
curl -u demo:celestyal2024 -I "$URL" 2>&1 | grep -E "(200|HTTP)"
```

**Expected results:**
- Test 1: `401 Unauthorized`
- Test 2: `401 Unauthorized`
- Test 3: `200 OK`

### Test 4: Browser Test

1. **Open incognito/private window**
2. **Visit your URL:**
   - Paid: `https://taliahub.com/celestyal`
   - Free: `https://xxxxx.ngrok-free.dev/celestyal`
3. **Should see login prompt**
4. **Enter credentials:**
   - Username: `demo`
   - Password: `celestyal2024`
5. **Should see your application**

## 🔧 Troubleshooting

### Issue: "ERR_NGROK_314" Error

**Solution:** Upgrade to paid plan OR remove `domain:` from `ngrok.yml`

### Issue: No Login Prompt

**Check:**
1. Basic auth is enabled in `ngrok.yml`
2. ngrok was restarted after config change
3. Using incognito window (to avoid cached credentials)

**Fix:**
```bash
pkill -f "ngrok"
./scripts/start-ngrok-celestyal.sh
```

### Issue: Can't Access Application After Login

**Check:**
1. Frontend is running: `curl http://localhost:5173`
2. Vite started with: `VITE_BASE_PATH=/celestyal npm run dev`
3. Check browser console for errors

### Issue: ngrok Won't Start

**Check logs:**
```bash
cat .ngrok-frontend.log
```

**Common fixes:**
- Kill existing ngrok: `pkill -f "ngrok"`
- Check config: `ngrok config check --config=ngrok.yml`
- Verify auth token: `ngrok config check`

## 📋 Quick Reference

| Action | Command |
|--------|---------|
| Start ngrok | `./scripts/start-ngrok-celestyal.sh` |
| Stop ngrok | `pkill -f "ngrok"` |
| Check status | `curl http://localhost:4040/api/tunnels` |
| View dashboard | `open http://localhost:4040` |
| Test auth | `curl -u demo:celestyal2024 https://[URL]/celestyal` |
| Check logs | `cat .ngrok-frontend.log` |

## ✅ Success Checklist

- [ ] Services running (frontend + backend)
- [ ] ngrok started successfully
- [ ] No ERR_NGROK_314 error
- [ ] Login prompt appears in browser
- [ ] Wrong credentials rejected (401)
- [ ] Correct credentials work (200)
- [ ] Application loads after authentication

## 🎯 Recommended Next Steps

1. **If upgrading:** Follow Path A above
2. **If using free:** Follow Path B above
3. **Test everything** using Test Procedure above
4. **Share URL and credentials** with clients when ready

## 📚 Related Documentation

- **Upgrade Guide:** `NGROK-PLAN-UPGRADE.md`
- **Access Control:** `NGROK-ACCESS-CONTROL.md`
- **Testing:** `TEST-ACCESS-CONTROL.md`

