# ngrok Paid Plan - Domain Setup Fix

## Issue

Even though you have a paid plan, you're getting `ERR_NGROK_314` which says your account is on the Free plan.

## Possible Causes

1. **Domain not reserved in ngrok dashboard** - Most common issue
2. **Wrong authtoken** - Using token from different account
3. **Domain not verified** - DNS not properly configured in ngrok

## Step-by-Step Fix

### Step 1: Verify Your Paid Plan

1. **Go to ngrok Dashboard:**
   ```
   https://dashboard.ngrok.com/billing
   ```

2. **Check your plan:**
   - Should show "Starter", "Pro", or "Enterprise"
   - NOT "Free"

3. **If it shows Free:**
   - You may need to upgrade
   - Or you're logged into the wrong account

### Step 2: Reserve/Add Domain in ngrok Dashboard

**This is the most common issue!** Even with a paid plan, you must add the domain first.

1. **Go to Domains:**
   ```
   https://dashboard.ngrok.com/cloud-edge/domains
   ```

2. **Click "Add Domain" or "New Domain"**

3. **Enter your domain:**
   - Domain: `taliahub.com`
   - (Leave subdomain empty for root domain)

4. **ngrok will show DNS instructions:**
   - You'll see a CNAME target like: `xxxxx.ngrok-cname.com`
   - This should match what you configured in DNS

5. **Verify domain status:**
   - Should show "Active" or "Verified"
   - If it shows "Pending" or "Unverified", DNS hasn't propagated

### Step 3: Verify DNS Configuration

1. **Check your DNS records:**
   ```bash
   dig taliahub.com CNAME +short
   ```

2. **Should show:** Something like `xxxxx.ngrok-cname.com`

3. **If DNS is wrong:**
   - Update DNS to match what ngrok dashboard shows
   - Wait for propagation (15-30 minutes usually)

### Step 4: Verify Authtoken

1. **Check which account the authtoken belongs to:**
   - The authtoken in your config should match your paid account
   - If you have multiple ngrok accounts, make sure you're using the right one

2. **Get new authtoken if needed:**
   - Go to: https://dashboard.ngrok.com/get-started/your-authtoken
   - Copy the token
   - Update: `ngrok config add-authtoken YOUR_TOKEN`

### Step 5: Test the Setup

1. **Start ngrok:**
   ```bash
   ./scripts/start-ngrok-celestyal.sh
   ```

2. **Check for errors:**
   - Should NOT see ERR_NGROK_314
   - Should see "Tunnel started"

3. **Test access:**
   ```bash
   curl -I https://taliahub.com/celestyal
   # Should show 401 (auth required), not 404
   ```

## Quick Diagnostic Commands

```bash
# Check ngrok config
ngrok config check

# Check DNS
dig taliahub.com CNAME +short

# Test ngrok connection
ngrok http 5173 --log stdout
```

## Common Issues

### Issue: "Domain not found" or "Domain not verified"

**Solution:**
1. Go to ngrok dashboard → Domains
2. Add `taliahub.com` if not already added
3. Verify DNS matches what ngrok shows
4. Wait for DNS propagation

### Issue: Still shows "Free plan" error

**Possible causes:**
1. **Wrong authtoken** - Using token from free account
   - Fix: Get new token from paid account dashboard
   
2. **Domain not reserved** - Most common!
   - Fix: Add domain in ngrok dashboard first
   
3. **Account mismatch** - Logged into wrong account
   - Fix: Verify you're using the correct ngrok account

### Issue: Domain shows "Pending" in dashboard

**Solution:**
- DNS hasn't propagated yet
- Wait 15-30 minutes
- Verify DNS records are correct
- Check: `dig taliahub.com CNAME`

## Verification Checklist

- [ ] Paid plan confirmed in dashboard
- [ ] Domain `taliahub.com` added in ngrok dashboard
- [ ] Domain shows "Active" or "Verified" status
- [ ] DNS CNAME matches ngrok instructions
- [ ] DNS propagated (check with `dig`)
- [ ] Correct authtoken configured
- [ ] ngrok starts without ERR_NGROK_314

## Next Steps

1. **Verify domain in dashboard:**
   - https://dashboard.ngrok.com/cloud-edge/domains
   - Add `taliahub.com` if missing

2. **Check DNS:**
   ```bash
   dig taliahub.com CNAME +short
   ```

3. **Start ngrok:**
   ```bash
   ./scripts/start-ngrok-celestyal.sh
   ```

4. **Test:**
   ```bash
   curl -I https://taliahub.com/celestyal
   ```

## Still Not Working?

If you've completed all steps and still get the error:

1. **Check ngrok dashboard** - Verify domain is added and active
2. **Verify authtoken** - Make sure it's from your paid account
3. **Contact ngrok support** - They can verify your account status
4. **Check account email** - Make sure you're logged into the right account

