#!/usr/bin/env bash
# =====================================================================
# TAMAM — database restore (and restore drill).
#
#   bash scripts/db/restore.sh backups/tamam-20260903T020000Z.dump
#   TARGET_DATABASE_URL=postgresql://…/tamam_restore_check \
#     bash scripts/db/restore.sh backups/latest.dump
#
# Restoring into the LIVE database requires CONFIRM=yes — the script refuses
# otherwise, because pg_restore --clean drops every object first.
# Verification queries run after the restore and the script fails if they do not
# look like a healthy TAMAM database.
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/apps/api/.env}"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
fi

DUMP="${1:-}"
[ -n "$DUMP" ] || { echo "usage: bash scripts/db/restore.sh <dump-file>" >&2; exit 1; }
[ -f "$DUMP" ] || { echo "dump not found: $DUMP" >&2; exit 1; }

TARGET_URL="${TARGET_DATABASE_URL:-${DATABASE_URL:?DATABASE_URL or TARGET_DATABASE_URL is required}}"
JOBS="${RESTORE_JOBS:-4}"

command -v pg_restore >/dev/null 2>&1 || { echo "pg_restore is not installed" >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "psql is not installed" >&2; exit 1; }

if [ -n "${DATABASE_URL:-}" ] && [ "$TARGET_URL" = "$DATABASE_URL" ] && [ "${CONFIRM:-}" != "yes" ]; then
  echo "Refusing to restore over the primary database." >&2
  echo "Re-run with CONFIRM=yes, or point TARGET_DATABASE_URL at a scratch database." >&2
  exit 1
fi

if [ -f "$DUMP.sha256" ]; then
  echo "==> Verifying checksum"
  (cd "$(dirname "$DUMP")" && { sha256sum -c "$(basename "$DUMP").sha256" || shasum -a 256 -c "$(basename "$DUMP").sha256"; })
fi

echo "==> Restoring $DUMP"
echo "    target: $(printf '%s' "$TARGET_URL" | sed -E 's#://[^@]*@#://***@#')"

# PostGIS/pgcrypto/pg_trgm must exist before the schema that depends on them.
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS pg_trgm;'

# --clean --if-exists makes the restore repeatable; extension objects are skipped.
pg_restore --clean --if-exists --no-owner --no-acl --jobs "$JOBS" --dbname "$TARGET_URL" "$DUMP" || {
  echo "pg_restore reported errors — inspect the output above before trusting this database" >&2
  exit 1
}

echo "==> Verification"
psql "$TARGET_URL" -v ON_ERROR_STOP=1 --tuples-only --no-align <<'SQL'
\echo -- row counts
SELECT 'users            = ' || count(*) FROM users;
SELECT 'jobs             = ' || count(*) FROM jobs;
SELECT 'ledger_entries   = ' || count(*) FROM ledger_entries;
SELECT 'service_zones    = ' || count(*) FROM service_zones;
\echo -- ledger integrity: every transaction must balance
SELECT 'unbalanced_txns  = ' || count(*) FROM (
  SELECT transaction_id
  FROM ledger_entries
  GROUP BY transaction_id
  HAVING SUM(CASE WHEN direction = 'DEBIT' THEN amount_minor ELSE -amount_minor END) <> 0
) t;
\echo -- PostGIS geometry survived the round-trip
SELECT 'zones_with_area  = ' || count(*) FROM service_zones WHERE area IS NOT NULL;
SQL

UNBALANCED="$(psql "$TARGET_URL" --tuples-only --no-align -c "SELECT count(*) FROM (SELECT transaction_id FROM ledger_entries GROUP BY transaction_id HAVING SUM(CASE WHEN direction='DEBIT' THEN amount_minor ELSE -amount_minor END) <> 0) t;")"
if [ "$UNBALANCED" != "0" ]; then
  echo "ERROR: $UNBALANCED unbalanced ledger transactions after restore — do not put this database into service" >&2
  exit 1
fi

ZONES_WITH_AREA="$(psql "$TARGET_URL" --tuples-only --no-align -c 'SELECT count(*) FROM service_zones WHERE area IS NOT NULL;')"
if [ "$ZONES_WITH_AREA" = "0" ]; then
  echo "ERROR: no service zone has a PostGIS area — the geography columns did not restore" >&2
  exit 1
fi

echo "Restore verified."
echo "Next: point the API at this database, run 'prisma migrate deploy', then check /health/ready."
