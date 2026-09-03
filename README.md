# TAMAM — منصة الخدمات المحلية الشاملة

**TAMAM** (تمام) is a multi-service local platform for Palestine: rides (مشوار), delivery
(توصيل), home services (خدمات) and urgent requests — one universal job engine behind four
applications, Arabic-first with full RTL, currency ILS.

> **State of this repository:** all four applications are written and internally consistent, but
> **none of it has been compiled or tested yet** — the authoring environment had no access to the
> package registries. Read **[`FINAL_IMPLEMENTATION_REPORT.md`](FINAL_IMPLEMENTATION_REPORT.md)**
> before anything else; it gives the honest status of every area and the complete list of known
> gaps. **[`docs/STATUS.md` §3](docs/STATUS.md)** is the bring-up procedure.

## Structure

```
apps/
  api/                NestJS 10 · Prisma 5 · PostgreSQL + PostGIS · Redis · BullMQ · Socket.IO
  admin-web/          Next.js 14 App Router · Tailwind · TanStack Query · MapLibre · Recharts
  customer-mobile/    Flutter 3.24 · Riverpod 2 · go_router · flutter_map
  partner-mobile/     Flutter 3.24 · background location · foreground service
packages/
  shared-types/       enums, permissions, job state machine, DTOs, config keys
  validation/         zod schemas shared by the API, the console and the docs
  ui-tokens/          the single source of the visual identity → TS, CSS and Dart
  config/             base tsconfig + eslint
docs/                 ARCHITECTURE · DATABASE · API · SECURITY · TESTING · DEPLOYMENT · OPERATIONS · STATUS
infrastructure/       docker compose, Dockerfiles, CI
scripts/              setup, token/contract generation, migrations, backup, load test
```

## Principles the code holds to

* **One vocabulary.** Enums, permissions, the job state machine and the design tokens live in
  `packages/` and are *generated* into the Flutter apps. No client hand-copies a value.
* **The server owns money.** Every price, fee and payout is computed server-side in integer minor
  units and frozen into an immutable pricing snapshot. Clients display; they never calculate.
* **Double-entry or nothing.** Balances are derived from an append-only ledger whose immutability
  is enforced by database triggers, not by convention.
* **Permissions, not roles.** Route guards check permissions; services additionally check
  ownership and answer `404` — not `403` — to callers with no relationship to a resource.
* **No prototypes.** No mock APIs, no stubbed screens, no `TODO`.

## Quick start

Requires a network-enabled environment. See `docs/STATUS.md` §3 for the full sequence.

```bash
pnpm install && pnpm tokens:generate
pnpm --filter @tamam/shared-types --filter @tamam/validation build
bash scripts/db/create-init-migration.sh
pnpm db:migrate:dev && pnpm db:seed
pnpm dev                    # API on :3000, admin console on :3001
```

## Identity

Purple `#5D3EBC`, yellow `#FFD300`, white rounded cards on a light grey canvas, Cairo/Inter —
defined once in `packages/ui-tokens/tokens.json` and consumed by all four applications, including
the in-app promotional banner system (admin-managed campaigns with targeting, scheduling and
impression/click/conversion analytics).
