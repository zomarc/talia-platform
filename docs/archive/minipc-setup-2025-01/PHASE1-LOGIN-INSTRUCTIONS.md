# Phase 1 - Login Instructions

## Login Required (Interactive)

The ProtonVPN login requires interactive password entry, so you need to run this **manually** on the MiniPC.

### Steps:

1. **SSH to MiniPC:**
   ```bash
   ssh zomarc@192.168.1.120
   ```

2. **Run login command:**
   ```bash
   protonvpn-cli login russell@russellbryer.com
   ```

3. **Enter your ProtonVPN password** when prompted (it won't echo)

4. **After successful login**, test the connection:
   ```bash
   # Connect to UK#11
   protonvpn-cli connect UK#11
   
   # Wait a few seconds
   sleep 5
   
   # Verify IP address
   curl -s https://api.ipify.org
   # Should show: 149.40.48.92
   
   # Check status
   protonvpn-cli status
   ```

5. **Once connected and IP verified**, let me know and I'll:
   - Test the systemd service
   - Verify auto-start on boot
   - Complete Phase 1

---

**Note**: The systemd service is already configured and will work once you're logged in!
