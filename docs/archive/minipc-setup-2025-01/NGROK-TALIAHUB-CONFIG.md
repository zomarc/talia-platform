# ngrok taliahub.com Configuration Guide

## Current Issue

The custom domain `taliahub.com` needs to be configured in your ngrok account dashboard before it will work.

## Steps to Configure taliahub.com

### 1. Access ngrok Dashboard

Go to: **https://dashboard.ngrok.com/domains**

### 2. Add Custom Domain

1. Click **"Add Domain"** or **"Reserved Domains"**
2. Enter: `taliahub.com`
3. Follow ngrok's instructions to verify domain ownership
4. Complete DNS configuration if required

### 3. Verify Domain Status

Once configured, the domain should show as "Active" in your dashboard.

### 4. Restart ngrok Service

```bash
ssh zomarc@192.168.1.120
sudo systemctl restart ngrok-taliahub
sudo systemctl status ngrok-taliahub
```

### 5. Test

```bash
curl -s https://taliahub.com | head -5
```

## Alternative: Use Temporary URL

If you need immediate access while configuring the domain:

```bash
# Update config to remove custom domain (temporary)
ssh zomarc@192.168.1.120
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

sudo systemctl restart ngrok-taliahub

# Get temporary URL
curl -s http://localhost:4040/api/tunnels | python3 -m json.tool | grep public_url
```

Then update the config back to use `taliahub.com` once it's configured.

## Current Config

The config file is ready at: `~/.ngrok2/ngrok-taliahub.yml`

Once `taliahub.com` is configured in your ngrok dashboard, the service will automatically use it.

---

**Next**: Configure `taliahub.com` in https://dashboard.ngrok.com/domains
