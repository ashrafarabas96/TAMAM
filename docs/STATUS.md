# TAMAM — Live Implementation Status (hand-off document)

> **Read this first when resuming work.** It is the exact state of the repository, what is verified, what is written-but-unverified, and the next commands to run.

_Last updated: 2026-09-02 (session 1 — cloud sandbox without package-registry access)_

## 0. Environment facts that shaped session 1

* The first session ran in a cloud sandbox whose network policy blocked `registry.npmjs.org`, `pub.dev`, `storage.googleapis.com` and `archive.ubuntu.com`. Therefore **nothing could be installed, compiled or executed** (no NestJS, Prisma, Next.js, Flutter, PostGIS).
* Everything below marked **written / unverified** was authored carefully but has **not** been compiled or tested. The first task of the next session (with a *Trusted* or *Full* network environment) is section 3 below.
* Locally available for verification in that sandbox: Node 22, pnpm 10, TypeScript 5 (global), PostgreSQL 16 (without PostGIS), Redis.

## 0.1 Product requirements captured from the owner (session 1)

* Full specification: `docs/MASTER_DEVELOPMENT_PROMPT_TAMAM.pdf` (93 pages, 210 sections) — **read it completely before writing code**; it is the minimum bar, not a suggestion.
* Visual identity must closely resemble the Turkish **Getir** app: primary purple `#5D3EBC`, accent yellow `#FFD300`, light grey canvas, white rounded cards (12–16 px), purple app bar, yellow primary CTA with dark-purple text, bottom navigation, dark-mode support. Tokens already encoded in `packages/ui-tokens/tokens.json`.
* **Promotional banners inside the apps**, admin-managed with high production quality: hero carousel on the customer home, inline banners between sections, category-top banners, checkout/tracking promos, partner-home banners; targeting (zones, language, platform, new customers, job counts, service interest, % rollout), scheduling, frequency caps, deep-link/URL/promo/category actions, impression + click + conversion analytics. Schema (`campaigns`, `banners`, `banner_events`, `banner_daily_stats`), DTOs and zod schemas already exist.
* Launch region: **Palestine**, currency **ILS** (multi-currency supported: ILS/USD/JOD), Arabic-first (RTL) with English; seed zones Ramallah, Nablus, Hebron; timezone Asia/Jerusalem.
* No prototypes, no mock APIs, no TODO/FIXME, no hard-coded prices/permissions — production-ready only (spec §0, §200).

## 0.2 Resume prompt for the next session

Paste this as the first message of the new Cowork session (with the `tamam` folder connected):

> أكمل مشروع TAMAM من المجلد المرتبط. اقرأ أولًا `docs/STATUS.md` ثم `docs/MASTER_DEVELOPMENT_PROMPT_TAMAM.pdf` كاملًا ثم `docs/ARCHITECTURE.md` و`docs/DATABASE.md`. نفّذ إجراء التشغيل في القسم 3 من STATUS.md (تثبيت الحزم، PostGIS، Prisma migrate)، وأصلح أي أخطاء ترجمة في الأساس الموجود، ثم تابع المراحل بالترتيب (Auth → Catalog/Zones/Partners → Job Engine → Pricing → Dispatch → Tracking → Customer App → Partner App → Flows → Payments/Ledger → Notifications/Chat → Admin → Support/Disputes → Analytics/Audit → Security → E2E → Production). حدّث STATUS.md في نهاية كل مرحلة وزامن الملفات إلى مجلدي.

## 1. What exists (by path)

| Path | State | Notes |
| --- | --- | --- |
| `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.prettierrc`, `.editorconfig` | ✅ written | pnpm workspace root |
| `packages/config` | ✅ written | base tsconfig + eslint |
| `packages/ui-tokens` | ✅ **verified** (generator ran) | `tokens.json` Getir-style identity; `scripts/generate.mjs` emits `dist/tokens.ts`, `dist/tokens.css`, and Dart tokens into both Flutter apps |
| `packages/shared-types/src/*` | ✅ written / unverified | enums, permissions & default role bundles, `JOB_TRANSITIONS` state machine, API envelope & WS events, DTOs, config keys + bounds, feature flags |
| `packages/validation/src/*` | ✅ written / unverified | zod schemas for auth, jobs, catalog, partners, money, engagement (banners!), admin, customer + vitest suite |
| `apps/api/prisma/schema.prisma` | ✅ written / unverified (`prisma validate` pending) | 96 models — full ERD |
| `apps/api/prisma/sql/001_postgis_triggers_and_integrity.sql` | ✅ written | PostGIS triggers, GIST, partial unique race guard, immutability & wallet triggers, helper functions |
| `scripts/db/create-init-migration.sh` | ✅ written | generates init migration from schema (no DB needed) + appends SQL |
| `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/IMPLEMENTATION_ROADMAP.md` | ✅ written | Phase 1 deliverables |
| `apps/api/src/**` | see section 2 | |
| `apps/admin-web/**` | see section 2 | |
| `apps/customer-mobile/**`, `apps/partner-mobile/**` | see section 2 | |

## 2. Module status matrix

Status values: **Implemented** (written + compiled + tested), **Written-Unverified** (code complete, never compiled), **Partial**, **Blocked**, **Not Implemented**.

| Area | Status | Detail |
| --- | --- | --- |
| Design tokens / identity | Implemented | generator verified |
| Shared types & validation | Written-Unverified | |
| Prisma schema + custom SQL | Written-Unverified | |
| API: bootstrap, config, logging, errors, requestId, health | _see git log_ | updated at end of session |
| API: auth (OTP, JWT, sessions), RBAC, users | _see git log_ | |
| API: catalog, zones, partners, vehicles | _see git log_ | |
| API: jobs engine, pricing, dispatch, tracking | _see git log_ | |
| API: payments, wallet, ledger, promotions, campaigns/banners | _see git log_ | |
| API: notifications, chat, ratings, support, disputes, media, admin, config, audit, analytics, risk | _see git log_ | |
| Admin web | _see git log_ | |
| Customer app | _see git log_ | |
| Partner app | _see git log_ | |
| Infrastructure (docker, CI) | _see git log_ | |
| Tests | Not Implemented until toolchain available | unit specs are written next to code where noted |

(The rows marked _see git log_ are updated by the closing commit of each session — run `git log --stat` in the repo root.)

## 3. Next session — exact bring-up procedure

```bash
# 0. Confirm network: this must print a JSON document
curl -s https://registry.npmjs.org/zod/latest | head -c 200

# 1. System deps (Ubuntu 24.04 sandbox)
sudo apt-get update && sudo apt-get install -y postgresql-16-postgis-3
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER tamam WITH PASSWORD 'tamam' SUPERUSER;" -c "CREATE DATABASE tamam OWNER tamam;"
redis-server --daemonize yes

# 2. Flutter SDK (needed for apps/customer-mobile & apps/partner-mobile)
git clone --depth 1 -b stable https://github.com/flutter/flutter.git ~/flutter && export PATH="$HOME/flutter/bin:$PATH" && flutter --version

# 3. Workspace
cd tamam
cp apps/api/.env.example apps/api/.env
pnpm install
pnpm tokens:generate
pnpm --filter @tamam/shared-types --filter @tamam/validation build
pnpm --filter @tamam/validation test

# 4. Database
bash scripts/db/create-init-migration.sh           # writes prisma/migrations/20260902120000_init
pnpm --filter @tamam/api prisma:generate
pnpm --filter @tamam/api prisma:migrate:dev
pnpm --filter @tamam/api seed

# 5. Build + test everything, fix ROOT CAUSES (no workarounds — §201)
pnpm --filter @tamam/api typecheck && pnpm --filter @tamam/api lint && pnpm --filter @tamam/api test
pnpm --filter @tamam/admin-web typecheck && pnpm --filter @tamam/admin-web build
(cd apps/customer-mobile && flutter pub get && flutter gen-l10n && flutter analyze && flutter test)
(cd apps/partner-mobile && flutter pub get && flutter gen-l10n && flutter analyze && flutter test)

# 6. E2E
pnpm --filter @tamam/api test:e2e
```

Then update this file and `FINAL_IMPLEMENTATION_REPORT.md`.

## 4. Decisions log

| Decision | Rationale |
| --- | --- |
| Prisma + raw SQL for PostGIS | Type-safe client for 95 % of queries; geo queries via `$queryRaw`; geography columns trigger-synced from lat/lng so `create()` works |
| Money as BIGINT minor units (serialised as JS number ≤ 2^53) | Spec §50; avoids Decimal libs in clients |
| Riverpod without codegen, manual JSON mapping in Flutter | Fewer generated-code failure points while the toolchain was unavailable; can migrate to freezed later |
| `flutter_map` (OSM/MapLibre tiles) behind `MapView` | No API key needed to run; Google Maps adapter can be swapped in one file |
| Banners = admin-managed campaigns (no third-party ad SDK) | User decision; full control over creative quality, targeting and analytics |
| Launch region Palestine, ILS, Arabic-first | User decision; multi-currency supported by design |
