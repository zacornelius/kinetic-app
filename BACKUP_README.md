# Kinetic App Database Backup System

This directory contains a comprehensive database backup and restore system for the Kinetic App PostgreSQL database.

## Files

- `backup-database.sh` - Main backup script
- `restore-database.sh` - Database restore script  
- `backup-manager.sh` - Easy-to-use management interface
- `setup-backup-cron.sh` - Sets up automated daily backups
- `backups/` - Directory containing backup files
- `backup.log` - Backup operation logs
- `restore.log` - Restore operation logs

## Quick Start

### Check Backup Status
```bash
./backup-manager.sh status
```

### Create a Backup
```bash
./backup-manager.sh backup
```

### List Available Backups
```bash
./backup-manager.sh list
```

### Restore from Latest Backup
```bash
./backup-manager.sh latest
```

### Restore from Specific Backup
```bash
./backup-manager.sh restore
```

## Automated Backups

The system is configured to automatically backup the database daily at 2:00 AM. The cron job:
- Creates compressed SQL dumps
- Keeps backups for 7 days (auto-cleanup)
- Logs all operations
- Verifies backup integrity

## Backup Features

- **Compressed backups** - Saves disk space with gzip compression
- **Automatic cleanup** - Removes backups older than 7 days
- **Integrity verification** - Validates backup files after creation
- **Detailed logging** - All operations are logged with timestamps
- **Pre-restore backup** - Creates a backup before restoring (safety)
- **Error handling** - Comprehensive error checking and reporting

## Manual Operations

### Create Backup
```bash
./backup-database.sh
```

### Restore Database
```bash
./restore-database.sh [backup_filename]
./restore-database.sh latest  # Restore from most recent backup
```

### View Logs
```bash
tail -f backup.log          # Backup logs
tail -f restore.log         # Restore logs
```

## Backup File Naming

Backups are named with timestamps: `kinetic_backup_YYYYMMDD_HHMMSS.sql.gz`

Example: `kinetic_backup_20250913_213353.sql.gz`

## Database Configuration

- **Database**: kinetic_app
- **User**: kinetic_user  
- **Host**: localhost
- **Port**: 5432
- **Backup Location**: /home/ubuntu/kinetic-app/backups/

## Safety Features

1. **Pre-restore backup** - Always creates a backup before restoring
2. **Confirmation prompts** - Asks for confirmation before destructive operations
3. **Backup verification** - Validates backup files before use
4. **Database connectivity checks** - Ensures PostgreSQL is running
5. **File integrity checks** - Verifies compressed files are valid

## Monitoring

### Check if automated backups are working
```bash
crontab -l  # View cron jobs
tail -f backup.log  # Monitor backup logs
```

### Check disk usage
```bash
df -h /home/ubuntu/kinetic-app/backups
du -sh /home/ubuntu/kinetic-app/backups
```

## Troubleshooting

### Backup fails
1. Check if PostgreSQL is running: `pg_isready -h localhost -p 5432 -U kinetic_user`
2. Check backup logs: `tail -20 backup.log`
3. Verify database credentials in the scripts

### Restore fails
1. Check if backup file exists and is valid
2. Check restore logs: `tail -20 restore.log`
3. Ensure PostgreSQL is running and accessible

### Cron job not running
1. Check cron service: `sudo systemctl status cron`
2. Check cron logs: `sudo journalctl -u cron`
3. Verify cron job exists: `crontab -l`

## File Permissions

All scripts are executable and owned by the ubuntu user. The backup directory is writable by the ubuntu user.

## Security Notes

- Database password is hardcoded in scripts (consider using environment variables for production)
- Backup files are stored locally (consider off-site backup for production)
- Scripts have appropriate permissions (readable by owner only)

## Maintenance

- Monitor disk usage regularly
- Test restore procedures periodically
- Review and rotate logs if they grow too large
- Consider off-site backup for critical data
