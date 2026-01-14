# Phase 1: OpenVPN Setup (Alternative to ProtonVPN CLI)

## Why OpenVPN?

The ProtonVPN CLI requires API access that's not resolving on your network. Since you're using the GUI on your laptop (which works), we'll use OpenVPN directly - this is what ProtonVPN uses under the hood anyway.

## Prerequisites

1. **OpenVPN credentials** from ProtonVPN account:
   - Go to: https://account.protonvpn.com/login
   - Navigate to: **Downloads** → **OpenVPN configuration files**
   - Your **OpenVPN username** (usually `USERNAME+1` or similar format)
   - Your **OpenVPN password** (different from Proton account password)

2. **Download UK server config**:
   - Download the `.ovpn` file for UK servers (or specifically UK#11 if available)
   - Or download the zip file with all configs

## Step 1: Get OpenVPN Config File

**Option A: Download from ProtonVPN website**
1. Login: https://account.protonvpn.com/login
2. Go to Downloads → OpenVPN configuration files
3. Download UK server config (or all configs as zip)

**Option B: Extract from ProtonVPN GUI** (if you have access to config files)
- The GUI stores configs somewhere - we can find them

## Step 2: Upload Config to MiniPC

Once you have the `.ovpn` file:

```bash
# From your laptop
scp UK-server.ovpn zomarc@192.168.1.120:~/protonvpn-uk11.ovpn
```

## Step 3: Create Credentials File

```bash
ssh zomarc@192.168.1.120
cat > ~/protonvpn-auth.txt << EOF
YOUR_OPENVPN_USERNAME
YOUR_OPENVPN_PASSWORD
EOF
chmod 600 ~/protonvpn-auth.txt
```

## Step 4: Update Config File

Edit the `.ovpn` file to use the auth file:

```bash
# Check if auth-user-pass already exists
grep -i "auth-user-pass" ~/protonvpn-uk11.ovpn

# If not present, add it (or replace existing one)
sed -i 's|auth-user-pass.*|auth-user-pass /home/zomarc/protonvpn-auth.txt|' ~/protonvpn-uk11.ovpn
```

## Step 5: Test Connection

```bash
sudo openvpn --config ~/protonvpn-uk11.ovpn
```

Wait for connection, then verify IP:
```bash
# In another terminal
curl -s https://api.ipify.org
# Should show: 149.40.48.92
```

## Step 6: Create Systemd Service

Once connection works, create service:

```bash
sudo nano /etc/systemd/system/protonvpn-openvpn.service
```

Add:
```ini
[Unit]
Description=ProtonVPN OpenVPN Connection (UK#11)
After=network.target
Wants=network-online.target

[Service]
Type=notify
ExecStart=/usr/sbin/openvpn --config /home/zomarc/protonvpn-uk11.ovpn
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable protonvpn-openvpn.service
sudo systemctl start protonvpn-openvpn.service
sudo systemctl status protonvpn-openvpn.service
```

## Next Steps

**Please provide:**
1. Can you access your ProtonVPN account to download OpenVPN configs?
2. Do you know your OpenVPN username/password? (Different from Proton account)

Once you have these, I can automate the setup!
