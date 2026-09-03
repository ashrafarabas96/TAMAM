# TAMAM — Operations

Day-two operations: backups, recovery targets, routine maintenance and the incident runbooks.
Deployment itself is in [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 1. Backups

### Schedule and retention

| What | Frequency | Retention | Where |
| --- | --- | --- | --- |
| PostgreSQL full dump (`pg_dump -Fc`) | every 6 h | 14 days local, 90 days offsite | `scripts/db/backup.sh` → local dir + S3 bucket |
| PostgreSQL WAL / PITR | continuous | 7 days | managed provider's PITR feature |
| Object storage (`tamam-private`) | daily | 30 days | bucket versioning + lifecycle rule |
| Redis | **not backed up** | — | queues and caches are reconstructible; nothing durable lives only in Redis |

```bash
# cron: 0 */6 * * *
BACKUP_DIR=/var/backups/tamam BACKUP_S3_BUCKET=tamam-backups \
  bash scripts/db/backup.sh >> /var/log/tamam-backup.log 2>&1
```

The script fails loudly rather than shipping a bad backup: it re-reads the archive with
`pg_restore --list`, refuses a dump containing fewer than 20 populated tables, and writes a
SHA-256 checksum alongside it.

### Recovery targets

| Target | Value | How it is met |
| --- | --- | --- |
| **RPO** (max data loss) | **5 minutes** | continuous WAL archiving / managed PITR; the 6-hourly dump is the fallback (RPO 6 h) |
| **RTO** (time to serve) | **60 minutes** | provision from PITR or restore the newest dump (~10–20 min for a launch-sized database) + redeploy |
| Restore drill | **monthly** | `TARGET_DATABASE_URL=…_restore_check bash scripts/db/restore.sh <dump>` — a drill that never touched a real restore is not a backup strategy |

### Restore procedure

```bash
# 1. Stop writers (scale the API to zero, or put Caddy into maintenance mode).
docker compose -f infrastructure/docker/docker-compose.prod.yml stop api admin-web

# 2. Restore into a scratch database first and verify.
TARGET_DATABASE_URL=postgresql://…/tamam_restore_check \
  bash scripts/db/restore.sh /var/backups/tamam/tamam-20260903T020000Z.dump

# 3. Promote: restore into the real database (guarded — CONFIRM=yes is mandatory).
CONFIRM=yes bash scripts/db/restore.sh /var/backups/tamam/tamam-20260903T020000Z.dump

# 4. Re-apply any migrations newer than the dump, then start the API.
pnpm --filter @tamam/api prisma:migrate:deploy
docker compose -f infrastructure/docker/docker-compose.prod.yml up -d
```

`restore.sh` recreates the required extensions, restores with `--clean --if-exists`, and then
verifies the result before declaring success:

* row counts for `users`, `jobs`, `ledger_entries`, `service_zones`
* **every ledger transaction balances** (debits = credits) — a non-zero count aborts the restore
* **PostGIS geometry survived** — `service_zones.area` is not null

## 2. Routine maintenance

Everything is enqueued by `MaintenanceScheduler` onto the `maintenance` queue and executed by
`MaintenanceProcessor`. Job ids are `<name>-<yyyymmddHHMM>` so N replicas produce one run.

| Cadence | Jobs | Effect |
| --- | --- | --- |
| every minute | `heartbeat-sweep`, `campaign-scheduler` | partners whose device went silent go OFFLINE; scheduled campaigns activate, expired ones end |
| every 10 min | `expire-otps`, `session-cleanup` | OTP rows past `retention.otp_days` deleted; expired sessions purged |
| hourly | `banner-stats-rollup`, `tracking-retention` | raw banner events aggregated into `banner_daily_stats`; tracking points past `tracking.retention_days` deleted |
| daily 02:00 UTC | `daily-kpis`, `notification-retention`, `expire-documents` | yesterday's KPIs materialised; retention sweep (notifications, banner events > 90 d, expired idempotency keys, analytics events > 180 d); partner documents warned/expired |

Manual trigger (SUPER_ADMIN only):

```bash
curl -X POST https://$DOMAIN/api/v1/admin/maintenance/run/daily-kpis \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"reason":"backfilling after the 02:00 failure","date":"2026-09-02"}'
```

Queue health: `GET /api/v1/admin/maintenance/queues` returns waiting/active/delayed/failed/completed
per queue. **A growing `failed` count is an incident, not a metric.**

## 3. Monitoring

`GET /metrics` (Prometheus, blocked at the proxy) exposes:

| Metric | Watch for |
| --- | --- |
| `tamam_http_request_duration_seconds` | p95 > 500 ms on `/jobs` or `/estimates/*` |
| `tamam_http_errors_total` | any sustained 5xx |
| `tamam_dispatch_outcome_total{outcome="no_partner"}` | supply problem in a zone |
| `tamam_dispatch_seconds` | p95 > 60 s — dispatch is too slow |
| `tamam_payment_failures_total` | spike = gateway incident |
| `tamam_queue_oldest_waiting_seconds` | > 60 s = a worker is stuck or starved |
| `tamam_ws_connections{namespace}` | sudden drop = the proxy is closing upgrades |
| `tamam_location_updates_total{result="rejected"}` | client clock skew or GPS abuse |

Health: `/health/live` (process) and `/health/ready` (database + redis + storage).

---

# Runbooks

## R1 — Dispatch is stuck (jobs sit in SEARCHING / NO_PARTNER_AVAILABLE)

**Symptoms** — `admin/overview.dashboard.searchingJobs` climbing, customers report "no driver
found", `tamam_dispatch_outcome_total{outcome="no_partner"}` rising.

1. **Is it supply or is it us?**
   `GET /api/v1/admin/dispatch/console?onlyUnassigned=true` — look at `offersSent`.
   * `offersSent > 0` and every offer expired → real supply problem, go to step 5.
   * `offersSent == 0` → no candidate matched, continue.
2. **Are partners actually online?**
   `GET /api/v1/admin/dispatch/nearby-partners?lat=…&lng=…&radiusMeters=5000`.
   Empty while partners insist they are online usually means **stale heartbeats**: the console
   row shows `PARTNER_HEARTBEAT_STALE`. Check that the `/tracking` WebSocket upgrade works through
   the proxy and that `tamam_ws_connections{namespace="tracking"}` is not near zero.
3. **Is the queue moving?**
   `GET /api/v1/admin/maintenance/queues` → the `dispatch` queue. `waiting` growing with `active`
   at 0 means no worker is consuming: check Redis connectivity and restart the API replicas.
   `failed` growing means the wave handler is throwing — read the logs for `dispatch wave`.
4. **Eligibility.** A candidate must be: APPROVED, not suspended, ONLINE with a fresh heartbeat,
   `current_job_id IS NULL`, in the job's zone (`partner_zones`), holding the required role, with
   an APPROVED active vehicle of the requested type (ride/delivery), category-matched
   (home service), not restricted, and — for CASH jobs — not past
   `wallet.max_negative_partner_minor`. That last one silently removes partners who owe
   commission: check `GET /api/v1/admin/ledger/wallets/<id>/statement`.
5. **Act.**
   * Widen the search: raise `dispatch.wave*.radius_m` / `dispatch.wave*.size` via
     `PATCH /api/v1/admin/config` (bounded, audited).
   * Re-dispatch a specific job: `POST /api/v1/admin/jobs/<id>/redispatch`.
   * Assign by hand: `POST /api/v1/admin/jobs/<id>/assign` with `{ partnerId, reason, version }`.
   * Genuine shortage: raise surge (`POST /api/v1/admin/pricing/surge`) and notify partners
     (`POST /api/v1/admin/notifications/broadcast`).

## R2 — Payment webhook backlog

**Symptoms** — `finance` queue `waiting`/`failed` climbing, payments stuck in `PENDING`,
customers charged by the provider but the job shows unpaid.

1. **Are events arriving?**
   `SELECT count(*) FROM webhook_events WHERE received_at > now() - interval '15 minutes';`
   Zero while the provider dashboard shows deliveries → the provider cannot reach us. Check the
   proxy logs for `POST /api/v1/payments/webhooks/*` and that the provider's IPs are not blocked.
2. **Are they being rejected?** A `403` means the signature failed:
   `PAYMENT_GATEWAY_WEBHOOK_SECRET` no longer matches the provider, or a proxy is rewriting the
   body. The raw bytes must reach the app untouched (`rawBody: true` in `main.ts`).
3. **Are they stuck in processing?**
   ```sql
   SELECT event_type, count(*), max(attempts), max(last_error)
   FROM webhook_events WHERE processed_at IS NULL GROUP BY 1;
   ```
   `last_error` names the cause. A row with `attempts >= 5` has exhausted BullMQ retries.
4. **Replay.** Events are stored before processing, so replaying is safe — the handlers are
   idempotent (`processWebhook` returns immediately when `processedAt` is set, capture is guarded
   by the payment version and the `settle:<jobId>` ledger key). Re-enqueue the stuck ids from a
   Node shell against the `finance` queue, or ask the provider to redeliver: the duplicate is
   detected by `(provider, event_id)` and answered `{ received: true, duplicate: true }`.
5. **Reconcile.** For each affected job compare `payments.captured_minor` with the provider's
   report, then `POST /api/v1/admin/ledger/wallets/<id>/verify` to prove the ledger and the cached
   balances still agree. Never adjust a wallet by hand — use `POST /api/v1/admin/wallets/adjust`,
   which posts a balanced ledger transaction with a reason.

## R3 — A partner cannot go online

**Symptoms** — a partner reports that the "Go online" switch fails, or dispatch never offers them
work although the app shows them online.

Walk the checks in the order the server applies them
(`PartnerAvailabilityService.assertCanGoOnline`):

1. **Account status** — `GET /api/v1/admin/partners/<id>`.
   `verificationStatus` must be `APPROVED` and `suspendedUntil` null or past.
   → `POST /api/v1/admin/partners/<id>/decision` with `REINSTATE`/`APPROVE`.
2. **Expired required documents** — the error carries `expiredDocumentTypes`. Required types come
   from the categories the partner selected. This is the most common cause after the daily
   `expire-documents` sweep runs. → the partner re-uploads; an agent reviews with
   `POST /api/v1/admin/partners/<id>/documents/<docId>/review`.
3. **Active roles** — at least one, and every role must be granted to the partner.
4. **Vehicle** — DRIVER and COURIER need an active, APPROVED vehicle selected as
   `activeVehicleId`. A vehicle whose review was reverted silently blocks going online.
   → `POST /api/v1/admin/vehicles/<id>/review`.
5. **The switch worked but no offers arrive** — they are online but invisible:
   * heartbeats stopped (`admin/dispatch/partners/<id>/timeline` shows no recent activity, or the
     console shows `PARTNER_HEARTBEAT_STALE`) — a device/network problem, not a server one;
     `tracking.heartbeat_offline_after_s` controls how quickly they drop out;
   * they are already `BUSY` on a job that never closed → find it in the dispatcher console and
     close it (`POST /api/v1/admin/jobs/<id>/transition`), which releases the partner;
   * the zone is missing from `partner_zones` → `PATCH /api/v1/admin/partners/<id>`;
   * a `BLOCK_JOBS` restriction is active → `GET /api/v1/admin/risk/restrictions`, lift with
     `POST /api/v1/admin/risk/restrictions/<id>/lift`;
   * for CASH jobs, a negative wallet past `wallet.max_negative_partner_minor` (see R1 §4).

## R4 — Ledger and wallet balances disagree

**Symptoms** — `POST /api/v1/admin/ledger/wallets/<id>/verify` returns `matches: false`, or the
log line `wallet balance cache diverged from the ledger` appears.

1. The ledger entries are the truth; `wallets.balance_minor` is a cache. A database trigger blocks
   any update to it outside a ledger write, so divergence means a bug, not tampering.
2. Find the scope:
   ```sql
   SELECT transaction_id
   FROM ledger_entries GROUP BY transaction_id
   HAVING SUM(CASE WHEN direction='DEBIT' THEN amount_minor ELSE -amount_minor END) <> 0;
   ```
   This should return **zero rows** — an unbalanced transaction cannot commit (constraint trigger).
3. Recompute the cache with `LedgerService.recomputeWalletBalance(walletId)` and re-verify.
4. Freeze payouts for the affected partner (`wallets.is_frozen`) until the verification passes.
   Withdrawals already call `assertWalletIntegrity` and will refuse to pay out.

## R5 — Redis is unavailable

Redis holds queues, rate limits, caches, session-revocation markers and the Socket.IO adapter.

* `/health/ready` reports `redis: down`; job creation still works but dispatch does not run.
* Restore Redis first — queued BullMQ jobs are persisted in Redis (`appendonly yes`); losing them
  loses in-flight dispatch waves and notification sends. Jobs stuck in `SEARCHING` are recovered
  with `POST /api/v1/admin/jobs/<id>/redispatch`.
* `maxmemory-policy` **must** be `noeviction`. With an eviction policy Redis silently deletes queue
  keys under pressure, which loses work with no error anywhere.
