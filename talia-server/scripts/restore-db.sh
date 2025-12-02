#!/bin/bash

# Supabase Database Restore Script
# This script restores the local Supabase database from a backup file

set -e  # Exit on error

# Configuration
DB_HOST="127.0.0.1"
DB_PORT="54322"
DB_NAME="postgres"
DB_USER="postgres"
DB_PASSWORD="postgres"

# Backup directory
BACKUP_DIR="$(dirname "$0")/../backups"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Supabase Database Restore ===${NC}"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql is not installed or not in PATH${NC}"
    echo "Please install PostgreSQL client tools:"
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
    exit 1
fi

# Check if backup file is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <backup_file>${NC}"
    echo ""
    echo "Available backups:"
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR/*.sql.gz 2>/dev/null)" ]; then
        ls -lh "$BACKUP_DIR"/*.sql.gz | awk '{print "  " $9 " (" $5 ")"}'
    else
        echo "  No backups found in $BACKUP_DIR"
    fi
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    # Try relative to backup directory
    if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
        BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILE}"
    else
        echo -e "${RED}Error: Backup file not found: ${BACKUP_FILE}${NC}"
        exit 1
    fi
fi

# Check if Supabase is running
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" &> /dev/null; then
    echo -e "${YELLOW}Warning: Cannot connect to database at ${DB_HOST}:${DB_PORT}${NC}"
    echo "Make sure Supabase is running:"
    echo "  cd talia-server && supabase start"
    exit 1
fi

echo "Database: ${DB_NAME}"
echo "Host: ${DB_HOST}:${DB_PORT}"
echo "Backup file: ${BACKUP_FILE}"
echo ""

# Confirm restore
echo -e "${RED}WARNING: This will replace all data in the database!${NC}"
echo -e "${YELLOW}Are you sure you want to continue? (yes/no):${NC} "
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Set password via environment variable to avoid prompt
export PGPASSWORD="$DB_PASSWORD"

# Determine if file is compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo -e "${GREEN}Decompressing and restoring backup...${NC}"
    gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" 2>&1
else
    echo -e "${GREEN}Restoring backup...${NC}"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$BACKUP_FILE" 2>&1
fi

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Restore completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}✗ Restore failed!${NC}"
    exit 1
fi

# Clean up password from environment
unset PGPASSWORD











