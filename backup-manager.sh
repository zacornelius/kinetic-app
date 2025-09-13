#!/bin/bash

# Kinetic App Database Backup Manager
# Easy interface for managing database backups

BACKUP_DIR="/home/ubuntu/kinetic-app/backups"
BACKUP_SCRIPT="/home/ubuntu/kinetic-app/backup-database.sh"
RESTORE_SCRIPT="/home/ubuntu/kinetic-app/restore-database.sh"

# Function to show usage
show_usage() {
    echo "Kinetic App Database Backup Manager"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  backup     - Create a new backup"
    echo "  list       - List available backups"
    echo "  restore    - Restore from a backup (interactive)"
    echo "  latest     - Restore from the latest backup"
    echo "  logs       - Show backup logs"
    echo "  status     - Show backup status and disk usage"
    echo "  help       - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 backup"
    echo "  $0 list"
    echo "  $0 restore"
    echo "  $0 latest"
}

# Function to create backup
create_backup() {
    echo "Creating database backup..."
    $BACKUP_SCRIPT
    if [ $? -eq 0 ]; then
        echo "Backup completed successfully!"
    else
        echo "Backup failed. Check logs for details."
        exit 1
    fi
}

# Function to list backups
list_backups() {
    echo "Available backups:"
    echo ""
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR)" ]; then
        ls -lah "$BACKUP_DIR"/kinetic_backup_*.sql.gz 2>/dev/null | while read line; do
            echo "$line"
        done
        echo ""
        echo "Total backups: $(ls -1 $BACKUP_DIR/kinetic_backup_*.sql.gz 2>/dev/null | wc -l)"
    else
        echo "No backups found in $BACKUP_DIR"
    fi
}

# Function to restore database
restore_database() {
    echo "Database Restore"
    echo "================"
    echo ""
    list_backups
    echo ""
    read -p "Enter backup filename (or 'latest'): " backup_file
    
    if [ -z "$backup_file" ]; then
        echo "No backup file specified. Exiting."
        exit 1
    fi
    
    echo "Starting restore process..."
    $RESTORE_SCRIPT "$backup_file"
}

# Function to restore from latest
restore_latest() {
    echo "Restoring from latest backup..."
    $RESTORE_SCRIPT latest
}

# Function to show logs
show_logs() {
    echo "Backup Logs (last 50 lines):"
    echo "============================"
    if [ -f "/home/ubuntu/kinetic-app/backup.log" ]; then
        tail -50 "/home/ubuntu/kinetic-app/backup.log"
    else
        echo "No backup log file found."
    fi
}

# Function to show status
show_status() {
    echo "Backup Status"
    echo "============="
    echo ""
    
    # Check if cron job is set up
    if crontab -l 2>/dev/null | grep -q "backup-database.sh"; then
        echo "✓ Automated backup: ENABLED (daily at 2:00 AM, 7-day retention)"
    else
        echo "✗ Automated backup: DISABLED"
    fi
    
    echo ""
    
    # Show backup directory info
    if [ -d "$BACKUP_DIR" ]; then
        echo "Backup directory: $BACKUP_DIR"
        echo "Total backups: $(ls -1 $BACKUP_DIR/kinetic_backup_*.sql.gz 2>/dev/null | wc -l)"
        echo "Total size: $(du -sh $BACKUP_DIR 2>/dev/null | cut -f1)"
        echo ""
        echo "Recent backups:"
        ls -lah "$BACKUP_DIR"/kinetic_backup_*.sql.gz 2>/dev/null | tail -5
    else
        echo "Backup directory not found: $BACKUP_DIR"
    fi
    
    echo ""
    
    # Show disk usage
    echo "Disk usage:"
    df -h /home/ubuntu/kinetic-app/backups 2>/dev/null || echo "Backup directory not accessible"
}

# Main execution
main() {
    case "${1:-help}" in
        backup)
            create_backup
            ;;
        list)
            list_backups
            ;;
        restore)
            restore_database
            ;;
        latest)
            restore_latest
            ;;
        logs)
            show_logs
            ;;
        status)
            show_status
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            echo "Unknown command: $1"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
