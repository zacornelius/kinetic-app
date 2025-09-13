#!/bin/bash

# Kinetic App Database Backup Script
# This script creates automated backups of the PostgreSQL database

# Configuration
DB_NAME="kinetic_app"
DB_USER="kinetic_user"
DB_PASSWORD="kinetic_password_2024"
DB_HOST="localhost"
DB_PORT="5432"
BACKUP_DIR="/home/ubuntu/kinetic-app/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/kinetic_backup_${DATE}.sql"
BACKUP_FILE_COMPRESSED="${BACKUP_FILE}.gz"
LOG_FILE="/home/ubuntu/kinetic-app/backup.log"

# Set password for PostgreSQL commands
export PGPASSWORD="$DB_PASSWORD"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Function to cleanup old backups (keep last 7 days)
cleanup_old_backups() {
    log_message "Cleaning up backups older than 7 days..."
    find "$BACKUP_DIR" -name "kinetic_backup_*.sql.gz" -mtime +7 -delete
    log_message "Cleanup completed"
}

# Function to check if PostgreSQL is running
check_postgres() {
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; then
        log_message "ERROR: PostgreSQL is not running or not accessible"
        exit 1
    fi
}

# Function to create backup
create_backup() {
    log_message "Starting database backup..."
    
    # Create the backup
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose --no-password --format=plain --no-owner --no-privileges \
        --file="$BACKUP_FILE" 2>>"$LOG_FILE"; then
        
        # Compress the backup
        if gzip "$BACKUP_FILE"; then
            log_message "Backup created successfully: $BACKUP_FILE_COMPRESSED"
            
            # Get file size
            FILE_SIZE=$(du -h "$BACKUP_FILE_COMPRESSED" | cut -f1)
            log_message "Backup size: $FILE_SIZE"
            
            return 0
        else
            log_message "ERROR: Failed to compress backup file"
            return 1
        fi
    else
        log_message "ERROR: Database backup failed"
        return 1
    fi
}

# Function to verify backup
verify_backup() {
    if [ -f "$BACKUP_FILE_COMPRESSED" ]; then
        # Check if the compressed file is not empty and can be decompressed
        if gunzip -t "$BACKUP_FILE_COMPRESSED" 2>/dev/null; then
            log_message "Backup verification successful"
            return 0
        else
            log_message "ERROR: Backup file is corrupted"
            return 1
        fi
    else
        log_message "ERROR: Backup file not found"
        return 1
    fi
}

# Main execution
main() {
    log_message "=== Starting Kinetic App Database Backup ==="
    
    # Check if PostgreSQL is running
    check_postgres
    
    # Create backup
    if create_backup; then
        # Verify backup
        if verify_backup; then
            log_message "Backup completed successfully"
            
            # Cleanup old backups
            cleanup_old_backups
            
            log_message "=== Backup Process Completed ==="
            exit 0
        else
            log_message "ERROR: Backup verification failed"
            exit 1
        fi
    else
        log_message "ERROR: Backup creation failed"
        exit 1
    fi
}

# Run main function
main "$@"
