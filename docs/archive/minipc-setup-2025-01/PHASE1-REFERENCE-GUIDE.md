# ProtonVPN OpenVPN - Quick Reference Guide

## 1. Service Commands and Status Checks

### Service Management
```bash
# Start VPN
sudo systemctl start protonvpn-openvpn

# Stop VPN
sudo systemctl stop protonvpn-openvpn

# Restart VPN
sudo systemctl restart protonvpn-openvpn

# Check service status
sudo systemctl status protonvpn-openvpn

# Enable auto-start on boot
sudo systemctl enable protonvpn-openvpn

# Disable auto-start
sudo systemctl disable protonvpn-openvpn
```

### Status Checks
```bash
# View service logs
sudo journalctl -u protonvpn-openvpn -f
# Or: sudo tail -f /var/log/openvpn-uk11.log

# Check VPN interface
ip addr show tun0

# Verify external IP (should be 149.40.48.92)
curl -s https://api.ipify.org

# Check if OpenVPN process is running
ps aux | grep openvpn
```

---

## 2. Configuration and Status

### File Locations
- **Config File**: `/home/zomarc/protonvpn-uk11.ovpn`
- **Auth File**: `/home/zomarc/protonvpn-auth.txt` (username:password)
- **Service File**: `/etc/systemd/system/protonvpn-openvpn.service`
- **Log File**: `/var/log/openvpn-uk11.log`
- **PID File**: `/var/run/openvpn-uk11.pid`

### Current Configuration
- **Server**: UK#11 (node-uk-19.protonvpn.net)
- **Target IP**: 149.40.48.92
- **Protocol**: UDP
- **Interface**: tun0
- **Auto-start**: Enabled

### Expected Status
```bash
# Service should show:
# Active: active (running)
# Status: "Initialization Sequence Completed"

# IP check should return:
# 149.40.48.92

# Interface should show:
# tun0: <POINTOPOINT,MULTICAST,NOARP,UP,LOWER_UP>
```

---

## 3. Credentials Reference

### Where to Find OpenVPN Credentials

**Location**: https://account.protonvpn.com/login

**Steps**:
1. Login to ProtonVPN account
2. Navigate to: **Downloads** → **OpenVPN configuration files**
3. Find your credentials displayed there:
   - **OpenVPN Username**: Format like `brn2jL80fIN3pNBA+b` (NOT your email)
   - **OpenVPN Password**: Different from Proton account password

### Username Format for UK#11
- **Base username**: `brn2jL80fIN3pNBA+b` (example - use YOUR actual username)
- **For UK#11 exit IP**: Append `:10` → `brn2jL80fIN3pNBA+b:10`
- **With NetShield**: Append `:10+f2` → `brn2jL80fIN3pNBA+b:10+f2`

### Update Auth File
```bash
# Edit auth file
nano ~/protonvpn-auth.txt

# Format (2 lines):
# Line 1: YOUR_OPENVPN_USERNAME:10
# Line 2: YOUR_OPENVPN_PASSWORD

# Set permissions
chmod 600 ~/protonvpn-auth.txt

# Restart service
sudo systemctl restart protonvpn-openvpn
```

### Troubleshooting
- **AUTH_FAILED**: Check username format includes `:10` suffix and password is correct
- **No connection**: Verify credentials at https://account.protonvpn.com/login
- **Wrong IP**: Ensure username ends with `:10` for UK#11 exit IP

---

**Last Updated**: January 14, 2025
