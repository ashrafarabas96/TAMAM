#!/bin/sh
# TAMAM API container entrypoint.
#
# Applies pending Prisma migrations when RUN_MIGRATIONS=true, then execs the
# server. Exactly one replica should carry RUN_MIGRATIONS=true; the others start
# straight away (see docs/DEPLOYMENT.md).
set -eu

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[entrypoint] applying database migrations…"
  # `migrate deploy` is idempotent and never generates or resets anything.
  node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma
  echo "[entrypoint] migrations applied"
else
  echo "[entrypoint] RUN_MIGRATIONS is not 'true' — skipping migrations"
fi

# A database with no service types, zones or admin account is a database
# nobody can log into. Seeding is idempotent — it upserts — so leaving this on
# costs a few seconds per restart and saves a first-time user from a console
# they cannot sign in to.
if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] seeding reference data…"
  # Failing here is correct -- an unseeded database has no admin to sign in as.
  # But the container then restarts, and the real error scrolls away in a loop,
  # so say plainly what happened before exiting.
  if ! node_modules/.bin/ts-node -r tsconfig-paths/register prisma/seed.ts; then
    echo "======================================================================" >&2
    echo "[entrypoint] SEEDING FAILED. The error is printed just above." >&2
    echo "[entrypoint] The API will not start, and this container will keep" >&2
    echo "[entrypoint] restarting until the cause is fixed." >&2
    echo "======================================================================" >&2
    exit 1
  fi
  echo "[entrypoint] seed complete"
fi

echo "[entrypoint] starting: $*"
exec "$@"
