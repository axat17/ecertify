#!/usr/bin/env bash
# ============================================================
# ReleaseIQ — Reset & Reseed Database
# Drops all collections and re-seeds with fresh dummy data
# Usage: ./scripts/reseed.sh
# ============================================================

echo "⚠️  This will DROP all ReleaseIQ data and reseed with dummy data."
read -p "Continue? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

cd "$(dirname "$0")/../api"
echo "→ Dropping and reseeding database..."
npm run seed
echo "✅ Database reset complete"
echo ""
echo "Demo accounts:"
echo "  Main Admin:    john.doe@adp.com"
echo "  Project Admin: jane.smith@adp.com"
echo "  BU Tester:     tester.bu@adp.com"
