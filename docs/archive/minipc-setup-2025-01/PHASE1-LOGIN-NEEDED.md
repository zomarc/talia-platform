# Phase 1 - Login Required

## Current Status

✅ ProtonVPN CLI installed (v3.13.0)  
✅ Systemd service created  
⚠️ **Login session needed**

## Issue

The ProtonVPN login session needs to be established as the `zomarc` user (not root) for the systemd service to work.

## Solution

**SSH to MiniPC and login:**

```bash
ssh zomarc@192.168.1.120
protonvpn-cli login
```

Enter your credentials:
- Username: `russell@russellbryer.com`
- Password: (your ProtonVPN password)

## After Login

Once logged in, test the connection:

```bash
# Test connection to UK#11
protonvpn-cli connect UK#11

# Wait a few seconds
sleep 5

# Verify IP
curl -s https://api.ipify.org
# Should show: 149.40.48.92

# Check status
protonvpn-cli status
```

## Then Test Systemd Service

```bash
# Disconnect manually first
protonvpn-cli disconnect

# Test systemd service
sudo systemctl start protonvpn.service

# Check status
sudo systemctl status protonvpn.service

# Verify IP
curl -s https://api.ipify.org
```

Once this works, Phase 1 will be complete!

---

**Next**: After login works, we'll proceed to Phase 2: Security Hardening
