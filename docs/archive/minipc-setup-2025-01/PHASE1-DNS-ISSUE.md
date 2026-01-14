# Phase 1 - DNS Resolution Issue

## Problem

The ProtonVPN CLI login is failing with "Unknown API error" because `api.protonvpn.com` cannot be resolved via DNS, even with Google DNS (8.8.8.8).

## Current Status

- ✅ Internet connectivity works (can reach Google, ping 8.8.8.8)
- ✅ `protonvpn.com` resolves correctly
- ❌ `api.protonvpn.com` does NOT resolve (No answer from DNS)
- ❌ ProtonVPN CLI login fails

## Possible Causes

1. **Network filtering**: The MiniPC's network/router may be blocking ProtonVPN API endpoints
2. **DNS blocking**: DNS servers may be filtering ProtonVPN domains
3. **API endpoint changed**: ProtonVPN may have moved to a different API endpoint

## Solutions to Try

### Option 1: Use OpenVPN Credentials Instead

ProtonVPN uses two sets of credentials:
- **Proton Account**: Used for website/login
- **OpenVPN Credentials**: Used for VPN connections

You can get your OpenVPN credentials from:
https://account.protonvpn.com/login → Downloads → OpenVPN configuration files

The OpenVPN username format is usually: `USERNAME+1` or similar.

### Option 2: Check Network/Router Settings

The MiniPC's network may be blocking ProtonVPN API. Check:
- Router firewall settings
- Network filtering rules
- ISP-level blocking

### Option 3: Use OpenVPN Directly

Instead of ProtonVPN CLI, we could:
1. Download OpenVPN config files from ProtonVPN account
2. Use `openvpn` command directly
3. Create systemd service for OpenVPN

### Option 4: Try Different Network

If possible, test if ProtonVPN CLI works on a different network (e.g., mobile hotspot) to isolate if it's network-specific.

## Next Steps

1. **Check your ProtonVPN account** for OpenVPN credentials
2. **Try connecting from a different network** to test if it's network-specific
3. **Consider using OpenVPN directly** if CLI continues to fail

---

**Question**: On your laptop, are you using ProtonVPN CLI or the ProtonVPN GUI application? This might help identify if it's a CLI-specific issue.
