#!/bin/bash

# Setup automated backup cron job for Kinetic App

BACKUP_SCRIPT="/home/ubuntu/kinetic-app/backup-database.sh"
CRON_JOB="0 2 * * * $BACKUP_SCRIPT >> /home/ubuntu/kinetic-app/backup.log 2>&1"

echo "Setting up automated database backup..."

# Check if backup script exists and is executable
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "ERROR: Backup script not found at $BACKUP_SCRIPT"
    exit 1
fi

if [ ! -x "$BACKUP_SCRIPT" ]; then
    echo "ERROR: Backup script is not executable"
    exit 1
fi

# Create backup directory
mkdir -p /home/ubuntu/kinetic-app/backups

# Add cron job (runs daily at 2 AM)
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "Cron job added successfully!"
echo "Backup will run daily at 2:00 AM"
echo ""
echo "Current crontab:"
crontab -l

echo ""
echo "To test the backup manually, run:"
echo "  $BACKUP_SCRIPT"
echo ""
echo "To view backup logs:"
echo "  tail -f /home/ubuntu/kinetic-app/backup.log"
echo ""
echo "To list available backups:"
echo "  ls -la /home/ubuntu/kinetic-app/backups/"

