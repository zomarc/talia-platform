# Next Steps: MiniPC Setup

## Current Status

✅ **Phase 1 Complete**: ProtonVPN OpenVPN configured (IP: 149.40.48.92)  
✅ **Docker Stack Running**: Supabase, GraphQL server, UI  
⚠️ **Supabase Connection**: Fixing connection issue  
⏳ **ngrok Setup**: Ready to configure

## Step 1: Fix Supabase Connection ✅

**Issue**: GraphQL server needs correct Supabase URL format.

**Fix Applied**: Updated `SUPABASE_URL` to `http://supabase-kong:8000` (without `/rest/v1` - Supabase client adds this automatically)

**Verify**:
```bash
ssh zomarc@192.168.1.120
cd ~/talia-docker
docker compose logs graphql-server --tail 20
curl -s http://localhost:4000/graphql -X POST -H 'Content-Type: application/json' -d '{"query":"{ supabaseConnectionStatus { online server database } }"}'
```

Should show: `"online": true`

## Step 2: Configure ngrok for UI Access

**Setup ngrok**:
```bash
ssh zomarc@192.168.1.120
bash ~/setup-ngrok-ui.sh
```

**Start ngrok**:
```bash
sudo systemctl start ngrok-ui
sudo systemctl enable ngrok-ui
sudo systemctl status ngrok-ui
```

**Get public URL**:
```bash
curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*' | head -1
```

## Step 3: Verify Data Integration

**Test Supabase connection**:
```bash
# From MiniPC
curl -s http://localhost:4000/graphql -X POST -H 'Content-Type: application/json' -d '{"query":"{ supabaseConnectionStatus { online server database } }"}'
```

**Test data query**:
```bash
curl -s http://localhost:4000/graphql -X POST -H 'Content-Type: application/json' -d '{"query":"{ ships { id name } }"}'
```

**Access Supabase Studio**:
- URL: `http://192.168.1.120:54323`
- Use Studio to verify tables and data

## Step 4: Data Integration Workflow

1. **Sync from Azure Synapse** (via VPN):
   - GraphQL server can connect to Azure Synapse through VPN
   - Use sync endpoints to pull data

2. **Store in Supabase**:
   - Data is stored in local Supabase instance
   - Accessible via GraphQL API

3. **UI Access**:
   - Local: `http://192.168.1.120:5173`
   - External: ngrok URL (after setup)

## Files Reference

- **Docker Compose**: `~/talia-docker/docker-compose.talia.yml`
- **Supabase Config**: `~/talia-docker/supabase/kong.yml`
- **ngrok Config**: `~/.ngrok2/ngrok-ui.yml`
- **ProtonVPN Reference**: `~/PHASE1-REFERENCE-GUIDE.md`

---

**Next**: After Supabase connection is verified, proceed with ngrok setup and data integration testing.
