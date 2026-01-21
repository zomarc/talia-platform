# Staging Setup Summary

**Date**: January 14, 2025  
**Status**: ✅ Fully Operational  
**Environment**: Staging (Client Demo)

## Quick Reference

### Access URLs
- **Public**: https://taliahub.com
- **Local UI**: http://192.168.1.120:5173
- **GraphQL**: http://192.168.1.120:4000/graphql
- **Supabase Studio**: http://192.168.1.120:54323

### Service Management

**ProtonVPN**:
```bash
sudo systemctl status protonvpn-openvpn
sudo systemctl restart protonvpn-openvpn
curl -s https://api.ipify.org  # Should show: 149.40.48.92
```

**ngrok**:
```bash
sudo systemctl status ngrok-taliahub
sudo systemctl restart ngrok-taliahub
```

**Docker Services**:
```bash
cd ~/talia-docker
docker compose ps
docker compose restart graphql-server
```

### Key Files (Staging)
- Config: `~/talia-docker/docker-compose.yml`
- VPN Config: `~/protonvpn-uk11.ovpn`
- VPN Auth: `~/protonvpn-auth.txt`
- ngrok Service: `/etc/systemd/system/ngrok-taliahub.service`

## Configuration Details

### ProtonVPN
- **Server**: UK#11
- **IP**: 149.40.48.92
- **Method**: OpenVPN
- **Auto-start**: Enabled

### Supabase
- **URL**: `http://supabase-kong:8000` (internal Docker)
- **Database**: Restored with 27 tables
- **Connection**: Working ✅

### ngrok
- **Domain**: taliahub.com
- **Port**: 5173 (UI)
- **Auto-start**: Enabled

## Data Sync

**Available via UI**:
- Access: https://taliahub.com → Data Management
- Sync from Azure Synapse via VPN
- Store in local Supabase

**GraphQL Mutation**:
```graphql
mutation {
  syncTable(tableName: "master_sail", forceFullSync: false) {
    success
    recordsProcessed
    error
  }
}
```

## Quick Troubleshooting

### Quick Validation
Run from your local machine to check all connectivity:
```bash
./scripts/validate-staging-connectivity.sh
```

### Quick Restart (VPN + ngrok only)
If taliahub.com is disconnected, quickly restart VPN and ngrok:
```bash
./scripts/restart-staging-tunnel.sh
```

### Comprehensive Fix
Automatically diagnose and fix all connectivity issues:
```bash
./scripts/fix-staging-connectivity.sh
```

### Common Issues and Solutions

#### taliahub.com Not Accessible

**Symptoms**: 
- Cannot access https://taliahub.com
- Connection timeout or ERR_NGROK_3200 error

**Quick Fix** (from local machine):
```bash
./scripts/restart-staging-tunnel.sh
```

**Manual Fix** (SSH to staging):
```bash
ssh zomarc@192.168.1.120

# Stop ngrok first
sudo systemctl stop ngrok-taliahub

# Restart VPN
sudo systemctl restart protonvpn-openvpn
sleep 10

# Verify VPN IP (should be 149.40.48.92)
curl -s https://api.ipify.org

# Restart ngrok
sudo systemctl restart ngrok-taliahub
sleep 5

# Verify ngrok tunnel
curl -s http://localhost:4040/api/tunnels
```

#### VPN Not Connecting

**Symptoms**:
- VPN service shows as inactive
- IP address is not 149.40.48.92
- Azure Synapse connectivity fails

**Check VPN Status**:
```bash
ssh zomarc@192.168.1.120
sudo systemctl status protonvpn-openvpn
curl -s https://api.ipify.org  # Should show: 149.40.48.92
ip addr show tun0  # Should show tun0 interface
```

**Restart VPN**:
```bash
sudo systemctl restart protonvpn-openvpn
sleep 10
curl -s https://api.ipify.org
```

**Check VPN Logs**:
```bash
sudo journalctl -u protonvpn-openvpn -n 50
```

**Common Causes**:
- Internet connection dropped (router reboot, ISP issue)
- VPN server maintenance
- Credentials expired (check `~/protonvpn-auth.txt`)

#### ngrok Not Working

**Symptoms**:
- ngrok service shows as inactive
- Tunnel not found in ngrok API
- Public URL returns connection errors

**Check ngrok Status**:
```bash
ssh zomarc@192.168.1.120
sudo systemctl status ngrok-taliahub
curl -s http://localhost:4040/api/tunnels
```

**Restart ngrok** (VPN must be running first):
```bash
# Ensure VPN is connected
curl -s https://api.ipify.org  # Should show: 149.40.48.92

# Restart ngrok
sudo systemctl restart ngrok-taliahub
sleep 5
curl -s http://localhost:4040/api/tunnels
```

**Check ngrok Logs**:
```bash
sudo journalctl -u ngrok-taliahub -n 50
```

**Common Error Codes**:
- `ERR_NGROK_3200`: Domain not found or not configured in ngrok dashboard
- `ERR_NGROK_3201`: Domain already in use (another ngrok instance running)
- Connection timeout: VPN not connected or UI service not running

**Verify ngrok Config**:
```bash
cat ~/.ngrok2/ngrok-taliahub.yml
```

#### Supabase Offline

**Symptoms**:
- GraphQL queries fail
- Database connection errors

**Check Docker Services**:
```bash
cd ~/talia-docker
docker compose -f docker-compose.staging.yml ps
```

**Restart Services**:
```bash
docker compose -f docker-compose.staging.yml restart supabase-db supabase-rest supabase-kong
sleep 5
docker compose -f docker-compose.staging.yml restart graphql-server
```

#### Azure Synapse Connectivity

**Symptoms**:
- Data sync fails
- Azure connection status shows offline

**Test Connection**:
```bash
# From local machine
./scripts/validate-staging-connectivity.sh --azure

# Or via GraphQL
curl -X POST http://192.168.1.120:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ synapseConnectionStatus { online error } }"}'
```

**Verify VPN is Connected**:
- Azure connectivity requires VPN to be active
- Check VPN IP: `curl -s https://api.ipify.org` (should be 149.40.48.92)
- If VPN is down, restart it first

## Recovery Procedures

### After Internet Connection Loss

If the staging server's internet connection was interrupted (e.g., router reboot at 3am):

1. **Quick Recovery** (from local machine):
   ```bash
   ./scripts/fix-staging-connectivity.sh
   ```

2. **Manual Recovery** (SSH to staging):
   ```bash
   ssh zomarc@192.168.1.120
   
   # Restart VPN
   sudo systemctl restart protonvpn-openvpn
   sleep 10
   curl -s https://api.ipify.org  # Verify: 149.40.48.92
   
   # Restart ngrok
   sudo systemctl restart ngrok-taliahub
   sleep 5
   
   # Verify services
   sudo systemctl status protonvpn-openvpn ngrok-taliahub
   ```

### After Server Reboot

All services are configured to auto-start, but verify:

```bash
ssh zomarc@192.168.1.120

# Check all services
systemctl is-active docker.service protonvpn-openvpn.service talia-docker-compose.service ngrok-taliahub.service

# If any are inactive, start them
sudo systemctl start protonvpn-openvpn
sleep 10
sudo systemctl start ngrok-taliahub
```

### Complete Service Restart

If everything needs to be restarted:

```bash
# From local machine
./scripts/restart-and-check.sh staging --restart

# Or tunnel-only (faster)
./scripts/restart-and-check.sh staging --tunnel-only
```

## Troubleshooting

**VPN not connecting**:
- Check: `sudo systemctl status protonvpn-openvpn`
- Verify IP: `curl -s https://api.ipify.org`
- Check logs: `sudo journalctl -u protonvpn-openvpn -n 50`
- Reference: `~/PHASE1-REFERENCE-GUIDE.md`

**Supabase offline**:
- Check: `docker compose ps` (all services running?)
- Restart: `docker compose restart graphql-server supabase-rest supabase-kong`

**ngrok not working**:
- Check: `sudo systemctl status ngrok-taliahub`
- Verify: `curl -s http://localhost:4040/api/tunnels`
- Check logs: `sudo journalctl -u ngrok-taliahub -n 50`
- Domain config: https://dashboard.ngrok.com/domains

---

**Last Updated**: January 20, 2025
