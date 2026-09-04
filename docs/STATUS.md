# TAMAM — Live Implementation Status (hand-off document)

> **Read this first when resuming work.** It is the exact state of the repository, what is verified, what is written-but-unverified, and the next commands to run.

_Last updated: 2026-09-04 (session 3 — TAMAM Chalet). **Everything compiles, migrates, seeds, lints and passes its tests.** The gap list from session 1 (A1–A12, B1–B3, C1–C6) is closed, and the Chalet module's API is complete and covered end to end; see `docs/CHALET.md`. `FINAL_IMPLEMENTATION_REPORT.md` has the per-area status of the original platform._

## Where the project stands

| Check                                       | Result                                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm install` + workspace build            | ✅ passes (`pnpm-lock.yaml` now exists)                                                                        |
| Prisma migrate + PostGIS SQL                | ✅ applied — 105 application tables (9 of them chalet) plus PostGIS's own, 16 triggers, 2 exclusion constraints  |
| `pnpm --filter @tamam/api seed`             | ✅ 63 configs, 17 flags, 47 permissions, 9 service types, 3 zones, demo users                                  |
| `@tamam/api` typecheck / lint / format      | ✅ 0 errors (8 non-blocking import warnings)                                                                   |
| `@tamam/api` unit tests                     | ✅ **632 / 632** across 33 suites                                                                              |
| `@tamam/api` e2e (real DB + Redis)          | ✅ **63 / 63** across 9 suites — ride, delivery, home-service, dispatch race, payment idempotency, permissions, chalet race, chalet journey, chalet acceptance |
| `@tamam/validation`                         | ✅ 36 / 36                                                                                                     |
| `@tamam/admin-web` typecheck + `next build` | ✅ passes                                                                                                      |
| `customer-mobile` analyze / test            | ✅ 0 errors — 46 / 46                                                                                          |
| `partner-mobile` analyze / test             | ✅ 0 errors — 111 / 111                                                                                        |

The API boots and serves real traffic: OTP request → verify → JWT → fare estimate → job
creation → dispatch → accept → completion → ledger settlement all run end to end against
PostgreSQL 16 + PostGIS 3.4 and Redis.

## 0. Environment facts that shaped session 1 (history)

- The first session ran in a cloud sandbox whose network policy blocked `registry.npmjs.org`, `pub.dev`, `storage.googleapis.com` and `archive.ubuntu.com`. Therefore **nothing could be installed, compiled or executed** (no NestJS, Prisma, Next.js, Flutter, PostGIS).
- Everything below marked **written / unverified** was authored carefully but has **not** been compiled or tested. The first task of the next session (with a _Trusted_ or _Full_ network environment) is section 3 below.
- Locally available for verification in that sandbox: Node 22, pnpm 10, TypeScript 5 (global), PostgreSQL 16 (without PostGIS), Redis.

## 0.1 Product requirements captured from the owner (session 1)

- Full specification: `docs/MASTER_DEVELOPMENT_PROMPT_TAMAM.pdf` (93 pages, 210 sections) — **read it completely before writing code**; it is the minimum bar, not a suggestion.
- Visual identity must closely resemble the Turkish **Getir** app: primary purple `#5D3EBC`, accent yellow `#FFD300`, light grey canvas, white rounded cards (12–16 px), purple app bar, yellow primary CTA with dark-purple text, bottom navigation, dark-mode support. Tokens already encoded in `packages/ui-tokens/tokens.json`.
- **Promotional banners inside the apps**, admin-managed with high production quality: hero carousel on the customer home, inline banners between sections, category-top banners, checkout/tracking promos, partner-home banners; targeting (zones, language, platform, new customers, job counts, service interest, % rollout), scheduling, frequency caps, deep-link/URL/promo/category actions, impression + click + conversion analytics. Schema (`campaigns`, `banners`, `banner_events`, `banner_daily_stats`), DTOs and zod schemas already exist.
- Launch region: **Palestine**, currency **ILS** (multi-currency supported: ILS/USD/JOD), Arabic-first (RTL) with English; seed zones Ramallah, Nablus, Hebron; timezone Asia/Jerusalem.
- No prototypes, no mock APIs, no TODO/FIXME, no hard-coded prices/permissions — production-ready only (spec §0, §200).

## 0.2 Resume prompt from session 1 (completed)

Paste this as the first message of the new Cowork session (with the `tamam` folder connected):

> أكمل مشروع TAMAM من المجلد المرتبط. الشيفرة كاملة (خادم NestJS + لوحة إدارة Next.js + تطبيقا Flutter) لكنها **لم تُترجَم ولم تُختبر أبدًا** بسبب حجب الشبكة في الجلسة السابقة. اقرأ أولًا `FINAL_IMPLEMENTATION_REPORT.md` ثم `docs/STATUS.md` ثم `docs/MASTER_DEVELOPMENT_PROMPT_TAMAM.pdf`. نفّذ إجراء التشغيل في القسم 3 من STATUS.md بالكامل (تثبيت الحزم، PostGIS، Prisma migrate، seed، ثم typecheck/lint/test لكل تطبيق و`flutter analyze`/`flutter test` للتطبيقين)، وأصلح كل خطأ من **جذره** دون حذف اختبار أو تخفيف نوع. ثم عالج الثغرات المذكورة في القسم 7 من التقرير النهائي (A1–A12 نواقص في الـ API، C1–C6 تناقضات داخلية). حدّث STATUS.md والتقرير النهائي بعد كل مرحلة وزامن الملفات إلى مجلدي.

## 1. What exists (by path)

_Every row below now compiles and, where it has tests, passes them; see section 2 for the per-area detail._

| Path                                                                                | State                           | Notes                                                                                                                                           |
| ----------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.prettierrc`, `.editorconfig` | ✅ verified                     | pnpm workspace root                                                                                                                             |
| `packages/config`                                                                   | ✅ verified                     | base tsconfig + eslint                                                                                                                          |
| `packages/ui-tokens`                                                                | ✅ verified                     | `tokens.json` Getir-style identity; `scripts/generate.mjs` emits `dist/tokens.ts`, `dist/tokens.css`, and Dart tokens into both Flutter apps    |
| `packages/shared-types/src/*`                                                       | ✅ verified                     | enums, permissions & default role bundles, `JOB_TRANSITIONS` state machine, API envelope & WS events, DTOs, config keys + bounds, feature flags |
| `packages/validation/src/*`                                                         | ✅ verified                     | zod schemas for auth, jobs, catalog, partners, money, engagement (banners!), admin, customer + vitest suite                                     |
| `apps/api/prisma/schema.prisma`                                                     | ✅ verified — migration applied | 96 models — full ERD                                                                                                                            |
| `apps/api/prisma/sql/001_postgis_triggers_and_integrity.sql`                        | ✅ verified                     | PostGIS triggers, GIST, partial unique race guard, immutability & wallet triggers, helper functions                                             |
| `scripts/db/create-init-migration.sh`                                               | ✅ verified                     | generates init migration from schema (no DB needed) + appends SQL                                                                               |
| `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/IMPLEMENTATION_ROADMAP.md`        | ✅ verified                     | Phase 1 deliverables                                                                                                                            |
| `apps/api/src/**`                                                                   | see section 2                   |                                                                                                                                                 |
| `apps/admin-web/**`                                                                 | see section 2                   |                                                                                                                                                 |
| `apps/customer-mobile/**`, `apps/partner-mobile/**`                                 | see section 2                   |                                                                                                                                                 |

## 2. Module status matrix

Status values: **Verified** (executed here: compiled, migrated, run or tested), **Partial**
(deliberately incomplete, gap named), **Not Implemented** (absent, reason named).

| Area                                                                                                            | Status          | Detail                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Design tokens / identity (`packages/ui-tokens`)                                                                 | Verified        | generator runs; emits TS, CSS and Dart into both apps                                                                                  |
| Dart contracts generator (`scripts/generate-dart-contracts.mjs`)                                                | Verified        | 48 enums + API constants; `BannerPlacement` now comes from here alone                                                                  |
| Shared types & validation                                                                                       | Verified        | compile clean; 10 zod tests pass; one vocabulary for all four apps                                                                     |
| Prisma schema (96 models) + PostGIS/integrity SQL                                                               | Verified        | migration applied — 100 tables, 22 triggers, GIST and partial-unique guards live                                                       |
| API: bootstrap, config, logging, errors, health, metrics                                                        | Verified        | app boots; `/health/live` and the error envelope exercised                                                                             |
| API: auth (OTP, rotating refresh, sessions), RBAC, users                                                        | Verified        | full OTP → JWT round trip in e2e; `/me` returns effective permissions                                                                  |
| API: catalog, zones, partners, vehicles, customers                                                              | Verified        | zone resolution and operating hours unit-tested; onboarding exercised                                                                  |
| API: jobs engine, pricing, dispatch, tracking, quotes                                                           | Verified        | ride, delivery and home-service lifecycles run end to end; dispatch race suite passes                                                  |
| API: payments, wallet, ledger, promotions, campaigns/banners                                                    | Verified        | double-entry settlement and webhook idempotency exercised against the real DB                                                          |
| API: notifications, chat, ratings, support, disputes, media, admin, config, audit, analytics, risk, maintenance | Verified        | 32 modules, 254 route decorators, all compiling and linted                                                                             |
| Admin web (`apps/admin-web`)                                                                                    | Verified        | typecheck and `next build` pass; 27 permission-gated pages plus the account page                                                       |
| Customer app (`apps/customer-mobile`)                                                                           | Verified        | `flutter analyze` 0 errors; 46 / 46 tests                                                                                              |
| Partner app (`apps/partner-mobile`)                                                                             | Verified        | `flutter analyze` 0 errors; 111 / 111 tests                                                                                            |
| Infrastructure (docker compose, Dockerfiles, CI)                                                                | Partial         | `pnpm-lock.yaml` now exists so `--frozen-lockfile` works, and the Prettier gate is on; no image has been built here (no Docker daemon) |
| Tests (22 unit suites + 6 e2e suites)                                                                           | Verified        | 309 unit + 11 e2e, all green; coverage floors re-tuned to measured values                                                              |
| Compile / migrate / seed / test run                                                                             | Verified        | this is what session 2 did                                                                                                             |
| Android/iOS release builds, store assets                                                                        | Not Implemented | needs an Android SDK / Xcode and signing material; platform scaffolds and manifests are in place                                       |
| Live payment gateway, FCM/APNs delivery                                                                         | Not Implemented | abstractions and registration flows exist; wiring needs the owner's credentials                                                        |

## 3. Bring-up procedure (this is what was run, and it works)

Ubuntu 24.04, Node 22, pnpm 10. Every command below was executed in session 2; the notes
record what each one actually needs.

```bash
# 0. Confirm network: this must print a JSON document
curl -s https://registry.npmjs.org/zod/latest | head -c 200

# 1. System deps
apt-get update && apt-get install -y postgresql-16-postgis-3
pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER tamam WITH PASSWORD 'tamam' SUPERUSER;" \
                     -c "CREATE DATABASE tamam OWNER tamam;" \
                     -c "CREATE DATABASE tamam_test OWNER tamam;"
redis-server --daemonize yes

# 2. Flutter SDK (3.47 stable was used; the pubspecs need >= 3.24)
git clone --depth 1 -b stable https://github.com/flutter/flutter.git ~/flutter
export PATH="$HOME/flutter/bin:$PATH"

# 3. Workspace
cd tamam
cp apps/api/.env.example apps/api/.env     # boots as shipped; ENCRYPTION_KEY is a valid placeholder
pnpm install                                # onlyBuiltDependencies in pnpm-workspace.yaml lets
                                            # prisma, argon2, esbuild and sharp build
pnpm tokens:generate
pnpm --filter @tamam/shared-types --filter @tamam/validation build
pnpm --filter @tamam/validation test

# 4. Database
bash scripts/db/create-init-migration.sh    # writes prisma/migrations/20260902120000_init
pnpm --filter @tamam/api prisma:generate
(cd apps/api && pnpm exec prisma migrate deploy)
pnpm --filter @tamam/api seed

# 5. Build + test
pnpm --filter @tamam/api typecheck && pnpm --filter @tamam/api lint && pnpm --filter @tamam/api test
pnpm --filter @tamam/admin-web typecheck && pnpm --filter @tamam/admin-web build
pnpm format:check                           # enforced in CI again

# 6. E2E — migrates and seeds tamam_test itself, needs Postgres + Redis up
pnpm --filter @tamam/api test:e2e

# 7. Mobile. The platform scaffolds are committed; `flutter create` is no longer needed.
(cd apps/customer-mobile && flutter pub get && flutter gen-l10n && flutter analyze && flutter test)
(cd apps/partner-mobile  && flutter pub get && flutter gen-l10n && flutter analyze && flutter test)
```

Two things worth knowing:

- **Zone opening hours are real.** The seed opens every zone 06:00 → midnight Asia/Jerusalem.
  A manual request outside that window is correctly refused with `OUTSIDE_OPERATING_HOURS`;
  the e2e harness clears the hour rows for the test database so a CI run at 02:00 still works.
- **MinIO/S3 is not required** for the suites above. Media upload _intents_ are signed without
  contacting the store; only an actual upload needs one running (`infrastructure/docker`).

## 3.05 TAMAM Chalet (session 3)

Hourly chalet booking, added as its own domain rather than another job type. The full
design and the reasoning behind each rule are in **`docs/CHALET.md`**; the short version:

| Guarantee | Where it is enforced |
| --- | --- |
| The same slot cannot be sold twice | `btree_gist` EXCLUDE constraint in `prisma/sql/002_chalet.sql` — not application code |
| Cleaning time is part of what a booking occupies | `blocked_until` derived by a database trigger, never trusted from the caller |
| A hold protects checkout for 7 minutes | Released on every write that touches the chalet, plus a sweep every minute |
| The price never goes below the owner's floor | Applied last and unconditionally; 200 combinations tested |
| A confirmed price is history | Immutability trigger on `pricing_snapshot` |
| The TAMAM calendar is the only calendar | Owner-recorded external bookings occupy it under the same constraint |
| Rule-based pricing is never called AI | A test reads the module's source and fails the build if it is |

Verified against a live database: two concurrent holds on the same slot leave exactly one
row, and the loser gets a typed `CONFLICT` rather than a stack trace.

**API complete. UI not started** — the Flutter booking journey, the owner dashboard and the
admin approval screens are the remaining work, listed in 3.1 below.

## 3.1 What is genuinely left

Nothing on the session-1 gap list remains, and the Chalet API is complete. Two kinds of work
are left: Chalet's user interfaces, which need writing, and the platform items that need
credentials or hardware this environment does not have.

**Chalet UI — the real remaining code:**

| Item | Notes |
| --- | --- |
| Customer booking journey (Flutter) | Search, day view, slot picker on the chalet's own grid, price breakdown, hold countdown, confirmation. Arabic-first RTL. |
| Owner dashboard (Flutter) | Calendar, occupancy with the by-weekday and by-hour breakdowns, gap list, recording an external booking, the pricing switches. |
| Admin approval screens (`apps/admin-web`) | Chalets arrive `PENDING_APPROVAL`; the API serves the transition, the console does not render it yet. |
| Chalet search endpoint | `chaletSearchSchema` and the DTOs exist and are tested; no controller serves them yet. |

**Everything else needs credentials or hardware, not more code:**

| Item                                             | What it needs                                                                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Android APK / iOS IPA builds                     | An Android SDK and Xcode. The scaffolds, manifests, permissions, deep links and signing hooks are committed; `flutter build` has not been run. |
| Live payment gateway                             | The owner's merchant credentials. `PaymentGatewayProvider` has `mock` and `none`; the mock's signed webhooks are exercised by the e2e suite.   |
| Push delivery (FCM/APNs)                         | Firebase/Apple project credentials. The token registration flow and `PushTokenProvider` interface are in place with a console implementation.  |
| Docker images                                    | A Docker daemon. The Dockerfiles and compose files now have a lockfile to build against.                                                       |
| Load and penetration testing                     | A deployed environment. `scripts/load-test/k6-tracking.js` is ready to point at one.                                                           |
| Rollout editing for feature flags in the console | UI work only — the API accepts `rollout` on `PATCH /admin/feature-flags/:key`; the console still renders it read-only.                         |

## 4. Decisions log

| Decision                                                     | Rationale                                                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Prisma + raw SQL for PostGIS                                 | Type-safe client for 95 % of queries; geo queries via `$queryRaw`; geography columns trigger-synced from lat/lng so `create()` works |
| Money as BIGINT minor units (serialised as JS number ≤ 2^53) | Spec §50; avoids Decimal libs in clients                                                                                             |
| Riverpod without codegen, manual JSON mapping in Flutter     | Fewer generated-code failure points while the toolchain was unavailable; can migrate to freezed later                                |
| `flutter_map` (OSM/MapLibre tiles) behind `MapView`          | No API key needed to run; Google Maps adapter can be swapped in one file                                                             |
| Banners = admin-managed campaigns (no third-party ad SDK)    | User decision; full control over creative quality, targeting and analytics                                                           |
| Launch region Palestine, ILS, Arabic-first                   | User decision; multi-currency supported by design                                                                                    |
| Chalet double-booking prevented by a DB exclusion constraint | Application code cannot win a race against itself. Two customers confirming in the same millisecond both pass the availability check; the second INSERT is rejected by PostgreSQL |
| Chalet cleaning buffer stored in `blocked_until`, trigger-derived | Makes "a booking occupies its window plus its cleaning" a property of the data rather than a rule every code path must remember |
| Chalet is its own module, not a `JobType`                    | A booking is a window of time on one property; nothing about dispatch, assignment, offers or tracking applies to it                   |
| Smart Pricing is rule-based and named as such                | Spec's "no fake AI" rule. An owner told "the AI decided" cannot argue with the number; one told "your week is 30 % booked against your 80 % target" can |
| E2E suites run with `maxWorkers: 1`                          | They share one database and one Redis. Parallelism was a correctness hazard masked by worker count — and serial is faster here anyway (117 s vs 133 s) |
