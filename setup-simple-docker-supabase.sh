#!/bin/bash
# Simple Docker Supabase setup for miniPC
# Just moves your local Supabase to the server - no Kong, no complexity

set -e

echo "🐳 Setting up Supabase Docker on miniPC..."
echo ""

# Check Docker
if ! docker ps &> /dev/null; then
    echo "❌ Docker not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# Create project directory
PROJECT_DIR="$HOME/talia-supabase-docker"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

echo "📁 Project directory: $PROJECT_DIR"

# Get IP address
IP_ADDRESS=$(hostname -I | awk '{print $1}')
echo "🌐 MiniPC IP: $IP_ADDRESS"

# Create simple docker-compose.yml
echo ""
echo "📝 Creating docker-compose.yml..."
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    container_name: talia-postgres
    image: supabase/postgres:15.1.1.117
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
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10

  studio:
    container_name: talia-studio
    image: supabase/studio:20241027-85b84e0
    ports:
      - "54323:3000"
    environment:
      STUDIO_PG_META_URL: http://pg-meta:8080
      POSTGRES_PASSWORD: postgres
    depends_on:
      postgres:
        condition: service_healthy
      pg-meta:
        condition: service_healthy
    restart: unless-stopped

  pg-meta:
    container_name: talia-pg-meta
    image: supabase/postgres-meta:v0.93.1
    ports:
      - "8080:8080"
    environment:
      PG_META_PORT: 8080
      PG_META_DB_HOST: postgres
      PG_META_DB_PORT: 5432
      PG_META_DB_NAME: postgres
      PG_META_DB_USER: postgres
      PG_META_DB_PASSWORD: postgres
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres-data:
    driver: local
EOF

echo "✅ docker-compose.yml created"

# Configure firewall
echo ""
echo "🔥 Configuring firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 54322/tcp comment "PostgreSQL"
    sudo ufw allow 54323/tcp comment "Supabase Studio"
    echo "✅ Firewall configured"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Start containers:"
echo "   cd ~/talia-supabase-docker"
echo "   docker compose up -d"
echo ""
echo "2. Copy migrations (if needed):"
echo "   From laptop: scp -r talia-server/supabase/migrations zomarc@192.168.1.120:~/talia-supabase-docker/"
echo ""
echo "3. Copy backup:"
echo "   From laptop: scp talia-server/backups/supabase_backup_20260113_193617.sql.gz zomarc@192.168.1.120:~/"
echo ""
echo "4. Restore database:"
echo "   gunzip ~/supabase_backup_20260113_193617.sql.gz"
echo "   docker exec -i talia-postgres psql -U postgres -d postgres < ~/supabase_backup_20260113_193617.sql"
echo ""
echo "5. Access:"
echo "   Studio: http://${IP_ADDRESS}:54323"
echo "   Database: postgresql://postgres:postgres@${IP_ADDRESS}:54322/postgres"
echo ""
