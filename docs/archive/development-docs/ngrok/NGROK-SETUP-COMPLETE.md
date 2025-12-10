# ngrok Setup Complete - taliahub.com/celestyal

## ✅ Setup Status

### DNS Configuration
- **Domain:** `taliahub.com`
- **Path:** `/celestyal`
- **Full URL:** `https://taliahub.com/celestyal`
- **DNS Status:** Should be propagated (verify with `dig taliahub.com CNAME`)

### ngrok Configuration
- **Config File:** `ngrok.yml` (in project root)
- **Port:** `5173` (Vite dev server)
- **Access Control:** Ready to configure (see below)

## 🚀 Quick Start

### 1. Start the Development Server

Make sure your frontend is running:

```bash
cd talia-ui
VITE_BASE_PATH=/celestyal npm run dev
```

### 2. Start ngrok with Access Control

```bash
./scripts/start-ngrok-celestyal.sh
```

The script will:
- ✅ Check if servers are running
- ✅ Show access control status
- ✅ Start ngrok tunnel
- ✅ Display the public URL

## 🔒 Access Control Setup

### Current Status: **DISABLED** (Public Access)

To enable access control, edit `ngrok.yml`:

### Option 1: Basic HTTP Authentication (Recommended for Demos)

Uncomment and configure in `ngrok.yml`:

```yaml
basic_auth:
  - "username:password"
  - "client1:securepass123"
```

**Use when:**
- Sharing with specific clients
- Need simple username/password protection
- Want to control who has access

### Option 2: IP Whitelisting

Uncomment and configure in `ngrok.yml`:

```yaml
ip_restriction:
  allow_cidrs:
    - "203.0.113.0/24"  # Office subnet
    - "198.51.100.1/32"  # Specific IP
```

**Use when:**
- Restricting to specific locations
- Office-only access
- Known IP addresses

### Option 3: Combined (Maximum Security)

Enable both methods for maximum security.

## 📋 Next Steps

### Immediate Actions

1. **Verify DNS Propagation:**
   ```bash
   dig taliahub.com CNAME +short
   # Should show: [ngrok-cname-value].ngrok-cname.com.
   ```

2. **Configure Access Control** (if needed):
   - Edit `ngrok.yml`
   - Uncomment desired access control method
   - Add credentials or IP addresses

3. **Start ngrok:**
   ```bash
   ./scripts/start-ngrok-celestyal.sh
   ```

4. **Test Access:**
   - Visit: `https://taliahub.com/celestyal`
   - Verify access control works (if enabled)

### For Client Presentations

1. **Enable Basic Auth** in `ngrok.yml`
2. **Create unique credentials** for each client
3. **Share:**
   - URL: `https://taliahub.com/celestyal`
   - Username: `[client-username]`
   - Password: `[client-password]`
4. **After presentation:** Remove or change credentials

## 📚 Documentation

- **Access Control Guide:** `NGROK-ACCESS-CONTROL.md`
- **DNS Setup:** `TALIAHUB-DNS-FIX.md`
- **General Setup:** `NGROK-DNS-SETUP.md`

## 🔍 Monitoring

### Check Tunnel Status

```bash
# View ngrok dashboard
open http://localhost:4040

# Check script status
./scripts/check-ngrok-celestyal-status.sh
```

### View Logs

```bash
# ngrok logs
tail -f .ngrok-frontend.log

# ngrok dashboard
open http://localhost:4040
```

## 🛠️ Troubleshooting

### DNS Not Working

1. **Check DNS propagation:**
   ```bash
   dig taliahub.com CNAME +short
   ```

2. **Wait longer** (can take up to 48 hours, usually 15-30 minutes)

3. **Verify DNS records** in your DNS provider

### Access Control Not Working

1. **Check config file:**
   ```bash
   cat ngrok.yml
   ```

2. **Verify syntax** (YAML is sensitive to indentation)

3. **Restart ngrok:**
   ```bash
   pkill -f "ngrok"
   ./scripts/start-ngrok-celestyal.sh
   ```

### Can't Access Site

1. **Check if ngrok is running:**
   ```bash
   pgrep -f "ngrok"
   ```

2. **Check if frontend is running:**
   ```bash
   curl http://localhost:5173
   ```

3. **Check ngrok dashboard:** http://localhost:4040

## 📝 Configuration Files

- **ngrok.yml** - Main configuration (access control, domain, port)
- **scripts/start-ngrok-celestyal.sh** - Startup script
- **talia-ui/vite.config.js** - Vite configuration (already configured)

## 🎯 Current Configuration

```
External URL: https://taliahub.com/celestyal
Local URL: http://localhost:5173/celestyal
Backend: http://localhost:4000 (local-only)
Access Control: DISABLED (configure in ngrok.yml)
```

## ✅ Checklist

- [x] DNS configured (taliahub.com → ngrok)
- [x] ngrok.yml created with access control options
- [x] Start script updated to use config file
- [x] Documentation created
- [ ] DNS propagated (verify with `dig`)
- [ ] Access control configured (if needed)
- [ ] ngrok started and tested
- [ ] Client access verified

## 🚨 Important Notes

1. **Access Control is Currently DISABLED**
   - The tunnel is publicly accessible
   - Enable access control before sharing with clients

2. **Backend Remains Local-Only**
   - Only the frontend (port 5173) is exposed
   - Backend (port 4000) stays on localhost
   - API requests are proxied through Vite

3. **Restart Required After Config Changes**
   - Always restart ngrok after editing `ngrok.yml`
   - Use: `pkill -f "ngrok" && ./scripts/start-ngrok-celestyal.sh`

4. **DNS Propagation Time**
   - Can take 5 minutes to 48 hours
   - Usually 15-30 minutes
   - Check with `dig taliahub.com CNAME`

