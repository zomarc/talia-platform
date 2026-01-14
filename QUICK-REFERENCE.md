# Quick Reference - Talia Platform

## Environments

### Local (Development)
- **UI**: http://localhost:5173
- **GraphQL**: http://localhost:4000/graphql
- **Supabase Studio**: http://localhost:54323
- **Purpose**: Development and testing

### Staging (Client Demo)
- **Public URL**: https://taliahub.com
- **Local**: http://192.168.1.120:5173
- **GraphQL**: http://192.168.1.120:4000/graphql
- **SSH**: `ssh zomarc@192.168.1.120`
- **Purpose**: Client demos and staging testing

## Key Documents

### MiniPC Setup
- `MINIPC-SETUP-SUMMARY.md` - Complete reference
- `README-MINIPC.md` - Quick start
- `DEVELOPMENT-READY.md` - Environment status

### On MiniPC (`~/`)
- `PHASE1-REFERENCE-GUIDE.md` - ProtonVPN commands
- `NGROK-TALIAHUB-SETUP.md` - ngrok service management
- `MINIPC-SETUP-SUMMARY.md` - Complete reference

## Service Management

### Staging Services
```bash
# VPN
sudo systemctl status protonvpn-openvpn

# ngrok
sudo systemctl status ngrok-taliahub

# Docker
cd ~/talia-docker && docker compose ps
```

## Data Sync

**Via UI**: https://taliahub.com → Data Management  
**Via GraphQL**: `syncTable` mutation  
**Source**: Azure Synapse via VPN (IP: 149.40.48.92)

---

**Ready for Development** ✅
