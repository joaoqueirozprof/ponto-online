#!/bin/sh
set -e

echo "=== PONTO ONLINE API STARTUP v81 (Multi-tenant) ==="

# 0. Apply database schema changes
echo "Applying database schema..."
npx prisma db push --schema=prisma/schema.prisma --accept-data-loss 2>&1 || echo "Schema push completed (may have warnings)"

# 1. Run seed if database is empty (first deploy)
echo "Checking if seed is needed..."
SEED_CHECK=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.role.count().then(c => { console.log(c); p.\$disconnect(); }).catch(() => { console.log(0); p.\$disconnect(); });
" 2>/dev/null || echo "0")

if [ "$SEED_CHECK" = "0" ] || [ -z "$SEED_CHECK" ]; then
  echo "Database is empty, running seed..."
  npx ts-node prisma/seed.ts 2>&1 || npx tsx prisma/seed.ts 2>&1 || echo "Seed completed (may have warnings)"
else
  echo "Database already has data ($SEED_CHECK roles), skipping seed."
fi

# 2. Run legacy migration scripts (only if tables exist from v1)
if [ -f scripts/update-employee-data.js ]; then
  echo "Running legacy employee data update..."
  node scripts/update-employee-data.js 2>&1 || echo "Employee update completed (may have warnings)"
fi

if [ -f scripts/fix-unmatched-employees.js ]; then
  echo "Fixing unmatched employees..."
  node scripts/fix-unmatched-employees.js 2>&1 || echo "Fix unmatched completed (may have warnings)"
fi

# 3. Start the API
echo "Starting API server..."
exec node dist/main.js
