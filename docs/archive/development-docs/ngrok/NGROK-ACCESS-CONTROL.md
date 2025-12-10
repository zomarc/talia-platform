# ngrok Access Control Guide

## Overview

This guide explains how to configure and manage access control for your ngrok tunnel at `taliahub.com/celestyal`. You can restrict access using:

1. **Basic HTTP Authentication** (username/password)
2. **IP Whitelisting** (allow only specific IP addresses)
3. **Combination of both** (most secure)

## Quick Start

### Enable Access Control

1. **Edit the configuration file:**
   ```bash
   # Edit ngrok.yml in the project root
   code ngrok.yml
   # or
   nano ngrok.yml
   ```

2. **Uncomment and configure** the access control method you want:
   - Basic Auth: Uncomment `basic_auth` section
   - IP Whitelisting: Uncomment `ip_restriction` section

3. **Restart ngrok:**
   ```bash
   ./scripts/start-ngrok-celestyal.sh
   ```

## Access Control Methods

### Method 1: Basic HTTP Authentication

**Best for:** Simple username/password protection

**How it works:** Users are prompted to enter credentials before accessing the site.

**Configuration:**

Edit `ngrok.yml` and uncomment the `basic_auth` section:

```yaml
tunnels:
  celestyal:
    proto: http
    addr: 5173
    domain: taliahub.com
    basic_auth:
      - "username:password"
      - "client1:securepass123"
      - "client2:anotherpass456"
```

**Multiple Users:**
- Add multiple `username:password` entries (one per line)
- Each user gets their own credentials
- Share different credentials with different clients

**Example Use Cases:**
- Share with specific clients (each gets unique credentials)
- Temporary access for demos
- Control who can see the preview

**Security Notes:**
- ✅ Simple to set up and use
- ✅ Works with any browser
- ⚠️ Credentials sent in HTTP headers (use HTTPS - ngrok provides this)
- ⚠️ Users can share credentials

### Method 2: IP Whitelisting

**Best for:** Restricting access to specific locations/offices

**How it works:** Only requests from whitelisted IP addresses are allowed.

**Configuration:**

Edit `ngrok.yml` and uncomment the `ip_restriction` section:

```yaml
tunnels:
  celestyal:
    proto: http
    addr: 5173
    domain: taliahub.com
    ip_restriction:
      allow_cidrs:
        - "203.0.113.0/24"      # Allow entire office subnet
        - "198.51.100.1/32"      # Allow specific IP (single address)
        - "192.0.2.50/32"        # Another specific IP
```

**IP Address Formats:**
- **Single IP:** `198.51.100.1/32` (the `/32` means only this exact IP)
- **Subnet:** `203.0.113.0/24` (allows IPs from 203.0.113.0 to 203.0.113.255)
- **Range:** `192.168.1.0/24` (allows 192.168.1.0-255)

**Finding IP Addresses:**
```bash
# Find your current IP
curl ifconfig.me

# Find client's IP (ask them to visit)
# https://whatismyipaddress.com/
```

**Example Use Cases:**
- Restrict to office IP addresses
- Allow only specific client locations
- Block all access except known IPs

**Security Notes:**
- ✅ Very secure (only specific IPs can access)
- ✅ No passwords to share
- ⚠️ Requires knowing client's IP address
- ⚠️ IPs can change (especially for home users)
- ⚠️ Mobile users may have changing IPs

### Method 3: Combined (Recommended for Maximum Security)

**Best for:** High-security scenarios

**Configuration:**

```yaml
tunnels:
  celestyal:
    proto: http
    addr: 5173
    domain: taliahub.com
    basic_auth:
      - "username:password"
    ip_restriction:
      allow_cidrs:
        - "203.0.113.0/24"
```

**How it works:**
- First checks if IP is whitelisted
- Then prompts for username/password
- Both must pass for access

## Managing Access

### Adding New Users (Basic Auth)

1. Edit `ngrok.yml`
2. Add new line under `basic_auth:`
3. Restart ngrok:
   ```bash
   pkill -f "ngrok"
   ./scripts/start-ngrok-celestyal.sh
   ```

### Adding New IPs (IP Whitelisting)

1. Get the IP address (ask client or use a service)
2. Edit `ngrok.yml`
3. Add IP to `allow_cidrs:` list
4. Restart ngrok:
   ```bash
   pkill -f "ngrok"
   ./scripts/start-ngrok-celestyal.sh
   ```

### Temporarily Disable Access Control

1. Comment out the access control sections in `ngrok.yml`:
   ```yaml
   # basic_auth:
   #   - "username:password"
   ```

2. Restart ngrok

### Temporarily Block All Access

**Option 1: Stop ngrok**
```bash
pkill -f "ngrok"
```

**Option 2: Remove all IPs from whitelist**
```yaml
ip_restriction:
  allow_cidrs: []  # Empty list = no access
```

## Common Scenarios

### Scenario 1: Demo for Specific Client

**Setup:**
```yaml
basic_auth:
  - "client-demo:demo2024"
```

**Share:**
- URL: `https://taliahub.com/celestyal`
- Username: `client-demo`
- Password: `demo2024`

**After demo:** Remove credentials or change password

### Scenario 2: Office-Only Access

**Setup:**
```yaml
ip_restriction:
  allow_cidrs:
    - "203.0.113.0/24"  # Office subnet
```

**No passwords needed** - only office IPs can access

### Scenario 3: Multiple Clients with Different Access

**Setup:**
```yaml
basic_auth:
  - "client-a:password-a"
  - "client-b:password-b"
  - "client-c:password-c"
```

**Share different credentials** with each client

### Scenario 4: Time-Limited Access

1. **Enable access control** (basic auth or IP)
2. **Share credentials/IP** with client
3. **After period:** Remove credentials or IP from whitelist
4. **Restart ngrok** to apply changes

## Testing Access Control

### Test Basic Auth

1. Open browser in incognito/private mode
2. Visit: `https://taliahub.com/celestyal`
3. Should see login prompt
4. Enter credentials
5. Should access the site

### Test IP Whitelisting

1. **From whitelisted IP:**
   - Should access normally

2. **From non-whitelisted IP:**
   - Should see "403 Forbidden" or similar error
   - ngrok dashboard will show blocked requests

### Check Access Logs

```bash
# View ngrok dashboard
open http://localhost:4040

# Or check logs
tail -f .ngrok-frontend.log
```

## Troubleshooting

### "Access Denied" but credentials are correct

- **Check:** IP whitelisting might be blocking you
- **Solution:** Add your IP to `allow_cidrs` or disable IP restriction

### Can't access from client's IP

- **Check:** IP whitelisting is enabled but client's IP not in list
- **Solution:** 
  1. Get client's current IP
  2. Add to `allow_cidrs` in `ngrok.yml`
  3. Restart ngrok

### Password prompt not showing

- **Check:** Basic auth might not be enabled
- **Solution:** 
  1. Verify `basic_auth` is uncommented in `ngrok.yml`
  2. Restart ngrok
  3. Clear browser cache

### Changes not taking effect

- **Solution:** Always restart ngrok after config changes:
  ```bash
  pkill -f "ngrok"
  ./scripts/start-ngrok-celestyal.sh
  ```

## Security Best Practices

1. **Use strong passwords** for basic auth
2. **Rotate credentials** regularly
3. **Remove access** when no longer needed
4. **Monitor access logs** in ngrok dashboard
5. **Use HTTPS** (ngrok provides this automatically)
6. **Combine methods** for maximum security

## Current Configuration Status

Check your current access control status:

```bash
./scripts/start-ngrok-celestyal.sh
```

The script will show:
- ✅ Basic Auth: ENABLED/DISABLED
- ✅ IP Whitelisting: ENABLED/DISABLED

## Quick Reference

| Action | Command |
|--------|---------|
| Start with access control | `./scripts/start-ngrok-celestyal.sh` |
| Stop ngrok | `pkill -f "ngrok"` |
| Edit config | `code ngrok.yml` or `nano ngrok.yml` |
| View dashboard | `open http://localhost:4040` |
| Check status | `./scripts/check-ngrok-celestyal-status.sh` |

## Next Steps

1. ✅ **DNS is configured** - `taliahub.com` should be working
2. ✅ **Access control is ready** - Configure in `ngrok.yml`
3. 🔄 **Start ngrok** - Run `./scripts/start-ngrok-celestyal.sh`
4. 🧪 **Test access** - Verify access control works
5. 📤 **Share with clients** - Provide URL and credentials (if using basic auth)

