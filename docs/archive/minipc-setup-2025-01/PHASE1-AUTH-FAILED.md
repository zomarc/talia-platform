# Phase 1: Authentication Failed

## Issue

OpenVPN connection failed with `AUTH_FAILED`. This means either:
1. The username format is incorrect
2. The password is incorrect
3. The OpenVPN username is different from your Proton account email

## Solution

The OpenVPN username is **NOT** your email address. It's a different credential format.

### How to Find Your OpenVPN Username

1. **Go to**: https://account.protonvpn.com/login
2. **Navigate to**: Downloads → OpenVPN configuration files
3. **Look for**: Your OpenVPN username (usually displayed near the download area)
   - It might be in format like: `brn2jL80fIN3pNBA+b` (example from config)
   - Or it might be your Proton account username in a different format

### Update Auth File

Once you have the correct OpenVPN username:

```bash
ssh zomarc@192.168.1.120
nano ~/protonvpn-auth.txt
```

**Format should be**:
```
YOUR_OPENVPN_USERNAME:10
YOUR_OPENVPN_PASSWORD
```

**Important**: The `:10` suffix is required for UK#11 exit IP (149.40.48.92)

### Test Again

After updating:
```bash
sudo pkill openvpn
sudo openvpn --config ~/protonvpn-uk11.ovpn --daemon openvpn-uk11 --log /tmp/openvpn.log
sleep 8
sudo cat /tmp/openvpn.log | tail -20
curl -s https://api.ipify.org
```

---

**Next**: Once you have the correct OpenVPN username, update the auth file and test again!
