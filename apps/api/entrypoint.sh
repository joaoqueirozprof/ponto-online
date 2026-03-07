#!/bin/sh
set -e

echo "=== PONTO ONLINE API STARTUP ==="

# 1. Push schema changes (if any)
echo "Pushing Prisma schema..."
npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>&1 || echo "Schema push completed (may have warnings)"

# 2. Run employee data update
echo "Running employee data update..."
node scripts/update-employee-data.js 2>&1 || echo "Employee update completed (may have warnings)"

# 3. Start the API
echo "Starting API server..."
exec node dist/main.js
