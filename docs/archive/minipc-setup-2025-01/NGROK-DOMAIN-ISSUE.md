# ngrok Custom Domain Configuration

## Issue

ngrok is running but showing `ERR_NGROK_3200` - endpoint is offline. This typically means the custom domain `taliahub.com` needs to be configured in your ngrok account.

## Solution Options

### Option 1: Configure Domain in ngrok Dashboard (Recommended)

1. **Go to**: https://dashboard.ngrok.com/domains
2. **Add Domain**: `taliahub.com`
3. **Verify Domain**: Follow ngrok's DNS verification steps
4. **Restart Service**: `sudo systemctl restart ngrok-taliahub`

### Option 2: Use Temporary ngrok URL (Quick Test)

If you need immediate access, we can use a regular ngrok URL:

```bash
# Update config to remove custom domain
cat > ~/.ngrok2/ngrok-taliahub.yml << 'EOF'
version: "3"
agent:
    authtoken: 36FdRL1Ns62WG5Pd3M9qwpv7ScA_5hRn7coUJLDmyLQTS8X3C
tunnels:
  talia-ui:
    proto: http
    addr: 5173
    inspect: true
EOF

# Restart service
sudo systemctl restart ngrok-taliahub

# Get URL
curl -s http://localhost:4040/api/tunnels | python3 -m json.tool | grep public_url
```

### Option 3: Check Domain Status

```bash
# Check if domain is configured
ngrok api domains list

# Or check via dashboard
# https://dashboard.ngrok.com/domains
```

## Current Status

- ✅ ngrok service: Running
- ✅ Config file: Created
- ⚠️ Custom domain: Needs configuration in ngrok dashboard
- ✅ Fallback: Can use temporary ngrok URL

## Next Steps

1. **Configure domain** in ngrok dashboard: https://dashboard.ngrok.com/domains
2. **Verify DNS** if required by ngrok
3. **Restart service**: `sudo systemctl restart ngrok-taliahub`
4. **Test**: `curl -s https://taliahub.com`

---

**Note**: Custom domains require a paid ngrok plan. If you don't have one, use Option 2 for a temporary URL.
