#!/usr/bin/env bash
# =====================================================================
# TAMAM — idempotent local bootstrap.
#
#   bash scripts/setup.sh            # full bring-up
#   SKIP_DOCKER=1 bash scripts/setup.sh   # datastores already running
#
# Safe to re-run: it never overwrites an existing .env and every database
# step converges on the same state.
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; NC='\033[0m'
step() { printf "${BOLD}==> %s${NC}\n" "$1"; }
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${NC} %s\n" "$1"; }
die()  { printf "  ${RED}✗ %s${NC}\n" "$1" >&2; exit 1; }

# ------------------------------------------------------------ prerequisites
step "Checking prerequisites"

command -v node >/dev/null 2>&1 || die "node is not installed (need >= 22 — see .nvmrc)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || die "node $NODE_MAJOR found, but >= 22 is required"
ok "node $(node -v)"

if ! command -v pnpm >/dev/null 2>&1; then
  warn "pnpm not found — enabling it through corepack"
  corepack enable >/dev/null 2>&1 || die "could not enable corepack; install pnpm manually"
fi
ok "pnpm $(pnpm -v)"

command -v openssl >/dev/null 2>&1 || die "openssl is required to generate local secrets"
ok "openssl present"

if [ "${SKIP_DOCKER:-0}" != "1" ]; then
  command -v docker >/dev/null 2>&1 || die "docker is not installed (or run with SKIP_DOCKER=1)"
  docker compose version >/dev/null 2>&1 || die "docker compose v2 plugin is required"
  ok "docker $(docker --version | awk '{print $3}' | tr -d ,)"
fi

# ------------------------------------------------------------------- .env
step "Preparing apps/api/.env"
ENV_FILE="$ROOT/apps/api/.env"
if [ -f "$ENV_FILE" ]; then
  ok ".env already exists — left untouched"
else
  cp "$ROOT/apps/api/.env.example" "$ENV_FILE"
  # Real random secrets so the local instance is never seeded with placeholders.
  ACCESS_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
  REFRESH_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
  OTP_PEPPER="$(openssl rand -base64 32 | tr -d '\n')"
  ENCRYPTION_KEY="$(openssl rand -base64 32 | tr -d '\n')"
  # Portable in-place edit (BSD and GNU sed disagree about -i).
  python3 - "$ENV_FILE" "$ACCESS_SECRET" "$REFRESH_SECRET" "$OTP_PEPPER" "$ENCRYPTION_KEY" <<'PY'
import sys, re
path, access, refresh, pepper, key = sys.argv[1:6]
values = {
    'JWT_ACCESS_SECRET': access,
    'JWT_REFRESH_SECRET': refresh,
    'OTP_PEPPER': pepper,
    'ENCRYPTION_KEY': key,
}
with open(path, encoding='utf-8') as fh:
    lines = fh.readlines()
out = []
for line in lines:
    name = line.split('=', 1)[0].strip()
    out.append(f'{name}={values[name]}\n' if name in values else line)
with open(path, 'w', encoding='utf-8') as fh:
    fh.writelines(out)
PY
  ok "created apps/api/.env with freshly generated secrets"
fi

# --------------------------------------------------------------- datastores
if [ "${SKIP_DOCKER:-0}" != "1" ]; then
  step "Starting datastores (postgis, redis, minio)"
  docker compose -f infrastructure/docker/docker-compose.yml up -d db redis minio minio-init
  printf "  waiting for postgres"
  for _ in $(seq 1 60); do
    if docker compose -f infrastructure/docker/docker-compose.yml exec -T db pg_isready -U tamam -d tamam >/dev/null 2>&1; then
      printf "\n"; ok "postgres is ready"; break
    fi
    printf "."; sleep 1
  done
  docker compose -f infrastructure/docker/docker-compose.yml exec -T db pg_isready -U tamam -d tamam >/dev/null 2>&1 \
    || die "postgres did not become ready in time"
fi

# ------------------------------------------------------------- dependencies
step "Installing workspace dependencies"
if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile
else
  warn "pnpm-lock.yaml is missing — running a non-frozen install (commit the lockfile afterwards)"
  pnpm install
fi
ok "dependencies installed"

step "Generating design tokens"
pnpm tokens:generate
ok "tokens generated"

step "Building shared packages"
pnpm --filter @tamam/shared-types --filter @tamam/validation build
ok "shared-types + validation built"

step "Generating Dart contracts for the mobile apps"
node scripts/generate-dart-contracts.mjs
ok "dart contracts generated"

# ----------------------------------------------------------------- database
step "Preparing the database"
bash scripts/db/create-init-migration.sh
pnpm --filter @tamam/api prisma:generate
pnpm --filter @tamam/api prisma:migrate:dev
ok "schema applied"

step "Seeding development data"
pnpm --filter @tamam/api seed
ok "database seeded"

step "Uploading seed assets to MinIO"
bash scripts/seed-assets.sh || warn "seed assets were not uploaded — run scripts/seed-assets.sh once MinIO is reachable"

printf "\n${GREEN}${BOLD}TAMAM is ready.${NC}\n"
cat <<'NEXT'

  Start the API          pnpm --filter @tamam/api dev        → http://localhost:3000
  OpenAPI (non-prod)     http://localhost:3000/docs
  MinIO console          http://localhost:9001  (tamam / tamam-secret)
  Admin login            admin@tamam.app / TamamAdmin#2026  (must be changed on first login)
  Demo customer          +970599000001   (OTP is printed by the console SMS provider)
  Demo partners          +970599000002 driver · +970599000003 courier · +970599000004 technician

NEXT
