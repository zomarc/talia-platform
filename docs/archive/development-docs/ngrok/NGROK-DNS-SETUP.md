# ngrok Custom Domain DNS Setup Guide

## Overview

To use `taliahub.com` with ngrok, you need to:
1. Add the domain in ngrok dashboard
2. Configure DNS records to point to ngrok
3. Wait for DNS propagation
4. Start ngrok with the custom domain

## Step-by-Step Setup

### Step 1: Add Domain in ngrok Dashboard

1. **Go to ngrok Dashboard:**
   - Visit: https://dashboard.ngrok.com/cloud-edge/domains
   - Click "Add Domain" or "New Domain"

2. **Enter your domain:**
   - Domain: `taliahub.com`
   - (Optional) Subdomain: Leave empty for root domain

3. **ngrok will provide DNS instructions:**
   - You'll see something like:
     ```
     Type: CNAME
     Name: @ (or taliahub.com)
     Value: edge-xxx.ngrok-free.app
     ```

### Step 2: Configure DNS Records

You need to add a **CNAME record** in your domain's DNS settings.

#### Where to Configure DNS

- **If using a domain registrar** (GoDaddy, Namecheap, etc.):
  - Log into your domain registrar
  - Go to DNS Management / DNS Settings
  - Add a CNAME record

- **If using a DNS provider** (Cloudflare, Route53, etc.):
  - Log into your DNS provider
  - Add a CNAME record

#### DNS Record Configuration

**For root domain (taliahub.com):**
```
Type: CNAME
Name: @ (or taliahub.com or leave blank)
Value: [ngrok-provided-value].ngrok-free.app
TTL: 3600 (or Auto)
```

**For www subdomain (www.taliahub.com):**
```
Type: CNAME
Name: www
Value: [ngrok-provided-value].ngrok-free.app
TTL: 3600 (or Auto)
```

**Note:** Some DNS providers don't support CNAME on root domain. In that case:
- Use an A record pointing to ngrok's IP (check ngrok dashboard)
- Or use a subdomain like `app.taliahub.com`

### Step 3: Verify DNS Configuration

After adding the DNS record, verify it's working:

```bash
# Check CNAME record
dig taliahub.com CNAME

# Or use nslookup
nslookup taliahub.com

# Should show the ngrok edge domain
```

### Step 4: Wait for DNS Propagation

- DNS changes can take **5 minutes to 48 hours** to propagate
- Usually takes **15-30 minutes** for most providers
- Check propagation status: https://www.whatsmydns.net/

### Step 5: Verify Domain in ngrok Dashboard

1. Go back to: https://dashboard.ngrok.com/cloud-edge/domains
2. Check the status of `taliahub.com`
3. Status should show "Active" or "Verified" when DNS is configured correctly

### Step 6: Start ngrok with Custom Domain

Once DNS is verified:

```bash
cd /Users/russell/Work/AA-Celestyal/Dev/talia
./scripts/start-ngrok-celestyal.sh
```

Or manually:
```bash
ngrok http 5173 --domain=taliahub.com
```

## Troubleshooting

### "Domain not verified" error

- **Check DNS propagation:** Use https://www.whatsmydns.net/
- **Verify CNAME record:** Make sure it points to the exact value ngrok provided
- **Check TTL:** Lower TTL (300-600) helps with faster updates
- **Wait longer:** Some DNS changes take up to 48 hours

### "ERR_NGROK_314" - Custom domain not allowed

- **Verify paid plan:** Make sure your ngrok account is upgraded
- **Check billing:** https://dashboard.ngrok.com/billing
- **Contact support:** If still having issues

### DNS record not working

- **Use subdomain instead:** Try `app.taliahub.com` or `demo.taliahub.com`
- **Check DNS provider:** Some providers have specific requirements
- **Use A record:** If CNAME doesn't work, use A record with ngrok's IP

## Alternative: Use Subdomain

If root domain CNAME is problematic, use a subdomain:

1. **In ngrok dashboard:** Add `app.taliahub.com` instead
2. **DNS record:**
   ```
   Type: CNAME
   Name: app
   Value: [ngrok-edge].ngrok-free.app
   ```
3. **Access at:** `https://app.taliahub.com/celestyal`

## Quick DNS Check Commands

```bash
# Check CNAME record
dig taliahub.com CNAME +short

# Check all records
dig taliahub.com ANY

# Check specific nameserver
dig @ns1.your-dns-provider.com taliahub.com CNAME
```

## Next Steps After DNS is Configured

1. **Verify in ngrok dashboard** that domain shows as "Active"
2. **Start ngrok** with custom domain
3. **Test the URL:** `https://taliahub.com/celestyal`
4. **Update Vite config** (already done - includes taliahub.com in allowedHosts)

## Current Vite Configuration

✅ Already updated to allow:
- `taliahub.com`
- `www.taliahub.com`
- `*.ngrok-free.dev` (for free plan fallback)
- `*.ngrok-free.app`
- `*.ngrok.io`
- `*.ngrok.app`

No need to restart Vite - the config will be picked up on next request.

