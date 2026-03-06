#!/bin/bash

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
POSTGRES_USER="${POSTGRES_USER:-ponto}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-ponto123}"
POSTGRES_DB="${POSTGRES_DB:-ponto_db}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5433}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/ponto_db_backup_${TIMESTAMP}.sql.gz"

echo "Starting database backup at $(date)"
echo "Backup file: $BACKUP_FILE"

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --verbose | gzip > "$BACKUP_FILE"

echo "Backup completed successfully"
echo "File size: $(du -h "$BACKUP_FILE" | cut -f1)"

echo "Removing backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name "ponto_db_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Cleanup completed"
echo "Backup process finished at $(date)"
