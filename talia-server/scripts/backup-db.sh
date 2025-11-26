#!/bin/bash

# Supabase Database Backup Script
# This script creates a backup of the local Supabase database

set -e  # Exit on error

# Backup directory
BACKUP_DIR="$(dirname "$0")/../backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/supabase_backup_${TIMESTAMP}.sql"
BACKUP_FILE_COMPRESSED="${BACKUP_FILE}.gz"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Supabase Database Backup ===${NC}"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI is not installed or not in PATH${NC}"
    echo "Please install Supabase CLI:"
    echo "  macOS: brew install supabase/tap/supabase"
    echo "  Other: https://supabase.com/docs/guides/cli/getting-started"
    exit 1
fi

# Check if Supabase is running
if ! supabase status &> /dev/null; then
    echo -e "${YELLOW}Warning: Supabase is not running${NC}"
    echo "Make sure Supabase is running:"
    echo "  cd talia-server && supabase start"
    exit 1
fi

echo "Backup file: ${BACKUP_FILE}"
echo ""

# Temporary files for schema and data
SCHEMA_FILE="${BACKUP_FILE}.schema"
DATA_FILE="${BACKUP_FILE}.data"

# Create backup using Supabase CLI (schema + data)
echo -e "${GREEN}Creating backup (schema + data)...${NC}"

# Dump schema
echo -e "${GREEN}  Dumping schema...${NC}"
if ! supabase db dump --local -f "$SCHEMA_FILE" 2>&1; then
    echo -e "${RED}✗ Schema dump failed!${NC}"
    rm -f "$SCHEMA_FILE" "$DATA_FILE"
    exit 1
fi

# Dump data
echo -e "${GREEN}  Dumping data...${NC}"
if ! supabase db dump --local --data-only -f "$DATA_FILE" 2>&1; then
    echo -e "${RED}✗ Data dump failed!${NC}"
    rm -f "$SCHEMA_FILE" "$DATA_FILE"
    exit 1
fi

# Combine schema and data into single backup file
echo -e "${GREEN}  Combining schema and data...${NC}"
cat "$SCHEMA_FILE" "$DATA_FILE" > "$BACKUP_FILE"
rm -f "$SCHEMA_FILE" "$DATA_FILE"

# Compress the backup
echo -e "${GREEN}Compressing backup...${NC}"
gzip -f "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "${BACKUP_FILE_COMPRESSED}" | cut -f1)

echo ""
echo -e "${GREEN}✓ Backup completed successfully!${NC}"
echo "  File: ${BACKUP_FILE_COMPRESSED}"
echo "  Size: ${BACKUP_SIZE}"
echo ""
echo -e "${YELLOW}Note: Backup includes both schema and all data${NC}"
echo ""

# List recent backups
echo -e "${YELLOW}Recent backups:${NC}"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -5 | awk '{print "  " $9 " (" $5 ")"}'

