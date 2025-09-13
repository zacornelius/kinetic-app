#!/bin/bash

# Kinetic App Database Restore Script
# This script restores the database from a backup file

# Configuration
DB_NAME="kinetic_app"
DB_USER="kinetic_user"
DB_PASSWORD="kinetic_password_2024"
DB_HOST="localhost"
DB_PORT="5432"
BACKUP_DIR="/home/ubuntu/kinetic-app/backups"
LOG_FILE="/home/ubuntu/kinetic-app/restore.log"

# Set password for PostgreSQL commands
export PGPASSWORD="$DB_PASSWORD"

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [backup_file]"
    echo ""
    echo "Examples:"
    echo "  $0 kinetic_backup_20241213_143022.sql.gz"
    echo "  $0 latest  # Restore from the most recent backup"
    echo ""
    echo "Available backups:"
    ls -la "$BACKUP_DIR"/kinetic_backup_*.sql.gz 2>/dev/null | tail -10
}

# Function to get the latest backup
get_latest_backup() {
    ls -t "$BACKUP_DIR"/kinetic_backup_*.sql.gz 2>/dev/null | head -1
}

# Function to check if PostgreSQL is running
check_postgres() {
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; then
        log_message "ERROR: PostgreSQL is not running or not accessible"
        exit 1
    fi
}

# Function to confirm restore
confirm_restore() {
    echo "WARNING: This will completely replace the current database!"
    echo "Database: $DB_NAME"
    echo "Backup file: $1"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_message "Restore cancelled by user"
        exit 0
    fi
}

# Function to create a backup before restore
create_pre_restore_backup() {
    log_message "Creating pre-restore backup..."
    /home/ubuntu/kinetic-app/backup-database.sh
    if [ $? -eq 0 ]; then
        log_message "Pre-restore backup created successfully"
    else
        log_message "WARNING: Pre-restore backup failed, but continuing with restore"
    fi
}

# Function to restore database
restore_database() {
    local backup_file="$1"
    
    log_message "Starting database restore from: $backup_file"
    
    # Check if backup file exists
    if [ ! -f "$backup_file" ]; then
        log_message "ERROR: Backup file not found: $backup_file"
        exit 1
    fi
    
    # Verify backup file
    if ! gunzip -t "$backup_file" 2>/dev/null; then
        log_message "ERROR: Backup file is corrupted or not a valid gzip file"
        exit 1
    fi
    
    # Drop and recreate database
    log_message "Dropping and recreating database..."
    if dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>>"$LOG_FILE"; then
        log_message "Database dropped successfully"
    else
        log_message "WARNING: Failed to drop database (might not exist)"
    fi
    
    if createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>>"$LOG_FILE"; then
        log_message "Database created successfully"
    else
        log_message "ERROR: Failed to create database"
        exit 1
    fi
    
    # Restore from backup
    log_message "Restoring data from backup..."
    if gunzip -c "$backup_file" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" 2>>"$LOG_FILE"; then
        log_message "Database restored successfully"
        
        # Get file size
        FILE_SIZE=$(du -h "$backup_file" | cut -f1)
        log_message "Restored from backup size: $FILE_SIZE"
        
        return 0
    else
        log_message "ERROR: Database restore failed"
        return 1
    fi
}

# Function to verify restore
verify_restore() {
    log_message "Verifying restore..."
    
    # Check if we can connect and query the database
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM customers;" >/dev/null 2>&1; then
        log_message "Restore verification successful - database is accessible"
        return 0
    else
        log_message "ERROR: Restore verification failed - database is not accessible"
        return 1
    fi
}

# Main execution
main() {
    local backup_file="$1"
    
    # Check arguments
    if [ $# -eq 0 ]; then
        show_usage
        exit 1
    fi
    
    # Handle 'latest' option
    if [ "$backup_file" = "latest" ]; then
        backup_file=$(get_latest_backup)
        if [ -z "$backup_file" ]; then
            log_message "ERROR: No backup files found in $BACKUP_DIR"
            exit 1
        fi
        log_message "Using latest backup: $backup_file"
    fi
    
    # Convert to full path if not already
    if [[ "$backup_file" != /* ]]; then
        backup_file="$BACKUP_DIR/$backup_file"
    fi
    
    log_message "=== Starting Kinetic App Database Restore ==="
    log_message "Target database: $DB_NAME"
    log_message "Backup file: $backup_file"
    
    # Check if PostgreSQL is running
    check_postgres
    
    # Confirm restore
    confirm_restore "$backup_file"
    
    # Create pre-restore backup
    create_pre_restore_backup
    
    # Restore database
    if restore_database "$backup_file"; then
        # Verify restore
        if verify_restore; then
            log_message "Database restore completed successfully"
            log_message "=== Restore Process Completed ==="
            exit 0
        else
            log_message "ERROR: Restore verification failed"
            exit 1
        fi
    else
        log_message "ERROR: Database restore failed"
        exit 1
    fi
}

# Run main function
main "$@"
