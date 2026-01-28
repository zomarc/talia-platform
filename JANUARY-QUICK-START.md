# January 2025 - Quick Start Checklist

## 🎯 Goal
Get Talia Platform operational with:
- ✅ Local UI and GraphQL server running
- ✅ Supabase database on miniPC (locations.l)
- ✅ UI accessible to external client via ngrok

---

## Phase 1: Get Local Instance Running (30 minutes)

### ✅ Prerequisites Check
- [ ] Node.js >= 18.0.0 installed
- [ ] npm >= 8.0.0 installed
- [ ] Supabase CLI installed (`supabase --version`)

### ✅ Start Local Supabase
```bash
cd talia-server
supabase start
# Save the keys from output!
```

### ✅ Configure Environment Files
- [ ] Copy `talia-server/env.example` to `talia-server/.env`
- [ ] Update `talia-server/.env` with Supabase keys from above
- [ ] Create `talia-ui/.env` with:
  ```
  VITE_SUPABASE_URL=http://127.0.0.1:54321
  VITE_SUPABASE_ANON_KEY=<from-supabase-status>
  VITE_GRAPHQL_ENDPOINT=http://localhost:4000/graphql
  ```

### ✅ Install Dependencies
```bash
npm run install:all
```

### ✅ Start Servers
**Terminal 1:**
```bash
cd talia-server && npm start
```

**Terminal 2:**
```bash
cd talia-ui && npm run dev
```

### ✅ Verify
- [ ] UI opens at http://localhost:5173
- [ ] GraphQL Playground at http://localhost:4000
- [ ] UI can query data

**✅ Phase 1 Complete!**

---

## Phase 2: Backup Database (5 minutes)

### ✅ Create Backup
```bash
cd talia-server
npm run db-backup
# Note the backup filename!
```

### ✅ Verify Backup
- [ ] Backup file exists in `talia-server/backups/`
- [ ] File size is reasonable (> 1MB typically)

**✅ Phase 2 Complete!**

---

## Phase 3: Set Up Supabase on MiniPC (45 minutes)

### ✅ SSH to MiniPC
```bash
ssh <user>@locations.l
```

### ✅ Install Docker (if needed)
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker
```

### ✅ Install Supabase CLI
```bash
# See: https://supabase.com/docs/guides/cli/getting-started
wget -O supabase.deb https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.deb
sudo dpkg -i supabase.deb
```

### ✅ Initialize Supabase Project
```bash
mkdir -p ~/talia-supabase
cd ~/talia-supabase
supabase init
```

### ✅ Configure Network Access
- [ ] Edit `~/talia-supabase/supabase/config.toml`
- [ ] Change `[db] host = "0.0.0.0"` (allow network access)

### ✅ Copy Migrations
**From laptop:**
```bash
cd talia-server
tar -czf supabase-migrations.tar.gz supabase/migrations/
scp supabase-migrations.tar.gz <user>@locations.l:~/talia-supabase/
```

**On miniPC:**
```bash
cd ~/talia-supabase
tar -xzf supabase-migrations.tar.gz
```

### ✅ Start Supabase on MiniPC
```bash
cd ~/talia-supabase
supabase start
# Save the NEW keys from output!
```

### ✅ Copy Backup to MiniPC
**From laptop:**
```bash
scp talia-server/backups/supabase_backup_*.sql.gz <user>@locations.l:~/
```

### ✅ Restore Database
**On miniPC:**
```bash
# Install PostgreSQL client
sudo apt-get install -y postgresql-client

# Get connection string from: supabase status
# Restore database
gunzip supabase_backup_*.sql.gz
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" < supabase_backup_*.sql
```

### ✅ Configure Firewall
**On miniPC:**
```bash
sudo ufw allow 54321/tcp  # API
sudo ufw allow 54322/tcp  # Database
sudo ufw allow 54323/tcp  # Studio
```

### ✅ Get MiniPC IP Address
```bash
hostname -I
# Save this IP!
```

**✅ Phase 3 Complete!**

---

## Phase 4: Update Local Config to Use Remote Supabase (10 minutes)

### ✅ Update talia-server/.env
- [ ] Change `SUPABASE_URL=http://<miniPC-ip>:54321`
- [ ] Update `SUPABASE_ANON_KEY` with new key from miniPC
- [ ] Update `SUPABASE_SERVICE_ROLE_KEY` with new key from miniPC

### ✅ Update talia-ui/.env
- [ ] Change `VITE_SUPABASE_URL=http://<miniPC-ip>:54321`
- [ ] Update `VITE_SUPABASE_ANON_KEY` with new key from miniPC

### ✅ Test Connection
```bash
cd talia-server
npm run sync-test
# Should connect to miniPC!
```

### ✅ Restart Servers
- [ ] Stop current servers (Ctrl+C)
- [ ] Restart backend: `cd talia-server && npm start`
- [ ] Restart frontend: `cd talia-ui && npm run dev`

### ✅ Verify
- [ ] UI still works at http://localhost:5173
- [ ] Data loads from remote Supabase
- [ ] GraphQL queries work

**✅ Phase 4 Complete!**

---

## Phase 5: Expose UI for Client Access (15 minutes)

### ✅ Install ngrok (if needed)
```bash
# macOS: brew install ngrok/ngrok/ngrok
# Or download from: https://ngrok.com/download
```

### ✅ Authenticate ngrok
```bash
ngrok config add-authtoken <your-token>
# Get token from: https://dashboard.ngrok.com/get-started/your-authtoken
```

### ✅ Configure Custom Domain (Optional)
- [ ] Go to https://dashboard.ngrok.com/cloud-edge/domains
- [ ] Add domain (e.g., `taliahub.com`)
- [ ] Configure DNS
- [ ] Wait for DNS propagation

### ✅ Create ngrok Config
```bash
cd /path/to/talia
cp ngrok.yml.example ngrok.yml
# Edit ngrok.yml with your domain and basic auth credentials
```

### ✅ Start ngrok
**Terminal 3:**
```bash
cd /path/to/talia
ngrok start --config ngrok.yml talia
# Or free tier: ngrok http 5173
```

### ✅ Test External Access
- [ ] Open ngrok URL from different network/device
- [ ] Verify UI loads
- [ ] Test authentication (if configured)
- [ ] Verify API requests work

### ✅ Share with Client
- [ ] Provide ngrok URL
- [ ] Provide credentials (if basic auth configured)

**✅ Phase 5 Complete!**

---

## 🎉 All Phases Complete!

### Daily Startup (Quick Reference)

**On miniPC (if not running as service):**
```bash
ssh <user>@locations.l
cd ~/talia-supabase && supabase start
```

**On laptop:**
```bash
# Terminal 1
cd talia-server && npm start

# Terminal 2
cd talia-ui && npm run dev

# Terminal 3 (when client needs access)
ngrok start --config ngrok.yml talia
```

---

## 🆘 Quick Troubleshooting

**Can't connect to remote Supabase?**
- Check miniPC is accessible: `ping <miniPC-ip>`
- Check Supabase is running: `ssh <user>@locations.l "cd ~/talia-supabase && supabase status"`
- Check firewall: `sudo ufw status` (on miniPC)

**UI not accessible via ngrok?**
- Check ngrok dashboard: http://localhost:4040
- Check frontend is running: `curl http://localhost:5173`
- Verify ngrok config: `ngrok config check`

**Database issues?**
- Check backup file exists and has data
- Verify restore completed successfully
- Check Supabase logs: `supabase logs` (on miniPC)

---

## 📚 Full Documentation

See `JANUARY-MIGRATION-GUIDE.md` for detailed instructions and troubleshooting.

---

**Estimated Total Time**: ~2 hours
**Last Updated**: January 2025
