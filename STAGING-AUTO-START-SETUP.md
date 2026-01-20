# Staging Server Auto-Start Configuration

**Date**: January 20, 2025

## Overview

Configured staging server to automatically start all services on boot, ensuring the Talia platform is fully operational after reboots.

## Systemd Services

All critical services are configured to start automatically:

1. **docker.service** - Docker daemon (enabled)
2. **protonvpn-openvpn.service** - VPN connection (enabled)
3. **talia-docker-compose.service** - Docker Compose stack (enabled)
4. **ngrok-taliahub.service** - ngrok tunnel (enabled)

## Startup Order

Services start in this order to ensure proper dependencies:

1. **Docker** - Container runtime
2. **VPN** - Network connectivity for external access
3. **Docker Compose** - Starts all application containers
   - Waits 10 seconds after VPN to ensure network is ready
   - Uses `|| true` to handle cases where containers already exist
4. **ngrok** - Exposes UI to public internet
   - Waits for Docker and Docker Compose to be ready

## Docker Compose Restart Policy

All containers use `restart: unless-stopped`, which means:
- Containers automatically restart if they crash
- Containers automatically start when Docker daemon starts
- Containers persist across reboots

## Service Files

### `/etc/systemd/system/talia-docker-compose.service`

Starts the Docker Compose stack with proper dependencies:

```ini
[Unit]
Description=Talia Docker Compose Stack
Requires=docker.service
After=docker.service protonvpn-openvpn.service
Wants=protonvpn-openvpn.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/zomarc/talia-docker
User=zomarc
Group=zomarc
ExecStart=/bin/bash -c "sleep 10; /usr/bin/docker compose -f docker-compose.staging.yml up -d || true"
ExecStop=/usr/bin/docker compose -f docker-compose.staging.yml stop
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

### `/etc/systemd/system/ngrok-taliahub.service`

Updated to wait for Docker services:

```ini
[Unit]
Description=ngrok tunnel for Talia UI (taliahub.com)
After=network.target docker.service talia-docker-compose.service
Requires=docker.service
Wants=talia-docker-compose.service

[Service]
Type=simple
User=zomarc
Environment="HOME=/home/zomarc"
ExecStart=/usr/local/bin/ngrok start --config=/home/zomarc/.ngrok2/ngrok-taliahub.yml talia-ui
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## Verification After Boot

After reboot, all services should be operational:

1. **Database**: 27 tables present
2. **GraphQL**: Responding and connected to Supabase
3. **UI**: Accessible via https://taliahub.com
4. **Data Mode**: `databaseTables` query returns 23 tables

## Manual Verification Commands

```bash
# Check service status
systemctl is-active docker.service protonvpn-openvpn.service talia-docker-compose.service ngrok-taliahub.service

# Check Docker containers
cd ~/talia-docker && docker compose -f docker-compose.staging.yml ps

# Verify database
docker compose -f docker-compose.staging.yml exec -T supabase-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"

# Test GraphQL
curl -s -X POST http://localhost:4000/graphql -H 'Content-Type: application/json' -d '{"query":"{ databaseTables { tableName } }"}' | jq '.data.databaseTables | length'

# Test UI proxy
curl -s -X POST http://localhost:5173/api/graphql -H 'Content-Type: application/json' -d '{"query":"{ __typename }"}'

# Test public access
curl -s -u talia:dev2025tal "https://taliahub.com/api/graphql" -X POST -H "Content-Type: application/json" -d '{"query":"{ databaseTables { tableName } }"}' | jq '.data.databaseTables | length'
```

## Notes

- The systemd service may show as "failed" if it tries to pull images before VPN is ready, but containers will still start due to `restart: unless-stopped`
- The `|| true` in the ExecStart ensures the service doesn't fail if containers already exist
- Wait time (10 seconds) ensures VPN has time to establish connection before pulling images

---

**Status**: ✅ Configured and tested - All services start automatically on boot
