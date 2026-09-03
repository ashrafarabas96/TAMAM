# TAMAM — Deployment

How to get the platform from a git checkout to a running production system. Day-two procedures
(backups, restores, incident runbooks) live in [OPERATIONS.md](./OPERATIONS.md).

---

## 1. What you need

| Component | Requirement | Notes |
| --- | --- | --- |
| PostgreSQL | **16+ with PostGIS 3.4**, `pgcrypto`, `pg_trgm` | Managed instance recommended. The API refuses to start without the extensions. |
| Redis | 7+, `maxmemory-policy noeviction` | Holds queues (BullMQ), rate limits, caches, the Socket.IO adapter. Evicting keys would drop queued jobs. |
| Object storage | S3-compatible, two buckets | `tamam-private` (no public access) and `tamam-public` (read-only download policy). |
| Node | 22 LTS | Only needed if you run outside containers. |
| Routing | OSRM instance (or a Google Maps key) | The public OSRM demo server is not a production dependency — self-host it. |
| SMS | A real provider | `SMS_PROVIDER=console` is **rejected** in production by `env.schema.ts`. |
| TLS | Handled by Caddy in `docker-compose.prod.yml` | Or terminate upstream and point Caddy at it. |

## 2. Configuration

Every value is validated by `apps/api/src/config/env.schema.ts` at boot; the process exits rather
than starting with an invalid or placeholder configuration. Production additionally refuses:

* `change-me…` / `test-…` values for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OTP_PEPPER`, `ENCRYPTION_KEY`
* `SMS_PROVIDER=console`, `PAYMENT_GATEWAY_PROVIDER=mock`
* `LOG_LEVEL=debug|trace`
* a non-HTTPS `API_BASE_URL`

Generate the secrets once and store them in your secret manager:

```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET
openssl rand -base64 32   # OTP_PEPPER
openssl rand -base64 32   # ENCRYPTION_KEY  (must decode to exactly 32 bytes)
```

> **`ENCRYPTION_KEY` is not rotatable in place.** It decrypts national IDs, IBANs, contact phone
> numbers, trip PINs and delivery OTPs. Rotating it requires a re-encryption migration; treat it
> like a database.

Start from `apps/api/.env.example`, fill it in, and mount it as `/etc/tamam/api.env` (or point
`API_ENV_FILE` elsewhere).

## 3. Database migrations

Migrations are plain SQL under `apps/api/prisma/migrations/`. The initial migration is generated
from the schema and has the hand-written PostGIS/trigger DDL appended:

```bash
bash scripts/db/create-init-migration.sh     # first time only, commits into git
```

At deploy time exactly one process applies them:

```bash
pnpm --filter @tamam/api prisma:migrate:deploy
```

In containers the entrypoint does it when `RUN_MIGRATIONS=true`. **Set it on exactly one replica.**
`prisma migrate deploy` never resets and never generates — it only applies pending files.

The production database is **never seeded**: `prisma/seed.ts` throws when `NODE_ENV=production`.

### Expand → migrate → contract

The API and the database are deployed independently, so every schema change ships in two releases:

1. **Expand** — add the nullable column / new table, deploy code that writes both shapes.
2. **Contract** — once every replica runs the new code, drop the old column in a later release.

A migration that renames or drops a column in the same release that the old code is still serving
will cause 500s during the rollout window.

## 4. Building images

Both images build from the repository root (they need the pnpm workspace):

```bash
docker build -f apps/api/Dockerfile       -t ghcr.io/tamam/api:$(git rev-parse --short HEAD) .
docker build -f apps/admin-web/Dockerfile -t ghcr.io/tamam/admin-web:$(git rev-parse --short HEAD) .
```

Both run as a non-root user (uid 10001) and declare a `HEALTHCHECK`. The API image keeps the
Prisma CLI so the entrypoint can apply migrations.

> `pnpm-lock.yaml` **must be committed**: both Dockerfiles and CI install with
> `--frozen-lockfile`, which fails without it.

## 5. Deploying

```bash
export DOMAIN=api.tamam.app ADMIN_DOMAIN=admin.tamam.app ACME_EMAIL=ops@tamam.app
export API_IMAGE=ghcr.io/tamam/api:<sha> ADMIN_IMAGE=ghcr.io/tamam/admin-web:<sha>

docker compose -f infrastructure/docker/docker-compose.prod.yml pull
docker compose -f infrastructure/docker/docker-compose.prod.yml up -d
```

Caddy obtains and renews certificates automatically, proxies `/` to the API, upgrades WebSocket
connections for the four Socket.IO namespaces, and blocks `/metrics` from the public internet.

### Scaling out

* The API is stateless; scale it horizontally. Socket.IO uses the Redis adapter, so a client may
  connect to any replica.
* BullMQ workers run **in-process**. Every replica processes queue jobs — that is intended and
  safe: handlers are idempotent and the maintenance scheduler deduplicates by `jobId`
  (`<name>-<yyyymmddHHMM>`), so N replicas firing the same cron minute enqueue one job.
* Only one replica should carry `RUN_MIGRATIONS=true`.

### Zero-downtime rollout

1. Deploy the migration release with `RUN_MIGRATIONS=true` on one replica.
2. Wait for `/health/ready` to report `up` for database, redis and storage.
3. Roll the remaining replicas.
4. Watch `tamam_http_errors_total` and the queue depth (`GET /api/v1/admin/maintenance/queues`).

## 6. Post-deploy verification

```bash
curl -fsS https://$DOMAIN/health/live
curl -fsS https://$DOMAIN/health/ready            # database + redis + storage
curl -fsS https://$DOMAIN/api/v1/zones            # public catalogue responds
curl -fsS -o /dev/null -w '%{http_code}\n' https://$DOMAIN/metrics   # must be 404 from outside
```

Then, signed in as a SUPER_ADMIN:

* `GET /api/v1/admin/overview` — live counters render.
* `GET /api/v1/admin/maintenance/queues` — `failed` is 0 on every queue.
* `GET /api/v1/admin/config` — configuration matches the release notes.

## 7. Rollback

Application rollback is a re-deploy of the previous image tag with `RUN_MIGRATIONS=false`:

```bash
API_IMAGE=ghcr.io/tamam/api:<previous-sha> \
  docker compose -f infrastructure/docker/docker-compose.prod.yml up -d api
```

**Do not roll migrations back.** Prisma has no down-migrations, and the ledger and audit tables
are append-only by database trigger. If a migration must be undone, write a new forward migration.
Because every change follows expand → contract, the previous image always runs against the new
schema.

## 8. Local and test stacks

```bash
bash scripts/setup.sh                                   # full local bring-up (idempotent)
docker compose -f infrastructure/docker/docker-compose.yml up -d db redis minio
docker compose -f infrastructure/docker/docker-compose.test.yml up -d   # ports 55432 / 56379 / 59000
```

`scripts/setup.sh` checks the toolchain, writes `apps/api/.env` with freshly generated secrets,
starts the datastores, installs dependencies, builds the shared packages, migrates, seeds, and
uploads the seeded banner creatives to MinIO.
