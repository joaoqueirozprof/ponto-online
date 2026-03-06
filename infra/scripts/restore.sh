#!/bin/bash

set -e

BACKUP_FILE="${1:?Usage: ./restore.sh <backup-file>}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

POSTGRES_USER="${POSTGRES_USER:-ponto}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-ponto123}"
POSTGRES_DB="${POSTGRES_DB:-ponto_db}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5433}"

echo "Starting database restore at $(date)"
echo "Restoring from: $BACKUP_FILE"

if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "File is gzipped, decompressing..."
  gunzip -c "$BACKUP_FILE" | PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --verbose
else
  echo "File is not gzipped, restoring directly..."
  PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --verbose < "$BACKUP_FILE"
fi

echo "Restore completed successfully at $(date)"
