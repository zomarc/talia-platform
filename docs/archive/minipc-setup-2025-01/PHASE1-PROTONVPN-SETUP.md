# Phase 1: ProtonVPN Setup on MiniPC

## Overview

Set up ProtonVPN CLI on MiniPC and configure it as a systemd service to automatically connect on boot, using the same account as your laptop to get IP `149.40.48.92`.

## Prerequisites

- SSH access to MiniPC (192.168.1.120)
- ProtonVPN account credentials (same as laptop)
- Sudo access on MiniPC

## Step-by-Step Installation

### Step 1: SSH to MiniPC

```bash
ssh zomarc@192.168.1.120
```

### Step 2: Install ProtonVPN CLI

```bash
# Download ProtonVPN repository package
cd /tmp
wget https://repo.protonvpn.com/debian/dists/stable/main/binary-all/protonvpn-stable-release_1.0.3-3_all.deb -O protonvpn-release.deb

# Install repository
sudo dpkg -i protonvpn-release.deb

# Fix any dependency issues
sudo apt-get install -f -y

# Update package list
sudo apt-get update

# Install ProtonVPN CLI
sudo apt-get install -y protonvpn-cli
```

### Step 3: Login to ProtonVPN

```bash
# Login with your ProtonVPN credentials (same account as laptop)
sudo protonvpn-cli login
```

Enter your ProtonVPN username and password when prompted.

### Step 4: Find Server with Correct IP

We need to find which server gives IP `149.40.48.92`. Let's test:

```bash
# Connect to fastest server first
sudo protonvpn-cli connect --fastest

# Wait a few seconds for connection
sleep 5

# Check current IP
curl -s https://api.ipify.org

# Check VPN status
sudo protonvpn-cli status
```

**If IP matches 149.40.48.92:**
- Note the server name from `protonvpn-cli status`
- We'll use this server in the systemd service

**If IP doesn't match:**
- Disconnect: `sudo protonvpn-cli disconnect`
- List available servers: `sudo protonvpn-cli connect --server-list`
- Try connecting to different servers until you find one that gives IP `149.40.48.92`
- Note the server name/ID

### Step 5: Create Systemd Service

Create the service file:

```bash
sudo nano /etc/systemd/system/protonvpn.service
```

Add the following content:

```ini
[Unit]
Description=ProtonVPN Connection
After=network.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
# Option 1: Use fastest server (may change IP)
ExecStart=/usr/bin/protonvpn-cli connect --fastest

# Option 2: Use specific server (if you found one with correct IP)
# Replace <SERVER_NAME> with actual server name from step 4
# ExecStart=/usr/bin/protonvpn-cli connect --server <SERVER_NAME>

ExecStop=/usr/bin/protonvpn-cli disconnect
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Important:** 
- If you found a specific server with IP `149.40.48.92`, uncomment the `ExecStart` line with `--server` and comment out the `--fastest` line
- Replace `<SERVER_NAME>` with the actual server name

Save and exit (Ctrl+X, then Y, then Enter).

### Step 6: Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable protonvpn.service

# Start the service now
sudo systemctl start protonvpn.service

# Check status
sudo systemctl status protonvpn.service

# Verify connection
sleep 5
curl -s https://api.ipify.org
sudo protonvpn-cli status
```

### Step 7: Verify IP Address

```bash
# Check external IP
curl -s https://api.ipify.org

# Should show: 149.40.48.92
```

If it shows the correct IP, you're done!

## Service Management Commands

```bash
# Start VPN
sudo systemctl start protonvpn

# Stop VPN
sudo systemctl stop protonvpn

# Check status
sudo systemctl status protonvpn

# View logs
sudo journalctl -u protonvpn -f

# Disable auto-start
sudo systemctl disable protonvpn
```

## Troubleshooting

### VPN won't connect
```bash
# Check ProtonVPN status
sudo protonvpn-cli status

# Try manual connection
sudo protonvpn-cli connect --fastest

# Check logs
sudo journalctl -u protonvpn -n 50
```

### Wrong IP address
- The `--fastest` option may connect to different servers
- Use `--server <SERVER_NAME>` with a specific server that gives the correct IP
- Update the systemd service file with the specific server

### Service fails to start
```bash
# Check service logs
sudo journalctl -u protonvpn -n 100

# Test manual connection
sudo protonvpn-cli connect --fastest

# Verify ProtonVPN CLI is working
sudo protonvpn-cli --version
```

## Next Steps

Once ProtonVPN is working:
1. Verify IP is `149.40.48.92`
2. Test that Docker containers can still communicate locally
3. Proceed to Phase 2: Security Hardening

---

**Note:** If you need to find a specific server that always gives IP `149.40.48.92`, you may need to:
1. Connect to different servers manually
2. Check IP each time
3. Note which server gives the correct IP
4. Use that server name in the systemd service
