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

## Troubleshooting

**VPN not connecting**:
- Check: `sudo systemctl status protonvpn-openvpn`
- Verify IP: `curl -s https://api.ipify.org`
- Reference: `~/PHASE1-REFERENCE-GUIDE.md`

**Supabase offline**:
- Check: `docker compose ps` (all services running?)
- Restart: `docker compose restart graphql-server supabase-rest supabase-kong`

**ngrok not working**:
- Check: `sudo systemctl status ngrok-taliahub`
- Verify: `curl -s http://localhost:4040/api/tunnels`
- Domain config: https://dashboard.ngrok.com/domains

---

**Last Updated**: January 14, 2025
