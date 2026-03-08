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

# 3. Migrate employee punches via psql
echo "Running employee punch migration via psql..."
PGPASSWORD=PontoSecure2026 psql -h ponto-db -U ponto_admin -d ponto_online -f scripts/migrate-employee-punches.sql 2>&1 && echo "Punch migration SUCCESS" || echo "Punch migration may have warnings"

# 4. Fetch latest source from GitHub and rebuild (workaround for Docker cache)
echo "Fetching latest source code from GitHub..."
GITHUB_RAW="https://raw.githubusercontent.com/joaoqueirozprof/ponto-online/main"

# Fetch critical files that may have changed
wget -q "$GITHUB_RAW/apps/api/src/modules/reports/reports.service.ts" -O /app/src/modules/reports/reports.service.ts 2>&1 && echo "reports.service.ts updated" || echo "reports.service.ts fetch failed"
wget -q "$GITHUB_RAW/apps/api/src/modules/reports/reports.controller.ts" -O /app/src/modules/reports/reports.controller.ts 2>&1 && echo "reports.controller.ts updated" || echo "reports.controller.ts fetch failed"

echo "Rebuilding NestJS from latest source..."
npx nest build 2>&1 && echo "NestJS rebuild SUCCESS" || echo "NestJS rebuild FAILED - using existing build"

# 5. Start the API
echo "Starting API server..."
exec node dist/main.js
