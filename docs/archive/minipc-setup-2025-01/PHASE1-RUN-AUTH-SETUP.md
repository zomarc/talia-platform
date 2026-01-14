# Phase 1: Run Auth Setup

## Step 1: Create Auth File

**SSH to MiniPC and run:**

```bash
ssh zomarc@192.168.1.120
bash ~/setup-openvpn-auth.sh
```

Enter your **OpenVPN password** when prompted (it won't echo).

## Step 2: Test Connection

After the auth file is created, test the connection:

```bash
# Start OpenVPN (will run in foreground)
sudo openvpn --config ~/protonvpn-uk11.ovpn
```

**Wait for connection** - you should see messages like:
- `Initialization Sequence Completed`
- `Peer Connection Initiated`

## Step 3: Verify IP (in another terminal)

Open a **new SSH session** and check:

```bash
ssh zomarc@192.168.1.120
curl -s https://api.ipify.org
```

**Should show**: `149.40.48.92`

## Step 4: If IP is Correct

Once verified, press `Ctrl+C` in the OpenVPN terminal to stop it, then let me know and I'll create the systemd service for auto-start!

---

**Note**: If authentication fails, your OpenVPN username might be different from your email. Check your ProtonVPN account → Downloads → OpenVPN configs for the correct username format.
