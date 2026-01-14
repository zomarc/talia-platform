# Phase 1 - Step 2: ProtonVPN Login

## Status

✅ **Step 1 Complete**: ProtonVPN CLI installed (v3.13.0)

## Step 2: Login to ProtonVPN

You need to login with your ProtonVPN credentials (same account as your laptop).

### Option A: Interactive Login (Recommended)

SSH to MiniPC and run:

```bash
ssh zomarc@192.168.1.120
sudo protonvpn-cli login
```

Enter your ProtonVPN username and password when prompted.

### Option B: Non-Interactive Login (if you have credentials ready)

If you want to provide credentials non-interactively:

```bash
ssh zomarc@192.168.1.120
sudo protonvpn-cli login --username YOUR_USERNAME
# Then enter password when prompted
```

## Verify Login

After logging in, verify:

```bash
protonvpn-cli status
```

Should show your account status (not connected yet).

## Next Steps

Once logged in, we'll proceed to:
- Step 3: Find server with IP 149.40.48.92
- Step 4: Create systemd service
- Step 5: Test connection

---

**Current Status**: Ready for login step
