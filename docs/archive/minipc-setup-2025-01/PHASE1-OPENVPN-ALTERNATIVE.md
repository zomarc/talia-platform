# Phase 1 - OpenVPN Alternative Solution

## Current Situation

- ✅ Laptop uses ProtonVPN GUI (works fine)
- ❌ MiniPC ProtonVPN CLI fails (DNS resolution issue)
- Both on same network

## Solution: Use OpenVPN Directly

Since the ProtonVPN CLI has API connectivity issues, we'll use OpenVPN directly with ProtonVPN's OpenVPN configuration files. This is more reliable and doesn't depend on the ProtonVPN CLI API.

## Steps

### 1. Download OpenVPN Config from ProtonVPN Account

1. Go to: https://account.protonvpn.com/login
2. Navigate to: **Downloads** → **OpenVPN configuration files**
3. Download the config for **UK#11** server (or UK servers in general)
4. You'll need:
   - The `.ovpn` config file for UK#11
   - Your **OpenVPN username** (usually `USERNAME+1` format)
   - Your **OpenVPN password** (different from Proton account password)

### 2. Install OpenVPN on MiniPC

```bash
ssh zomarc@192.168.1.120
sudo apt-get update
sudo apt-get install -y openvpn
```

### 3. Upload Config File

```bash
# From your laptop
scp UK#11.ovpn zomarc@192.168.1.120:~/protonvpn-uk11.ovpn
```

### 4. Create Credentials File

```bash
# On MiniPC
ssh zomarc@192.168.1.120
cat > ~/protonvpn-auth.txt << EOF
YOUR_OPENVPN_USERNAME
YOUR_OPENVPN_PASSWORD
EOF
chmod 600 ~/protonvpn-auth.txt
```

### 5. Update OpenVPN Config

Edit the `.ovpn` file to use the auth file:

```bash
# Add this line to the .ovpn file
echo "auth-user-pass /home/zomarc/protonvpn-auth.txt" >> ~/protonvpn-uk11.ovpn
```

### 6. Test Connection

```bash
sudo openvpn --config ~/protonvpn-uk11.ovpn
```

### 7. Create Systemd Service

Once tested, create a systemd service for auto-start.

---

**Next**: Once you have the OpenVPN config file and credentials, I can help set this up automatically!
