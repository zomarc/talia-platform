# ngrok Setup Options for External Access

## Current Situation

You're on ngrok's **Free Plan**, which doesn't support custom domains like `taliahub.com`. Here are your options:

## Option 1: Use Free ngrok URL (Works Now) ✅

### Quick Start

```bash
# Terminal 1: Make sure Vite is running with base path
cd talia-ui
VITE_BASE_PATH=/celestyal npm run dev

# Terminal 2: Start ngrok (free plan)
cd /Users/russell/Work/AA-Celestyal/Dev/talia
./scripts/start-ngrok-free.sh
```

### What You'll Get

- A random URL like: `https://abc123-def456.ngrok-free.app/celestyal`
- URL changes each time you restart ngrok
- Works immediately, no payment required
- Perfect for testing and demos

### Getting the URL

After starting ngrok, you'll see:
- The URL in the terminal output
- Or check: http://localhost:4040 (ngrok dashboard)

## Option 2: Upgrade to Paid Plan (Custom Domain) 💳

### Benefits

- Use `https://taliahub.com/celestyal` (stable URL)
- URL doesn't change
- More professional for client presentations

### Steps

1. **Upgrade ngrok plan:**
   - Go to: https://dashboard.ngrok.com/billing/choose-a-plan
   - Choose a plan (Starter is $8/month)
   - Add payment method

2. **Configure custom domain:**
   - Go to: https://dashboard.ngrok.com/cloud-edge/domains
   - Add `taliahub.com` as a custom domain
   - Follow DNS configuration instructions
   - Wait for DNS propagation (can take minutes to hours)

3. **Start ngrok with custom domain:**
   ```bash
   ./scripts/start-ngrok-celestyal.sh
   ```

## Option 3: Use ngrok Static Domain (Free Alternative) 🆓

ngrok offers a **free static domain** feature that gives you a stable URL without paying:

### Steps

1. **Get a free static domain:**
   - Go to: https://dashboard.ngrok.com/cloud-edge/domains
   - Look for "Reserved Domain" option
   - Reserve a free domain like: `yourname.ngrok-free.app`

2. **Update the script:**
   ```bash
   # Edit scripts/start-ngrok-celestyal.sh
   # Change: FRONTEND_DOMAIN="${NGROK_FRONTEND_DOMAIN:-taliahub.com}"
   # To: FRONTEND_DOMAIN="${NGROK_FRONTEND_DOMAIN:-yourname.ngrok-free.app}"
   ```

3. **Start ngrok:**
   ```bash
   NGROK_FRONTEND_DOMAIN=yourname.ngrok-free.app ./scripts/start-ngrok-celestyal.sh
   ```

## Recommended: Start with Free Plan

For immediate testing, use the free plan:

```bash
# 1. Start Vite with base path
cd talia-ui
VITE_BASE_PATH=/celestyal npm run dev

# 2. Start ngrok (in another terminal)
cd /Users/russell/Work/AA-Celestyal/Dev/talia
./scripts/start-ngrok-free.sh

# 3. Get the URL from ngrok output or dashboard
# Example: https://abc123.ngrok-free.app/celestyal
```

## Getting the External URL

After starting ngrok, get your URL:

### Method 1: From Terminal
The ngrok output shows the URL:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:5173
```

### Method 2: From Dashboard
Open: http://localhost:4040
- Click on the tunnel
- Copy the "Forwarding" URL
- Add `/celestyal` to the end

### Method 3: Via API
```bash
curl -s http://localhost:4040/api/tunnels | python3 -c "import sys, json; data = json.load(sys.stdin); tunnels = data.get('tunnels', []); print(tunnels[0].get('public_url', 'N/A') + '/celestyal' if tunnels else 'No tunnel')"
```

## Testing the External URL

Once you have the URL:

1. **Test in browser:**
   ```
   https://YOUR-NGROK-URL.ngrok-free.app/celestyal
   ```

2. **Test API:**
   ```bash
   curl https://YOUR-NGROK-URL.ngrok-free.app/celestyal/api/graphql \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"query":"{ __typename }"}'
   ```

## Important Notes

⚠️ **Free Plan Limitations:**
- URL changes each time you restart ngrok
- May have connection limits
- ngrok branding page on first visit (users click "Visit Site")

✅ **For Production/Client Demos:**
- Consider upgrading to paid plan for stable URL
- Or use free static domain (Option 3)

## Troubleshooting

### ngrok shows "Visit Site" page
- This is normal for free plan
- Users need to click "Visit Site" button once
- Consider upgrading to remove this

### URL doesn't work
- Make sure Vite is running with `VITE_BASE_PATH=/celestyal`
- Check ngrok dashboard: http://localhost:4040
- Verify backend is running on port 4000

### API requests fail
- Check Vite proxy configuration
- Verify backend is accessible locally
- Check browser console for errors

