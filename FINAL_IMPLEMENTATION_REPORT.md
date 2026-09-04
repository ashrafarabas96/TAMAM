# TAMAM — Final Implementation Report

_Generated at the end of the authoring session, 2026-09-03._
_Repository: 828 tracked files across 4 applications and 4 shared packages._

---

## 0. How to read this report

The specification (`docs/MASTER_DEVELOPMENT_PROMPT_TAMAM.pdf`, 93 pages) demands an honest
status per item, with no inflated claims (§200–§205). This report uses four values, and the
distinction between the first two is the single most important fact in the document:

| Status                 | Meaning                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Implemented**        | Written **and executed** — compiled, run, or tested in this environment.                                                                |
| **Written-Unverified** | Code is complete and internally consistent, but **has never been compiled or run**, because the sandbox had no package-registry access. |
| **Partial**            | Deliberately incomplete; the gap is named.                                                                                              |
| **Not Implemented**    | Absent; the reason is named.                                                                                                            |

**The overwhelming majority of this repository is `Written-Unverified`.** That is a statement
about the environment, not about the code: `registry.npmjs.org`, `pub.dev` and the Ubuntu
archive were all blocked by the sandbox's network policy, so `pnpm install`, `prisma generate`,
`flutter pub get`, `tsc`, `jest`, `vitest` and `flutter analyze` could never be run. Nothing was
faked to work around this — the code was written to compile, and the verification step is
deferred to a session with network access. **Section 6 is the procedure for that session, and it
is a required part of the delivery, not an optional follow-up.**

What _was_ executed here: the design-token generator, the Dart contracts generator, and the
structural self-checks described in §5 (import resolution, key parity, truncation, brace
balance, TODO scan) — all run with Node against the source tree.

---

## 1. Executive summary

| Part                                      | Files | Status              | One-line assessment                                                       |
| ----------------------------------------- | ----: | ------------------- | ------------------------------------------------------------------------- |
| `apps/api` — NestJS backend               |   255 | Written-Unverified  | All 32 modules, 31 controllers, 313 documented routes, 96 Prisma models.  |
| `apps/admin-web` — Next.js console        |   164 | Written-Unverified  | 29 pages, permission-gated, incl. the campaign/banner manager.            |
| `apps/customer-mobile` — Flutter          |   160 | Written-Unverified  | 151 Dart files, all four services, banner surfaces, live tracking.        |
| `apps/partner-mobile` — Flutter           |   191 | Written-Unverified  | 182 Dart files, onboarding→offer→job→quote→earnings, background location. |
| `packages/*` — shared contracts           |    28 | Mixed               | Tokens **Implemented**; types/validation Written-Unverified.              |
| `docs/*`, `infrastructure/*`, `scripts/*` |    22 | Implemented         | Written and reviewed; the bring-up script is unexecuted.                  |
| Compile / test / migrate / seed run       |     — | **Not Implemented** | Blocked by network policy — see §6.                                       |

Zero occurrences of `TODO`/`FIXME` across all TypeScript, TSX and Dart sources (excluding
generated files, which carry a DO-NOT-EDIT banner). No mock API layer exists in any client: every
screen calls the real endpoints.

---

## 2. Backend — `apps/api`

### 2.1 Foundation

| Item                                                                      | Status             | Notes                                                               |
| ------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------- |
| Bootstrap, versioned prefix `/api/v1`, Swagger at `/docs` (non-prod)      | Written-Unverified | `main.ts`; OpenAPI export script included.                          |
| Config service with typed keys + bounds, DB-backed overrides, Redis cache | Written-Unverified | `packages/shared-types/src/config-keys.ts` is the single catalogue. |
| Structured logging (pino) with redaction, `X-Request-Id` propagation      | Written-Unverified | Every error envelope carries `requestId`.                           |
| Global error filter → `{ code, message, details?, requestId }`            | Written-Unverified | Clients branch on `code`, never on `message`.                       |
| Health (`/health/live`, `/health/ready`) and Prometheus `/metrics`        | Written-Unverified | `@nestjs/terminus` + `prom-client`.                                 |
| Guard chain `RateLimit → JwtAuth → AccountStatus → Permissions`           | Written-Unverified | Applied globally; per-route policies declared by decorator.         |

### 2.2 Domain modules (32)

`admin`, `analytics`, `audit`, `auth`, `campaigns`, `catalog`, `chat`, `config`, `customers`,
`dispatch`, `disputes`, `health`, `jobs`, `ledger`, `maintenance`, `media`, `metrics`,
`notifications`, `partners`, `payments`, `pricing`, `promotions`, `quotes`, `ratings`, `rbac`,
`risk`, `support`, `tracking`, `users`, `vehicles`, `wallet`, `zones` — all **Written-Unverified**.

Highlights of the core engine, which was authored directly rather than delegated:

- **Universal Job Engine** — one `jobs` table serving RIDE, DELIVERY and HOME_SERVICE. Transitions
  are validated against an explicit `JOB_TRANSITIONS` table in `shared-types`, executed under
  `SELECT … FOR UPDATE` with an optimistic `version` column, and recorded in an append-only
  `job_events` table. Domain events are emitted **after** commit, never inside the transaction.
- **Dispatch** — PostGIS candidate search, deterministic weighted scoring (unit-tested pure
  function), wave-based offers on BullMQ delayed jobs, offer TTL, total-timeout →
  `NO_PARTNER_AVAILABLE`. Accept is race-safe three ways: a Redis lock, a transaction, and a
  partial unique index (`uq_job_assignments_one_accepted`) as the last line of defence.
- **Pricing** — server-side only. Integer minor units throughout; rule JSON per job type / zone /
  vehicle / category; surge overrides; Redis-cached estimates; an immutable `pricing_snapshots`
  row written at creation and used at completion. No client computes a price.
- **Money** — double-entry ledger with immutability triggers and a deferred balanced-transaction
  constraint. The wallet balance cache can only be written inside `PrismaService.withLedgerWrite`,
  which sets a session GUC the trigger checks — a stray `UPDATE` fails loudly.
- **Tracking** — batched location ingestion, adaptive client intervals, ETA refresh, Socket.IO
  `/tracking` namespace with a Redis adapter for horizontal scale, and a retention purge job.

### 2.3 Security (spec §85–§99)

| Control                                                                     | Status             |
| --------------------------------------------------------------------------- | ------------------ |
| OTP stored as HMAC with a server pepper, attempt + resend limits            | Written-Unverified |
| Rotating refresh tokens with family reuse-detection, device sessions        | Written-Unverified |
| Permission-based RBAC (never role checks in code paths)                     | Written-Unverified |
| Object-level authorization answering **404** rather than 403 for non-owners | Written-Unverified |
| AES-256-GCM encryption of PII at rest                                       | Written-Unverified |
| Redis sliding-window rate limits, per-route policies                        | Written-Unverified |
| Append-only audit log with DB-enforced immutability                         | Written-Unverified |
| helmet, strict CORS allow-list, payload caps, log redaction                 | Written-Unverified |

### 2.4 Tests

31 test files: unit specs beside the domain code (fare calculator, candidate scoring, campaign
targeting, admin search) and six e2e suites — `ride`, `delivery`, `home-service`,
`dispatch-race`, `payment-idempotency`, `permissions` — with shared fixtures and flow helpers.
**Status: Written-Unverified.** They have never been executed; the jest coverage threshold
(60 %) is a guess that should be re-tuned once real numbers exist.

---

## 3. Admin console — `apps/admin-web`

**Written-Unverified.** Next.js 14 App Router, TypeScript strict, Tailwind bound to the shared
design tokens, TanStack Query, react-hook-form + the shared zod schemas, MapLibre, Recharts.
29 pages, every one permission-gated and reachable from a single nav manifest.

Notable: `/campaigns` implements the banner manager the owner asked for end-to-end — creative
upload through the media-intent flow with per-placement aspect-ratio validation read from
`@tamam/ui-tokens`, bilingual copy, CTA/deep-link picker, targeting by zone / language / user
type / platform, scheduling in Asia/Jerusalem, priority, weight, frequency cap, a preview that
renders exactly like the mobile hero and inline banners, a targeting tester backed by
`POST /admin/campaigns/preview`, and an analytics view (impressions, clicks, CTR, attributed jobs).

`/live-map` subscribes to the `/admin` Socket.IO namespace; `/dispatch` is the manual-assignment
console; `/zones` includes a GeoJSON polygon editor; `/staff` renders the roles × permissions
matrix; `/audit` shows a field-level diff.

Session handling: tokens are held in an encrypted httpOnly cookie written by a route handler
that proxies `POST /auth/admin/login`; the client fetches short-lived access tokens from a
session route. Documented in the app's README.

---

## 4. Mobile applications

Both are **Written-Unverified**, Flutter 3.24 / Dart 3, Riverpod 2 without codegen, go_router,
dio, `flutter_map` behind a `MapView` abstraction, Arabic-first with full RTL and a complete
English mirror, light and dark themes generated from the shared tokens.

Neither app contains a hand-copied enum or endpoint string: `tamam_contracts.dart` and
`tamam_tokens.dart` are generated from `packages/shared-types` and `packages/ui-tokens`.

### 4.1 Customer app — 151 Dart files

Auth (phone/OTP), catalog, home with the hero banner carousel and inline banners, ride booking
with map pickers and fare estimate, delivery with stops and package details, home-service request
with options and scheduling, live tracking with the partner's position and ETA, quote review and
approval, chat, ratings, wallet and payment methods, promo codes, saved places, notifications,
support and disputes, account and legal.

### 4.2 Partner app — 182 Dart files

Seven-step resumable onboarding wizard (personal info, roles, skills, documents with expiry,
vehicle, zones, review) with a status screen for pending and rejected states; the online/offline
work session with an Android foreground service and iOS background location; the incoming-offer
sheet with a countdown ring and race-safe accept; the active-job screen driving the full state
machine for all three service types including trip PIN, pickup OTP, proof of delivery with photo
and signature, and the home-service inspection → quote → work → confirmation cycle; the quote
builder; job history; earnings with statement and withdrawals; document and vehicle management;
chat; account. 581 localization keys, verified present and identical in both ARB files.

Platform configuration (manifest permissions, foreground service declaration, deep links,
`Info.plist` background modes and bilingual usage descriptions) and a setup README are included
for both apps. Each still requires a one-time `flutter create` to generate the platform scaffolds
— documented in the READMEs.

---

## 5. What was actually verified here

Executed successfully in this environment:

- `packages/ui-tokens/scripts/generate.mjs` → `dist/tokens.ts`, `dist/tokens.css`, and the Dart
  token files in both Flutter apps. **Implemented.**
- `scripts/generate-dart-contracts.mjs` → 48 enums plus the API constants into both apps.
  **Implemented.** (Two generator defects — an invalid Dart literal and skipped single-line enums —
  were found and fixed here.)
- Structural checks over the source tree: zero `TODO`/`FIXME`; every local and workspace import
  path resolves; no truncated files; balanced braces; localization key parity in both directions
  for both mobile apps and the admin console; every admin page's permission gate matches its nav
  entry; every partner route referenced exists in the router.

Not executed, and therefore not claimed: type-checking, linting, unit tests, e2e tests,
`prisma validate`, migration, seeding, `flutter analyze`, `flutter test`, and any Docker build.

---

## 6. Required next session — verification and repair

This is the remaining work, and it must run in an environment whose **Network access is set to
Trusted or Full** (the setting is chosen on the new-session screen; it cannot be changed for a
session already running).

```bash
curl -s https://registry.npmjs.org/zod/latest | head -c 200      # must print JSON

sudo apt-get update && sudo apt-get install -y postgresql-16-postgis-3
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER tamam WITH PASSWORD 'tamam' SUPERUSER;" \
                     -c "CREATE DATABASE tamam OWNER tamam;"
redis-server --daemonize yes
git clone --depth 1 -b stable https://github.com/flutter/flutter.git ~/flutter
export PATH="$HOME/flutter/bin:$PATH"

cd tamam && cp apps/api/.env.example apps/api/.env
pnpm install                       # this also writes the missing pnpm-lock.yaml
pnpm tokens:generate
pnpm --filter @tamam/shared-types --filter @tamam/validation build
bash scripts/db/create-init-migration.sh
pnpm --filter @tamam/api prisma:generate && pnpm --filter @tamam/api prisma:migrate:dev
pnpm --filter @tamam/api seed
pnpm --filter @tamam/api typecheck && pnpm --filter @tamam/api lint && pnpm --filter @tamam/api test
pnpm --filter @tamam/api test:e2e
pnpm --filter @tamam/admin-web typecheck && pnpm --filter @tamam/admin-web build
(cd apps/customer-mobile && flutter create --org app.tamam --project-name tamam_customer --platforms=android,ios . \
  && flutter pub get && flutter gen-l10n && flutter analyze && flutter test)
(cd apps/partner-mobile  && flutter create --org app.tamam --project-name tamam_partner  --platforms=android,ios . \
  && flutter pub get && flutter gen-l10n && flutter analyze && flutter test)
```

Every failure must be fixed at its **root cause** — never by deleting a test, loosening a type,
or stubbing a call (spec §201). Expect a first pass of ordinary compile errors: this is 828 files
that no compiler has ever seen.

---

## 7. Known gaps and defects — the honest list

### 7.1 Blocking

| #   | Item                                                  | Impact                                                                                                           |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| B1  | Nothing has been compiled, migrated, seeded or tested | The single blocker. Until §6 runs, "it works" is unproven.                                                       |
| B2  | `pnpm-lock.yaml` does not exist                       | `pnpm install` in §6 creates it. Until then the Dockerfiles and CI, which use `--frozen-lockfile`, cannot build. |
| B3  | Flutter platform scaffolds absent                     | Each app needs one `flutter create` (documented) before it can build.                                            |

### 7.2 Backend API gaps found while building the clients

Each of these was discovered by a client needing something the API does not offer. None is
worked around with a fake — the client degrades honestly, and the fix belongs in the API.

| #   | Gap                                                                           | Consequence today                                                                                                                                             |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `GET /me` returns roles, not effective permissions                            | The console re-derives permissions from the default role bundles; it drifts the moment a role is edited. Add `permissions[]` — the client already prefers it. |
| A2  | Admin campaign DTO exposes `creative.imageUrl` but `PUT` needs `imageMediaId` | Editing a campaign forces re-uploading both language creatives.                                                                                               |
| A3  | No `GET /media/:id` status route                                              | Processing is async and campaign create rejects non-`READY` media; the console can only retry, not poll.                                                      |
| A4  | No admin view of a partner's earnings; no wallet lookup by owner              | The partner page shows balance but not commission history; statements need a `walletId` only obtainable from the ledger accounts list.                        |
| A5  | `JobPolicy.canChat` requires a support permission                             | Dispatchers with `JOBS_READ_ALL` cannot read a job's chat transcript.                                                                                         |
| A6  | No PATCH for an approved partner's registered roles/zones/categories          | Only the onboarding endpoints exist; the app reuses them for zones/skills and treats active roles as a per-shift device preference.                           |
| A7  | No `DELETE /partners/me/bank-accounts/:id`; no document delete/replace        | A stale payout account cannot be removed; re-upload relies on the server superseding by type.                                                                 |
| A8  | Admins cannot attach dispute evidence                                         | Only the user-facing evidence route exists.                                                                                                                   |
| A9  | Several admin GETs return raw Prisma rows                                     | BigInt/Decimal arrive as number-or-string; clients type defensively. DTO mappers would stabilise them.                                                        |
| A10 | Zone service rules have no delete/disable-by-id                               | The UI renders them read-only.                                                                                                                                |
| A11 | Feature-flag catalogue has no descriptive route                               | The console toggles `enabled` + reason; rollout is displayed read-only.                                                                                       |
| A12 | Notification templates have no delete route                                   |                                                                                                                                                               |

### 7.3 Internal inconsistencies to fix during verification

| #   | Item                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `PaymentsService.getForJob` answers **403** for a non-owner where `JobsService.getForUser` answers **404**. The spec requires 404; align payments.                                                                                              |
| C2  | Six DTO shapes (`RefundDto`, `DailyKpiDto`, `PartnerAvailabilityDto`, `HeartbeatResultDto`, `WalletIntegrityDto`, `RiskSignalDto`) are declared inside services rather than `packages/shared-types`. Move them so clients share one definition. |
| C3  | `ZoneOperatingHours` cannot express midnight as an end time; the seed uses `23:59`. Either allow `24:00` or store minutes-from-midnight.                                                                                                        |
| C4  | The Prettier check is commented out in CI. Re-enable once `pnpm format` has been run against a compiled tree.                                                                                                                                   |
| C5  | Neither Flutter app calls `initializeDateFormatting()` before `runApp`. It works inside a resolved widget tree, but a `DateFormat` built outside one (background isolate, early formatter) would throw. One line in each `main.dart`.           |
| C6  | Jest coverage threshold of 60 % is unmeasured; re-tune against real output.                                                                                                                                                                     |

### 7.4 Deliberately out of scope

| Item                               | Reason                                                                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real payment-gateway integration   | The spec asks for an abstraction; `PaymentGatewayProvider` has mock and none implementations. A live provider requires the owner's merchant credentials.        |
| Push delivery (FCM/APNs)           | The `PushTokenProvider` interface and registration flow exist with a no-op implementation; wiring needs project credentials and the platform scaffolds from B3. |
| App Store / Play submission assets | Beyond the code deliverable.                                                                                                                                    |
| Load and penetration testing       | A k6 tracking script is included; running it needs a deployed environment.                                                                                      |

---

## 8. Verdict

The architecture, the data model, the domain logic, the security model, the two mobile
applications and the admin console are complete as written, and they are internally consistent:
one enum vocabulary, one state machine, one token file, one set of validation schemas, shared by
all four applications through generated code.

What this delivery does **not** yet include is proof that it runs. That proof is one session of
work away, and §6 is the script for it. Any statement stronger than that would be dishonest, and
the specification is explicit that an honest partial report is worth more than a confident
inaccurate one (§205).
