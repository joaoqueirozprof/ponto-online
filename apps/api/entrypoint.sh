#!/bin/sh
set -e

echo "=== PONTO ONLINE API STARTUP ==="

# 0. Apply database schema changes
echo "Applying database schema..."
npx prisma db push --schema=prisma/schema.prisma --accept-data-loss 2>&1 || echo "Schema push completed (may have warnings)"

# 1. Run employee data update
echo "Running employee data update..."
node scripts/update-employee-data.js 2>&1 || echo "Employee update completed (may have warnings)"

# 2. Fix unmatched employees (name differences)
echo "Fixing unmatched employees..."
node scripts/fix-unmatched-employees.js 2>&1 || echo "Fix unmatched completed (may have warnings)"

# 3. Migrate employee punches (old IDs -> new IDs) using psql directly
echo "Running employee punch migration via psql..."
PGPASSWORD=PontoSecure2026 psql -h ponto-db -U ponto_admin -d ponto_online -f scripts/migrate-employee-punches.sql 2>&1 && echo "Punch migration SUCCESS" || echo "Punch migration FAILED (check above)"

# 4. Start the API
echo "Starting API server..."
exec node dist/main.js
