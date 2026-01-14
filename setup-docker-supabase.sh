#!/bin/bash
# Docker-based Supabase setup for miniPC
# Run this script ON THE MINIPC after SSH'ing in

set -e  # Exit on error

echo "🐳 Setting up Supabase with Docker on miniPC..."
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "⚠️  Please run as regular user, not root"
   exit 1
fi

# Step 1: Verify Docker is running
echo "📦 Step 1: Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "   ❌ Docker not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y docker.io docker-compose
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker $USER
    echo "   ✅ Docker installed. You may need to log out and back in."
    exit 1
fi

if ! docker ps &> /dev/null; then
    echo "   ❌ Docker daemon not running. Starting..."
    sudo systemctl start docker
    sudo systemctl enable docker
fi

echo "   ✅ Docker is running: $(docker --version)"
echo "   ✅ Docker Compose available: $(docker compose version 2>/dev/null || echo 'via docker compose')"

# Step 2: Create project directory
echo ""
echo "📁 Step 2: Creating project directory..."
PROJECT_DIR="$HOME/talia-supabase-docker"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

echo "   ✅ Project directory: $PROJECT_DIR"

# Step 3: Create directory structure
echo ""
echo "📁 Step 3: Creating directory structure..."
mkdir -p supabase/init
mkdir -p supabase/migrations
echo "   ✅ Directories created"

# Step 4: Get IP address for configuration
echo ""
echo "🌐 Step 4: Getting network configuration..."
IP_ADDRESS=$(hostname -I | awk '{print $1}')
echo "   MiniPC IP Address: $IP_ADDRESS"

# Step 5: Create docker-compose file
echo ""
echo "📝 Step 5: Creating docker-compose.yml..."
cat > docker-compose.yml << EOF
version: '3.8'

services:
  supabase-db:
    container_name: talia-supabase-db
    image: supabase/postgres:15.1.1.117
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10
    ports:
      - "54322:5432"
    environment:
      POSTGRES_HOST: /var/run/postgresql
      PGDATA: /var/lib/postgresql/data
      POSTGRES_PORT: 5432
      POSTGRES_DB: postgres
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - supabase-db-data:/var/lib/postgresql/data
      - ./supabase/init:/docker-entrypoint-initdb.d
    restart: unless-stopped
    networks:
      - talia-network

  supabase-studio:
    container_name: talia-supabase-studio
    image: supabase/studio:20241027-85b84e0
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/profile', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 10s
      timeout: 5s
      retries: 3
    ports:
      - "54323:3000"
    environment:
      STUDIO_PG_META_URL: http://supabase-pg-meta:8080
      POSTGRES_PASSWORD: postgres
      DEFAULT_ORGANIZATION_NAME: Talia
      DEFAULT_PROJECT_NAME: Talia Platform
    depends_on:
      supabase-db:
        condition: service_healthy
      supabase-pg-meta:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - talia-network

  supabase-pg-meta:
    container_name: talia-supabase-pg-meta
    image: supabase/postgres-meta:v0.93.1
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 10
    ports:
      - "8080:8080"
    environment:
      PG_META_PORT: 8080
      PG_META_DB_HOST: supabase-db
      PG_META_DB_PORT: 5432
      PG_META_DB_NAME: postgres
      PG_META_DB_USER: postgres
      PG_META_DB_PASSWORD: postgres
    depends_on:
      supabase-db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - talia-network

  supabase-kong:
    container_name: talia-supabase-kong
    image: kong:2.8.1
    ports:
      - "54321:8000"
      - "8001:8001"
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl,basic-auth
      KONG_NGINX_PROXY_PROXY_BUFFER_SIZE: 160k
      KONG_NGINX_PROXY_PROXY_BUFFERS: 64 160k
    volumes:
      - ./supabase/kong.yml:/var/lib/kong/kong.yml:ro
    depends_on:
      supabase-db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - talia-network

  supabase-auth:
    container_name: talia-supabase-auth
    image: supabase/gotrue:v2.156.0
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:9999/health"]
      interval: 5s
      timeout: 5s
      retries: 10
    ports:
      - "9999:9999"
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: http://${IP_ADDRESS}:54321
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://postgres:postgres@supabase-db:5432/postgres
      GOTRUE_SITE_URL: http://${IP_ADDRESS}:54321
      GOTRUE_URI_ALLOW_LIST: "*"
      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_JWT_SECRET: super-secret-jwt-token-with-at-least-32-characters-long
      GOTRUE_JWT_EXP: 3600
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      GOTRUE_MAILER_AUTOCONFIRM: "true"
    depends_on:
      supabase-db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - talia-network

  supabase-rest:
    container_name: talia-supabase-rest
    image: postgrest/postgrest:v12.2.0
    ports:
      - "3000:3000"
    environment:
      PGRST_DB_URI: postgres://postgres:postgres@supabase-db:5432/postgres
      PGRST_DB_SCHEMAS: public,storage,graphql_public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: super-secret-jwt-token-with-at-least-32-characters-long
      PGRST_DB_USE_LEGACY_GUCS: "false"
      PGRST_APP_SETTINGS_JWT_SECRET: super-secret-jwt-token-with-at-least-32-characters-long
    depends_on:
      supabase-db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - talia-network

volumes:
  supabase-db-data:
    driver: local

networks:
  talia-network:
    driver: bridge
EOF

echo "   ✅ docker-compose.yml created"

# Step 6: Create Kong configuration
echo ""
echo "📝 Step 6: Creating Kong configuration..."
mkdir -p supabase
cat > supabase/kong.yml << 'KONGEOF'
_format_version: "3.0"
_transform: true

consumers:
  - username: anon
    keyauth_credentials:
      - key: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
  - username: service_role
    keyauth_credentials:
      - key: sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz

services:
  - name: auth-v1
    url: http://supabase-auth:9999/
    routes:
      - name: auth-v1
        strip_path: true
        paths:
          - /auth/v1/
    plugins:
      - name: cors

  - name: rest-v1
    url: http://supabase-rest:3000/
    routes:
      - name: rest-v1
        strip_path: true
        paths:
          - /rest/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: false

  - name: meta
    url: http://supabase-pg-meta:8080/
    routes:
      - name: meta
        strip_path: true
        paths:
          - /pg/
    plugins:
      - name: cors
KONGEOF

echo "   ✅ Kong configuration created"

# Step 7: Configure firewall
echo ""
echo "🔥 Step 7: Configuring firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 54321/tcp comment "Supabase API"
    sudo ufw allow 54322/tcp comment "Supabase Database"
    sudo ufw allow 54323/tcp comment "Supabase Studio"
    echo "   ✅ Firewall rules added"
else
    echo "   ⚠️  UFW not found. Please manually configure firewall to allow ports 54321-54323"
fi

# Step 8: Pull Docker images
echo ""
echo "📥 Step 8: Pulling Docker images (this may take a few minutes)..."
docker compose pull

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo ""
echo "   1. Copy migrations (if you have them):"
echo "      From laptop: scp -r talia-server/supabase/migrations zomarc@192.168.1.120:~/talia-supabase-docker/supabase/"
echo ""
echo "   2. Copy database backup:"
echo "      From laptop: scp talia-server/backups/supabase_backup_20260113_193617.sql.gz zomarc@192.168.1.120:~/"
echo ""
echo "   3. Start Supabase:"
echo "      cd ~/talia-supabase-docker"
echo "      docker compose up -d"
echo ""
echo "   4. Wait for services to be healthy (check status):"
echo "      docker compose ps"
echo ""
echo "   5. Apply migrations (if copied):"
echo "      docker exec -i talia-supabase-db psql -U postgres -d postgres < supabase/migrations/YYYYMMDDHHMMSS_migration_name.sql"
echo ""
echo "   6. Restore database backup:"
echo "      gunzip ~/supabase_backup_20260113_193617.sql.gz"
echo "      docker exec -i talia-supabase-db psql -U postgres -d postgres < ~/supabase_backup_20260113_193617.sql"
echo ""
echo "   7. Access Supabase Studio:"
echo "      http://${IP_ADDRESS}:54323"
echo ""
echo "   8. API URL:"
echo "      http://${IP_ADDRESS}:54321"
echo ""
echo "   Supabase Keys (same as local):"
echo "   - Publishable Key: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
echo "   - Secret Key: sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
echo ""
