# TAMAM — Testing

What is tested, how to run it, and what each suite actually proves.

---

## 1. Layers

| Layer                  | Location                           | Runner                            | Needs                      |
| ---------------------- | ---------------------------------- | --------------------------------- | -------------------------- |
| Schema validation      | `packages/validation/**/*.test.ts` | vitest                            | nothing                    |
| Domain + service units | `apps/api/src/**/*.spec.ts`        | jest (`jest.config.cjs`)          | nothing — Prisma is mocked |
| Integration / E2E      | `apps/api/test/*.e2e-spec.ts`      | jest (`test/jest-e2e.config.cjs`) | Postgres+PostGIS, Redis    |
| Load                   | `scripts/load-test/k6-tracking.js` | k6                                | a running API              |
| Flutter                | `apps/*-mobile/test`               | `flutter test`                    | Flutter SDK                |

## 2. Running them

```bash
# unit — fast, no services, enforces the coverage floor in jest.config.cjs
pnpm --filter @tamam/api test
pnpm --filter @tamam/api test -- --coverage
pnpm --filter @tamam/validation test

# e2e — bring up the isolated datastores first (ports 55432 / 56379 / 59000)
docker compose -f infrastructure/docker/docker-compose.test.yml up -d

DATABASE_URL=postgresql://tamam:tamam@localhost:55432/tamam_test \
REDIS_URL=redis://localhost:56379/0 \
S3_ENDPOINT=http://localhost:59000 \
S3_PUBLIC_BASE_URL=http://localhost:59000/tamam-public \
  pnpm --filter @tamam/api test:e2e

# one suite, with the migrate/seed output visible
E2E_VERBOSE=1 pnpm --filter @tamam/api test:e2e -- ride.e2e-spec.ts
```

`test/setup-env.ts` fills in every variable `env.schema.ts` requires, so a plain
`pnpm test` works with nothing but the datastores. It deliberately points `OSRM_BASE_URL` at an
unreachable address: routing then falls back to the haversine estimate immediately instead of
waiting on the public OSRM demo server, and the suite runs offline.

The e2e suites run `--runInBand`. `TestApp.boot()` applies `prisma migrate deploy` and the
development seed **once per process**, then each suite calls `truncateOperationalTables()` so it
starts from the seeded world with no jobs, payments or ledger rows.

### The test harness

`apps/api/test/helpers/app.ts`

- `TestApp.boot()` — builds the real `AppModule` (same guards, interceptors, queues and workers as
  production), applies migrations and the seed, and returns the harness.
- `request()` — supertest against the live HTTP server; `url('jobs')` prefixes `/api/v1`.
- `loginCustomer(phone)` / `loginPartner(phone)` — a real OTP round-trip. The console SMS provider
  returns the code as `devCode`, so the suite exercises `POST /auth/otp/request` and
  `/auth/otp/verify` rather than minting tokens behind the app's back.
- `loginAdmin(email, password)` — the real `POST /auth/admin/login`.
- `truncateOperationalTables()` — TRUNCATE (not DELETE: the ledger, audit log and job events are
  append-only by trigger), restores a clean `partner_availability` row per partner, resets cached
  profile counters and drops the Redis rate-limit windows.

## 3. What each e2e suite proves

### `ride.e2e-spec.ts` — spec §125

The full mobility journey on real infrastructure: estimate → create → partner ONLINE → **dispatch
wave actually runs on BullMQ** → offer → accept → en route → geofenced arrival → start with the
customer's trip PIN → complete → CASH capture → receipt → two-way rating.

Guarantees it locks in: prices come from the server (the estimate, not the client); the customer
sees a **masked** partner phone; the partner cannot read the trip PIN from their own DTO; a wrong
PIN is `TRIP_PIN_INVALID` and leaves the job untouched; the receipt number is issued exactly once;
the settlement's ledger entries sum to zero.

### `delivery.e2e-spec.ts` — spec §126

Both verification codes and proof of delivery. A wrong pickup code is `PICKUP_OTP_INVALID`, a
wrong delivery code is `DELIVERY_OTP_INVALID`, and neither code is ever visible on the courier's
view of the job. After hand-over, `job_delivery_details` carries `pickupVerifiedAt`,
`podOtpVerified`, the receiver name, the POD coordinates and the timestamp.

### `home-service.e2e-spec.ts` — spec §127

The inspection/quote workflow: `INSPECTION_STARTED → QUOTE_REQUIRED → QUOTE_SUBMITTED →
QUOTE_APPROVED → WORK_STARTED → WORK_COMPLETED → CUSTOMER_CONFIRMED → COMPLETED`. It asserts the
technician cannot approve their own quote, that the **approved quote** becomes the final price
(not the inspection estimate), and that the money is right: the entries balance, the finance
verification endpoint agrees with the cached wallet, and platform revenue is exactly the seeded
15 % commission.

### `dispatch-race.e2e-spec.ts` — spec §128 · _the important one_

Two eligible drivers are offered the same ride and both accept **in the same tick**
(`Promise.all`). The test asserts:

- exactly one `200` and one `409`, with the loser carrying `JOB_ALREADY_ASSIGNED` or `OFFER_EXPIRED`;
- exactly **one** `ACCEPTED` row in `job_assignments` for that job;
- the job's `partner_id` is the winner, no offer is left `OFFERED`, and only the winner is `BUSY`.

That is the observable contract of three independent guards (spec §22): a Redis lock on
`job:<id>`, `SELECT … FOR UPDATE` on the job row inside the transaction, and the partial unique
index `uq_job_assignments_one_accepted`. Any one of them alone could be defeated by a lost lock, a
retried request or a second process; the test proves the combination holds under a real
simultaneous accept, which is the failure mode that costs a platform its drivers' trust.

### `payment-idempotency.e2e-spec.ts` — spec §129

Money is never applied twice: calling `captureForJob` again books no second settlement, receipt or
payment row; a refund replayed with the same `Idempotency-Key` returns the first response with
`Idempotent-Replayed: true` and creates no second refund or ledger transaction (and reusing the
key with a _different_ body is `IDEMPOTENCY_KEY_REUSED`); a provider webhook delivered twice with
the same event id is stored once, processed once, and the second delivery answers
`{ received: true, duplicate: true }`. A wrongly signed webhook is rejected with `403`.

### `permissions.e2e-spec.ts` — spec §130

Object-level authorization. Customer B gets **404** — not 403 — on customer A's job, its timeline
and its payment, and never sees it in a list. An unrelated partner also gets 404. A SUPPORT agent,
who legitimately _can_ read every job, gets **403** when trying to drive its state machine or issue
a refund, and cannot reach staff management or maintenance. Unauthenticated admin routes are 401,
and an authenticated customer hitting an admin route is 403.

> **Why 404 and not 403 for a foreign job:** answering 403 confirms the id exists, which turns any
> admin route into an enumeration oracle. The policy (spec §88) answers "not found" whenever the
> caller has no relationship to the resource; 403 is reserved for callers who legitimately see the
> resource but may not perform the action.

## 4. Unit specs worth knowing about

| Spec                                          | What it pins down                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `jobs/domain/job-state-machine.spec.ts`       | only legal transitions, per actor                                                                        |
| `pricing/domain/fare-calculator.spec.ts`      | integer money maths, no float drift                                                                      |
| `ledger/domain/ledger.rules.spec.ts`          | every settlement plan balances                                                                           |
| `dispatch/domain/candidate-scoring.spec.ts`   | scoring weights and ordering                                                                             |
| `promotions/domain/promo.rules.spec.ts`       | promo eligibility and caps                                                                               |
| `campaigns/domain/banner-targeting.spec.ts`   | audience/zone/rollout targeting                                                                          |
| `admin/admin-search.service.spec.ts`          | a group is queried **only** with its permission; plates are normalised; every group is capped at 10 rows |
| `admin/domain/dispatch-problems.spec.ts`      | the console's "needs attention" classifier                                                               |
| `maintenance/domain/document-expiry.spec.ts`  | the 14-day warning window, once-only warnings, idempotent expiry                                         |
| `maintenance/document-expiry.service.spec.ts` | the claim-then-notify order, claim release on failure, forced OFFLINE only for _required_ documents      |

## 5. Load testing

`scripts/load-test/k6-tracking.js` opens N Socket.IO connections to `/tracking` and streams
location batches at the production cadence (`tracking.interval.active_s`, 4 s), which is the
heaviest sustained path in the platform.

```bash
# 1. Mint partner access tokens (any number of seeded//fixture partners) into tokens.json.
#    Each entry is the `tokens.accessToken` from POST /api/v1/auth/otp/verify.
cat > tokens.json <<'JSON'
["eyJhbGciOi…", "eyJhbGciOi…"]
JSON

# 2. Run it.
k6 run -e API_WS=ws://localhost:3000 -e TOKENS_FILE=tokens.json \
       -e VUS=200 -e DURATION=5m scripts/load-test/k6-tracking.js
```

Thresholds the script enforces (it exits non-zero when they are breached):

| Threshold                                             | Why                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `tamam_ingest_latency_ms p(95) < 500`, `p(99) < 1500` | a location must be acknowledged well inside one 4 s send interval, otherwise the app queues and the map lags |
| `tamam_ws_connect_success rate > 0.99`                | handshake failures mean the proxy or the token path is broken under load                                     |
| `tamam_samples_rejected count < 10`                   | systematic rejection means stale/inaccurate sample validation is misconfigured                               |

Watch on the server side while it runs: `tamam_ws_connections{namespace="tracking"}`,
`tamam_location_updates_total{result="rejected"}`, `tamam_queue_oldest_waiting_seconds`, and the
Postgres write rate on `job_tracking_points` (the retention job keeps that table bounded).

## 6. CI

`.github/workflows/ci.yml` (source of truth: `infrastructure/ci/github-actions.yml`) runs
lint → typecheck → unit tests → e2e (with Postgres/PostGIS, Redis and MinIO service containers) →
image builds → Flutter analyze/test for both apps → security (`pnpm audit --audit-level=high`,
gitleaks). Installs are `--frozen-lockfile` with a cached pnpm store.
