# TAMAM — Security

Threat model, the controls that answer each threat (with the file that implements them), and the
release checklist. Sections in parentheses reference the master specification.

---

## 1. What we are protecting

| Asset                       | Why it matters                       | Where it lives                                                       |
| --------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| Customer & partner identity | phone numbers, names, national IDs   | `users`, `partner_profiles.national_id_enc`                          |
| Live location               | real-time position of people         | `partner_availability`, `job_tracking_points`, `/tracking` namespace |
| Money                       | fares, wallets, commissions, payouts | `ledger_*`, `wallets`, `payments`, `withdrawals`                     |
| Verification secrets        | trip PIN, pickup/delivery OTP        | `jobs.*_hash` / `*_enc`                                              |
| Banking details             | partner IBANs                        | `partner_bank_accounts.iban_enc`                                     |
| Staff access                | who can refund, suspend, reprice     | `admin_credentials`, `user_roles`, `admin_role_permissions`          |
| The audit trail             | the record of who did what           | `audit_logs` (append-only)                                           |

## 2. Threat model and controls

### T1 — Account takeover (§10, §92)

_An attacker brute-forces an OTP, reuses a refresh token, or keeps a session after a password reset._

| Control                                                                                                                       | Implementation                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| OTPs stored only as HMAC-SHA256 with a server pepper; never logged, never returned in production                              | `modules/auth/otp.service.ts`, `common/utils/crypto.util.ts` (`hmacHash`)                                  |
| Expiry, max attempts, resend cooldown, hourly caps per phone **and** per IP                                                   | `otp.service.ts` + `CONFIG_KEYS.OTP_*`                                                                     |
| Constant-time comparison of codes and PINs                                                                                    | `safeEqual` in `crypto.util.ts`                                                                            |
| Refresh-token rotation with a family: reusing an old token revokes the whole family                                           | `modules/auth/session.service.ts`                                                                          |
| Admin login: argon2id, lockout after 5 failures for 15 min, a dummy verify so timing never reveals whether the account exists | `modules/auth/auth.service.ts`                                                                             |
| Password change and admin-initiated reset revoke every other session                                                          | `auth.service.ts`, `modules/admin/admin-users.service.ts`                                                  |
| Revocation is enforced on every request, not just at sign-in                                                                  | `TokenService.resolvePrincipal` + Redis revocation markers                                                 |
| A suspended/deleted account cannot obtain or use a token                                                                      | `JwtAuthGuard`, `AccountStatusGuard`, `AuthService.requestOtp` (silent no-op so account state never leaks) |
| Endpoint rate limits on OTP request/verify, refresh and admin login                                                           | `@RateLimit` in `auth.controller.ts`, `common/guards/rate-limit.guard.ts`                                  |

### T2 — Horizontal privilege escalation: reading someone else's job (§88)

_A signed-in user guesses a job/payment/dispute id._

| Control                                                                                                 | Implementation                                                                                |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Every job-scoped read goes through a policy, never through the id alone                                 | `JobsService.getForUser` → `JobPolicy.canView` (`modules/jobs/domain/job-policy.ts`)          |
| The answer is **404, not 403**, when the caller has no relationship — a 403 would confirm the id exists | `JobsService.getForUser`                                                                      |
| The same policy governs tracking, chat, payments, quotes, disputes and support                          | `JobPolicy.canTrack/canChat`, `PaymentsService.getForJob`, `QuotesService`, `DisputesService` |
| Regression-tested end to end                                                                            | `test/permissions.e2e-spec.ts`                                                                |

### T3 — Vertical privilege escalation: staff doing what their role forbids (§142)

| Control                                                                                                          | Implementation                                                             |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Guards check **permissions**, never role names, so roles can be re-shaped without code changes                   | `common/guards/permissions.guard.ts`, `@tamam/shared-types/permissions.ts` |
| Role → permission bundles are seeded and editable only by SUPER_ADMIN; SUPER_ADMIN's own bundle cannot be edited | `modules/rbac/rbac.service.ts`                                             |
| Only a SUPER_ADMIN can grant SUPER_ADMIN, and nobody can remove their own — nor the last one                     | `modules/admin/admin-users.service.ts`                                     |
| Role changes invalidate the cached principal immediately                                                         | `TokenService.invalidatePrincipalCache`                                    |
| Platform-level maintenance additionally requires a real SUPER_ADMIN, not just the permission                     | `modules/maintenance/maintenance.controller.ts`                            |
| Sensitive actions demand a `reason` and produce an audit entry                                                   | `@Audited`, `SENSITIVE_PERMISSIONS`, `modules/audit/audit.service.ts`      |

### T4 — Tampering with money (§56, §144)

_Someone edits a wallet balance, replays a capture, or unbalances the ledger._

| Control                                                                                            | Implementation                                                                         |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Wallet balances are a **cache**: a database trigger rejects any change made outside a ledger write | `prisma/sql/001_…sql` (`tamam_guard_wallet_balance`) + `PrismaService.withLedgerWrite` |
| Ledger entries and transactions are append-only — UPDATE/DELETE raise at the database              | `tamam_forbid_mutation` triggers                                                       |
| Every transaction must balance; a deferred constraint trigger enforces it at commit                | `tamam_assert_balanced_transaction`                                                    |
| The balance is always recomputable and is verified on demand and before payouts                    | `LedgerService.recomputeWalletBalance/verifyWallet/assertWalletIntegrity`              |
| Captures, settlements and refunds are keyed idempotently (`settle:<jobId>`, `refund:<id>`)         | `modules/payments/payments.service.ts`, `modules/ledger/ledger.service.ts`             |
| Prices are computed server-side from a frozen pricing snapshot; the client never sends a price     | `modules/pricing/pricing.service.ts` (snapshots are immutable by trigger)              |
| Proven end to end                                                                                  | `test/payment-idempotency.e2e-spec.ts`, `test/home-service.e2e-spec.ts`                |

### T5 — Double-assignment / lost-update races (§22, §103)

| Control                                                                                                                         | Implementation                                                            |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Redis lock around the job, `SELECT … FOR UPDATE` inside the transaction, and a partial unique index as the last line of defence | `modules/dispatch/dispatch.service.ts`, `uq_job_assignments_one_accepted` |
| Optimistic concurrency on jobs, payments and quotes (`version`)                                                                 | `JobsService.transitionInTx` → `AppException.versionConflict()`           |
| Replayed sensitive POSTs return the first response instead of acting twice                                                      | `common/interceptors/idempotency.interceptor.ts`                          |
| Proven under a real simultaneous accept                                                                                         | `test/dispatch-race.e2e-spec.ts`                                          |

### T6 — PII exposure (§91, §93)

| Control                                                                                                                                            | Implementation                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| National IDs, IBANs, contact phones, trip PINs and delivery OTPs are AES-256-GCM encrypted at rest                                                 | `encrypt/decrypt` in `common/utils/crypto.util.ts`, key from `AppConfigService.encryptionKey` |
| DTO mappers redact per viewer: phones masked unless the viewer is staff, PIN/OTP only to the customer, partner location only while the job is live | `modules/jobs/job.mapper.ts`                                                                  |
| Share-trip links expose a deliberately narrow projection (status, stops, first name, vehicle, ETA) behind a hashed, expiring token                 | `modules/jobs/job-safety.service.ts`                                                          |
| Object keys are server-generated, never derived from the uploaded filename; private objects are only reachable through short-lived signed URLs     | `modules/media/media.service.ts`, `media-url.service.ts`                                      |
| Audit values are redacted before they are written (`password                                                                                       | secret                                                                                        | token | otp | pin | iban | card | cvv | nationalid`) | `AuditService.redact` |
| Analytics events are stripped of PII and depth-limited                                                                                             | `modules/analytics/analytics.service.ts` (`stripPii`)                                         |
| Retention: tracking points, OTP rows, notifications, banner and analytics events are purged on a schedule                                          | `modules/maintenance/maintenance.processor.ts`                                                |

### T7 — Secrets leaking through logs or errors (§90, §101)

| Control                                                                                                        | Implementation                                               |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| pino redacts `authorization`, `cookie`, and the OTP/PIN/password/refresh/IBAN body fields                      | `app.module.ts` logger config                                |
| Errors are a fixed envelope `{ code, message, details, requestId }` — stack traces never leave the server      | `common/errors/all-exceptions.filter.ts`, `app.exception.ts` |
| `console.log` is forbidden in `src/**`                                                                         | conventions §10, enforced in review                          |
| Boot refuses production with placeholder secrets, console SMS, a mock gateway, debug logging or non-HTTPS URLs | `config/env.schema.ts`                                       |
| Prometheus metrics are not exposed publicly                                                                    | `infrastructure/docker/Caddyfile` (`/metrics` → 404)         |

### T8 — Abuse and fraud (§86, §87)

| Control                                                                                                                  | Implementation                                                                    |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Per-endpoint sliding-window limits keyed by user, IP or body field                                                       | `common/guards/rate-limit.guard.ts`, `infrastructure/redis/rate-limit.service.ts` |
| Risk signals: excessive cancellations, promo abuse, multiple accounts, impossible GPS movement, repeated failed payments | `modules/risk/risk.service.ts`, `domain/risk.rules.ts`                            |
| Restrictions (`BLOCK_JOBS`, `BLOCK_PROMOS`, `BLOCK_WALLET`, `BLOCK_LOGIN`) asserted at the entry points                  | `RiskService.assertCanCreateJob/assertCanUsePromo/assertCanUseWallet`             |
| Location samples validated for staleness, accuracy and physically impossible speed                                       | `modules/tracking/tracking.service.ts`                                            |
| Promo caps: per-user limit, usage limit, first-order-only, min order, reservation released on cancel                     | `modules/promotions/promotions.service.ts`                                        |
| Partners cannot accumulate unlimited cash debt: dispatch skips a partner past `wallet.max_negative_partner_minor`        | `DispatchService.findCandidates`                                                  |

### T9 — Untrusted input and injection

| Control                                                                                                      | Implementation                                                       |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Every body/query/param validated by a zod schema before it reaches a service                                 | `@ZodBody/@ZodQuery/@ZodParams`, `@tamam/validation`                 |
| All SQL is Prisma or `$queryRaw` **tagged templates** (parameterised); no string concatenation of user input | `dispatch.service.ts`, `tracking.service.ts`, `analytics.service.ts` |
| Path ids validated as UUIDs before use                                                                       | `common/pipes/uuid.pipe.ts`                                          |
| Uploads: content type and size validated, EXIF stripped, keys server-generated                               | `modules/media/media.service.ts`                                     |
| Helmet, a CORS allowlist (mobile apps send no Origin; browsers must match), explicit allowed headers         | `main.ts`                                                            |

### T10 — Supply chain and infrastructure

| Control                                                                                   | Implementation                                     |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Deterministic installs (`--frozen-lockfile`) everywhere                                   | Dockerfiles, CI                                    |
| `pnpm audit --audit-level=high` and gitleaks on every push                                | `.github/workflows/ci.yml`                         |
| Containers run as a non-root user with a healthcheck                                      | `apps/api/Dockerfile`, `apps/admin-web/Dockerfile` |
| No database, Redis or storage port is published in production                             | `docker-compose.prod.yml`                          |
| HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, automatic TLS | `infrastructure/docker/Caddyfile`                  |

### T11 — Physical safety of users (§66, §67)

SOS alerts are stored, pushed to the `/admin` live map in real time and surfaced on the admin
overview until resolved (`JobSafetyService`, `AdminGateway`, `AdminOverviewService`). Trip sharing
is a short-lived hashed token that can be revoked by the customer at any time.

## 3. Release checklist (§194)

Run through this before every production release. A "no" blocks the release.

**Secrets & configuration**

- [ ] `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OTP_PEPPER`, `ENCRYPTION_KEY` are unique per
      environment, generated with `openssl rand`, and stored in the secret manager — never in git.
- [ ] `ENCRYPTION_KEY` decodes to exactly 32 bytes and has **not** changed since the last release.
- [ ] `SMS_PROVIDER` is a real provider; `PAYMENT_GATEWAY_PROVIDER` is not `mock`.
- [ ] `LOG_LEVEL` is `info` or higher; `API_BASE_URL` is HTTPS.
- [ ] `CORS_ORIGINS` lists only the admin origins that must reach the API.
- [ ] `.env` files are not baked into any image (`env_file` is mounted at runtime).

**Access control**

- [ ] Every new route carries `@RequirePermission` / `@RequireRole`, or an explicit `@Public()`
      with a documented reason.
- [ ] Every new resource read is object-checked in the service, answering 404 for foreign objects.
- [ ] Sensitive mutations carry `@Audited` and require a `reason`.
- [ ] The staff list contains only current employees; leavers are `SUSPENDED`, not deleted.
- [ ] At least two SUPER_ADMIN accounts exist and both have rotated the seeded password.

**Data protection**

- [ ] New PII columns are encrypted or justified in this document.
- [ ] New DTOs were reviewed for over-exposure (phones, exact locations, internal ids).
- [ ] New log statements were reviewed for secrets; new audit values are redactable.
- [ ] New tables that accumulate personal data have a retention job.

**Money**

- [ ] Ledger changes keep every transaction balanced and were covered by a unit test.
- [ ] New money-moving endpoints are idempotent (`@Idempotent` and/or a ledger idempotency key).
- [ ] No float arithmetic on money anywhere in the diff (`percentOf`, `multiply`, `roundDiv` only).

**Resilience**

- [ ] Migrations follow expand → contract and were applied to a staging clone first.
- [ ] A restore drill has been performed within the last 30 days.
- [ ] `pnpm audit --audit-level=high` and gitleaks are green.
- [ ] The full e2e suite passes, including §128 (dispatch race) and §129 (payment idempotency).
- [ ] `GET /metrics` is unreachable from the public internet.
- [ ] Rollback (previous image tag, `RUN_MIGRATIONS=false`) was rehearsed for this release.

## 4. Reporting a vulnerability

Email **security@tamam.app** with reproduction steps. Do not open a public issue. We acknowledge
within one business day and aim to ship a fix or a mitigation within seven days for anything that
exposes personal data or money.
