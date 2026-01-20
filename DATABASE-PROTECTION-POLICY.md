# Database Protection Policy

## CRITICAL RULE: NEVER DELETE DATABASE VOLUMES

**This document was created after a data loss incident on 2026-01-20**

### What Happened

During a deployment, a PostgreSQL version mismatch error was encountered. Instead of investigating the root cause, the database volume was deleted, resulting in complete data loss. This was a critical error that should never be repeated.

### Protection Rules

1. **NEVER run `docker volume rm` on database volumes**
   - Database volumes contain persistent data
   - Volumes are the ONLY place where database data is stored
   - Deleting a volume = deleting all data permanently

2. **NEVER run `docker compose down -v` on production/staging databases**
   - The `-v` flag removes volumes
   - This deletes all data

3. **ALWAYS investigate errors before taking destructive action**
   - Version mismatches can often be resolved without data loss
   - Check logs, check versions, check compatibility
   - Consult documentation before deleting anything

4. **ALWAYS verify backups exist before any maintenance**
   - Check for backup files
   - Verify backup integrity
   - Test restore process

5. **ALWAYS use `docker compose stop` and `docker compose start` for database containers**
   - Never use `docker compose rm` on database containers
   - Never delete volumes

### Safe Database Operations

✅ **SAFE:**
- `docker compose stop supabase-db` - Stops container, keeps data
- `docker compose start supabase-db` - Starts container, uses existing data
- `docker compose restart supabase-db` - Restarts container, keeps data
- `docker compose up -d supabase-db` - Starts/updates container, keeps data

❌ **NEVER:**
- `docker compose rm -v supabase-db` - Removes container AND volume (DELETES DATA)
- `docker volume rm <database-volume>` - Deletes volume (DELETES DATA)
- `docker compose down -v` - Removes all containers AND volumes (DELETES DATA)

### Version Mismatch Handling

If you encounter a PostgreSQL version mismatch:

1. **DO NOT delete the volume**
2. Check what version the data was created with
3. Check what version docker-compose is trying to use
4. Options:
   - Update docker-compose to match existing data version (if compatible)
   - Use `pg_upgrade` to migrate data (requires careful planning)
   - Export data, update version, import data (safe but time-consuming)
   - **ONLY as last resort**: Restore from backup after version update

### Backup Requirements

- Database backups must be taken before any major changes
- Backups should be stored in multiple locations
- Backup restoration should be tested regularly
- Backup location: `~/talia-docker-backup/` on staging server

### Recovery Procedure

If data is lost:

1. **STOP** - Do not make any more changes
2. Check for backups immediately
3. Check for volume snapshots (if using Docker with snapshots)
4. Restore from most recent backup
5. Verify data integrity after restore
6. Document what happened and why

### Current Backup Location

- **Staging**: `~/talia-docker-backup/supabase_backup_20260113_193617.sql.gz`
- **Last backup date**: 2026-01-13
- **Backup size**: ~34MB

---

**Remember: Docker volumes are persistent storage. Deleting them deletes data permanently. Always investigate before taking destructive action.**
