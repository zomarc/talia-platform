# Quick DNS Setup for taliahub.com

## ✅ Vite Configuration Fixed

I've updated `vite.config.js` to allow `taliahub.com` and all ngrok domains. **You need to restart Vite** for this to take effect:

```bash
# Stop current Vite (Ctrl+C)
# Then restart:
cd talia-ui
VITE_BASE_PATH=/celestyal npm run dev
```

## 🔧 DNS Configuration Steps

### Step 1: Add Domain in ngrok Dashboard

1. Go to: **https://dashboard.ngrok.com/cloud-edge/domains**
2. Click **"Add Domain"** or **"New Domain"**
3. Enter: `taliahub.com`
4. ngrok will show you a **CNAME target** like:
   ```
   edge-xxxxx.ngrok-free.app
   ```
   (Copy this exact value)

### Step 2: Configure DNS Record

Go to your **domain registrar** or **DNS provider** (wherever you manage DNS for taliahub.com) and add:

**CNAME Record:**
```
Type: CNAME
Name: @ (or taliahub.com or leave blank - depends on your DNS provider)
Value: [the CNAME target from ngrok, e.g., edge-xxxxx.ngrok-free.app]
TTL: 3600 (or Auto)
```

**Common DNS Providers:**
- **GoDaddy**: DNS Management → Add Record
- **Namecheap**: Advanced DNS → Add New Record
- **Cloudflare**: DNS → Records → Add record
- **Route53**: Hosted zones → Create record

### Step 3: Verify DNS Propagation

After adding the DNS record, check if it's working:

```bash
# Check CNAME record
dig taliahub.com CNAME

# Should show something like:
# taliahub.com. 3600 IN CNAME edge-xxxxx.ngrok-free.app.
```

**Or check online:**
- https://www.whatsmydns.net/#CNAME/taliahub.com

**Note:** DNS propagation can take 5 minutes to 48 hours (usually 15-30 minutes).

### Step 4: Verify in ngrok Dashboard

1. Go back to: https://dashboard.ngrok.com/cloud-edge/domains
2. Check that `taliahub.com` shows as **"Active"** or **"Verified"**
3. If it shows "Pending" or "Not verified", wait for DNS propagation

### Step 5: Start ngrok with Custom Domain

Once DNS is verified:

```bash
cd /Users/russell/Work/AA-Celestyal/Dev/talia
./scripts/start-ngrok-celestyal.sh
```

## 🚨 Important: Restart Vite

**You must restart Vite** after the config change:

```bash
# Stop current Vite (Ctrl+C in the terminal running it)
cd talia-ui
VITE_BASE_PATH=/celestyal npm run dev
```

## ✅ Quick Verification

After DNS is configured and ngrok is started:

```bash
# Check DNS
dig taliahub.com CNAME

# Check ngrok status
curl -s http://localhost:4040/api/tunnels | python3 -m json.tool

# Test the URL
curl -I https://taliahub.com/celestyal
```

## 🆘 Troubleshooting

### "Domain not verified" in ngrok dashboard
- Wait longer for DNS propagation (can take up to 48 hours)
- Double-check the CNAME value matches exactly what ngrok provided
- Try using a subdomain instead (e.g., `app.taliahub.com`)

### "Host not allowed" error in Vite
- ✅ Already fixed in `vite.config.js`
- **Restart Vite** for changes to take effect
- Check that `taliahub.com` is in the `allowedHosts` array

### DNS record not working
- Some providers don't support CNAME on root domain
- Use a subdomain instead: `app.taliahub.com` or `demo.taliahub.com`
- Or use an A record if ngrok provides an IP address

## 📋 Current Status

- ✅ Vite config updated (includes taliahub.com and ngrok wildcards)
- ⏳ DNS configuration needed (follow steps above)
- ⏳ ngrok needs to be started with custom domain (after DNS is ready)

## 🎯 Once Everything is Set Up

Your external URL will be:
**https://taliahub.com/celestyal**

And it will work reliably without the ngrok warning page!

