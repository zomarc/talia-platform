# Staging Development Environment

## Quick Start

The staging environment is fully configured and operational at **https://taliahub.com**

### Essential Commands

```bash
# SSH to staging
ssh zomarc@192.168.1.120

# Check services
sudo systemctl status protonvpn-openvpn ngrok-taliahub
cd ~/talia-docker && docker compose ps

# Restart services
sudo systemctl restart protonvpn-openvpn
sudo systemctl restart ngrok-taliahub
cd ~/talia-docker && docker compose restart graphql-server
```

## Reference Documents

- **`STAGING-SETUP-SUMMARY.md`** - Complete setup reference
- **`PHASE1-REFERENCE-GUIDE.md`** - ProtonVPN commands
- **`NGROK-TALIAHUB-SETUP.md`** - ngrok service management
- **`DEVELOPMENT-WORKFLOW.md`** - Development and deployment guide

## Archived Documentation

Setup documentation and scripts are archived in:
- `docs/archive/minipc-setup-2025-01/`

---

**Ready for Development** ✅
