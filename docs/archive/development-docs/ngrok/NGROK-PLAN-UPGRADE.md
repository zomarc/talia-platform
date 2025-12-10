# ngrok Plan Upgrade Guide

## Current Issue

**Error:** `ERR_NGROK_314` - "Only paid plans may create endpoints with custom hostnames"

**Problem:** Your ngrok account is on the **Free plan**, which doesn't support custom domains like `taliahub.com`.

## Solution Options

### Option 1: Upgrade to Paid Plan (Recommended for taliahub.com)

**Cost:** $8/month (Starter plan) or $15/month (Pro plan)

**Benefits:**
- ✅ Use custom domain `taliahub.com`
- ✅ Stable URL (doesn't change)
- ✅ More professional for client presentations
- ✅ Better performance
- ✅ No "Visit Site" warning page

**Steps to Upgrade:**

1. **Go to ngrok Dashboard:**
   ```
   https://dashboard.ngrok.com/billing/choose-a-plan
   ```

2. **Choose a Plan:**
   - **Starter ($8/month):** Perfect for your use case
   - **Pro ($15/month):** If you need more features

3. **Add Payment Method:**
   - Enter credit card details
   - Complete checkout

4. **Verify Domain:**
   - Go to: https://dashboard.ngrok.com/cloud-edge/domains
   - Add `taliahub.com` as a domain
   - Follow DNS setup instructions (already done)

5. **Restart ngrok:**
   ```bash
   ./scripts/start-ngrok-celestyal.sh
   ```

### Option 2: Use Free Domain (Temporary Solution)

**Free domains work but:**
- ⚠️ URL changes each time you restart ngrok
- ⚠️ Shows "Visit Site" warning page for first-time visitors
- ⚠️ Less professional for clients

**To use free domain:**

1. **Update `ngrok.yml`** - Remove or comment out the `domain:` line:
   ```yaml
   tunnels:
     celestyal:
       proto: http
       addr: 5173
       # domain: taliahub.com  # Commented out for free plan
       basic_auth:
         - "demo:celestyal2024"
   ```

2. **Start ngrok:**
   ```bash
   ./scripts/start-ngrok-celestyal.sh
   ```

3. **Get the URL:**
   - Check ngrok dashboard: http://localhost:4040
   - Or run: `./scripts/get-ngrok-url.sh`

## Recommended: Upgrade to Paid Plan

Since you've already:
- ✅ Configured DNS for `taliahub.com`
- ✅ Set up access control
- ✅ Want to present to clients

**Upgrading makes sense** because:
1. Professional URL (`taliahub.com/celestyal`)
2. Stable (doesn't change)
3. Better client experience
4. Only $8/month

## After Upgrading

Once you upgrade:

1. **Verify domain in ngrok dashboard:**
   - https://dashboard.ngrok.com/cloud-edge/domains
   - Should show `taliahub.com` as "Active"

2. **Test the setup:**
   ```bash
   ./scripts/start-ngrok-celestyal.sh
   ```

3. **Verify it works:**
   ```bash
   curl -I https://taliahub.com/celestyal
   # Should show 401 (auth required) not 404
   ```

4. **Test with credentials:**
   ```bash
   curl -u demo:celestyal2024 https://taliahub.com/celestyal
   # Should return HTML content
   ```

## Current Status

- ✅ **Frontend:** Running on port 5173
- ✅ **Backend:** Running on port 4000
- ✅ **Basic Auth:** Configured (`demo:celestyal2024`)
- ✅ **DNS:** Configured for `taliahub.com`
- ❌ **ngrok Plan:** Free (needs upgrade for custom domain)

## Next Steps

1. **Decide:** Free domain (temporary) or Paid plan (recommended)
2. **If upgrading:** Follow Option 1 above
3. **If using free:** Follow Option 2 above
4. **Test:** Verify access control works
5. **Share:** Provide URL and credentials to clients

