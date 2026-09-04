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
  node_modules/.bin/ts-node -r tsconfig-paths/register prisma/seed.ts
  echo "[entrypoint] seed complete"
fi

echo "[entrypoint] starting: $*"
exec "$@"
