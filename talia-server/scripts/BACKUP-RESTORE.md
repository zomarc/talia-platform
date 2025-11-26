# Database Backup & Restore Guide

Quick reference for backing up and restoring the Supabase database.

## Quick Start

### Backup
```bash
npm run db-backup
```

### Restore
```bash
npm run db-restore <backup-file>
```

## Detailed Usage

### Creating a Backup

The backup script creates a compressed SQL dump of the entire database:

```bash
# From talia-server directory
npm run db-backup

# Or directly
./scripts/backup-db.sh
```

**What it does:**
- Connects to local Supabase database (127.0.0.1:54322)
- Creates a SQL dump with `pg_dump`
- Compresses the backup with gzip
- Saves to `backups/supabase_backup_YYYYMMDD_HHMMSS.sql.gz`

**Example output:**
```
=== Supabase Database Backup ===

Database: postgres
Host: 127.0.0.1:54322
Backup file: backups/supabase_backup_20251125_143022.sql

Creating backup...
Compressing backup...

✓ Backup completed successfully!
  File: backups/supabase_backup_20251125_143022.sql.gz
  Size: 2.3M
```

### Restoring from Backup

**⚠️ WARNING: This will replace ALL data in the database!**

```bash
# List available backups first
ls backups/

# Restore from backup
npm run db-restore backups/supabase_backup_20251125_143022.sql.gz

# Or just the filename
npm run db-restore supabase_backup_20251125_143022.sql.gz
```

The restore script will:
1. Ask for confirmation before proceeding
2. Decompress the backup if needed
3. Restore the database schema and data
4. Show success/failure status

## Prerequisites

PostgreSQL client tools must be installed:

- **macOS**: `brew install postgresql`
- **Ubuntu/Debian**: `sudo apt-get install postgresql-client`
- **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)

Verify installation:
```bash
which pg_dump
which psql
```

## Troubleshooting

### "pg_dump: command not found"
Install PostgreSQL client tools (see Prerequisites above).

### "Cannot connect to database"
Ensure Supabase is running:
```bash
cd talia-server
supabase start
supabase status
```

### "Permission denied"
Make scripts executable:
```bash
chmod +x scripts/backup-db.sh scripts/restore-db.sh
```

### Backup file not found
Check the backups directory:
```bash
ls -lh backups/
```

## Best Practices

1. **Create backups before migrations**: Always backup before running `supabase migration up`
2. **Regular backups**: Create backups after major data syncs or important changes
3. **Version backups**: Keep multiple backups with descriptive names if needed
4. **Test restores**: Periodically test restoring from backups to ensure they work
5. **Store safely**: Backups are excluded from git, but consider storing important backups elsewhere

## Backup File Format

- **Format**: Plain SQL dump compressed with gzip
- **Includes**: Schema, data, indexes, constraints, functions, triggers
- **Excludes**: Ownership and ACL information (for portability)
- **Size**: Typically 1-10MB compressed (depends on data volume)

## Configuration

The scripts use these default settings (from `supabase/config.toml`):
- Host: `127.0.0.1`
- Port: `54322`
- Database: `postgres`
- User: `postgres`
- Password: `postgres`

To modify these, edit the variables at the top of the script files.





