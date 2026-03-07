#!/bin/sh
set -e

echo "=== PONTO ONLINE API STARTUP ==="

# 1. Run employee data update
echo "Running employee data update..."
node scripts/update-employee-data.js 2>&1 || echo "Employee update completed (may have warnings)"

# 2. Fix unmatched employees (name differences)
echo "Fixing unmatched employees..."
node scripts/fix-unmatched-employees.js 2>&1 || echo "Fix unmatched completed (may have warnings)"

# 3. Start the API
echo "Starting API server..."
exec node dist/main.js
