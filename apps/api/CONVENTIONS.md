# TAMAM API — Engineering Conventions (read before writing any module)

These rules are binding for every module in `apps/api/src/modules`. They exist so 25+ modules written by different hands compile and behave as one system.

## 1. Stack facts

* NestJS 10, TypeScript strict (`noUncheckedIndexedAccess` on — index access returns `T | undefined`).
* Prisma 5 client generated from `prisma/schema.prisma`. **Read the schema before touching a table** — column names are camelCase in the client (`estimatedTotalMinor`), snake_case in SQL.
* Money columns are `BigInt` in the Prisma client. Use helpers from `src/common/utils/money.ts` (`percentOf`, `multiply`, `roundDiv`, `toMoney`). Never use floats for money.
* Geo columns (`location`, `area`) are `Unsupported` → they never appear in the Prisma client; write `lat`/`lng` (Decimal) and the DB trigger fills the geography. Query geo with `prisma.$queryRaw` (see `PrismaService.zoneIdForPoint`).
* Path alias `@/` → `src/`. Prefer relative imports inside a module, `@/` across modules is acceptable.
* Enums/DTOs/permissions come from `@tamam/shared-types`; request schemas come from `@tamam/validation` (zod). Never re-declare them.

## 2. Module layout

```
modules/<name>/
  <name>.module.ts          // @Module; export services other modules need
  <name>.controller.ts      // thin: decorators + validation + call service + return DTO
  <name>.service.ts         // application logic, transactions, events
  domain/*.ts               // pure functions/classes (no Nest, no Prisma) — unit-test these
  <name>.processor.ts       // BullMQ worker (only if the module owns a queue)
  <name>.gateway.ts         // Socket.IO gateway (only tracking/chat/admin)
  <name>.service.spec.ts    // jest unit tests for domain + service logic (mock Prisma)
```

## 3. Controllers

* Global guards run in order: `RateLimitGuard → JwtAuthGuard → AccountStatusGuard → PermissionsGuard`. Every route is authenticated unless decorated `@Public()`.
* Validate with `@ZodBody(schema)`, `@ZodQuery(schema)`, `@ZodParams(schema)`; path ids with `@Param('id', UuidPipe)`.
* Authorization: `@RequirePermission(Permission.X)` for staff routes; `@RequireRole('CUSTOMER')`/`('PARTNER')` for app routes; **object-level checks inside services** (`JobPolicy`, ownership queries) — never trust the id alone (spec §88).
* Restricted accounts: add `@AllowRestricted()` to read-only self endpoints.
* Sensitive POSTs: `@Idempotent('jobs.create')` requires the `Idempotency-Key` header (interceptor handles replay).
* Admin mutations: `@Audited({ action: 'partner.approve', entity: 'partner', entityIdFrom: 'id' })`, and pass `reason` in the body (zod schemas already require it for sensitive actions).
* Rate limits: `@RateLimit({ name, limit, windowSeconds, keyBy })` on abuse-prone endpoints.
* Principal: `@CurrentUser() user: RequestUser` (fields: `id, roles, permissions, accountStatus, sessionId, deviceId, language, partnerId?, customerId?, isSuperAdmin`). `@RequestId()`, `@ClientIp()`, `@UserAgent()`, `@AcceptLanguage()` also exist.
* Route prefixes: customer/partner app routes are plain (`/jobs`, `/partners/me/...`), staff routes start with `/admin/...`. Global prefix `/api/v1` is added in `main.ts`.
* Return DTO shapes from `@tamam/shared-types`. Map Prisma rows in a `toDto` function; never return raw Prisma objects (leaks columns). BigInt/Date/Decimal are serialised by `SerializeInterceptor`.

## 4. Errors

Throw `AppException` only (`src/common/errors/app.exception.ts`): `AppException.notFound('Job', id)`, `.forbidden()`, `.conflict(msg, ErrorCode.X)`, `.badRequest(ErrorCode.X, msg)`, `.validation([...])`, `.invalidTransition(from, to)`, `.versionConflict()`, `.featureDisabled(flag)`. Use codes from `ErrorCode` in shared-types. Never swallow errors (`catch {}` is forbidden — log with pino `Logger` from `nestjs-pino` and rethrow or convert).

## 5. Data access & transactions

* Inject `PrismaService`; for multi-step writes use `this.prisma.$transaction(async (tx) => { ... })` and pass `tx` to helpers (`type Tx`).
* Money-moving code uses `prisma.ledgerTransaction(tx => ...)` (sets the wallet trigger flag).
* Optimistic concurrency: jobs/payments/quotes carry `version`; update with `where: { id, version }` and throw `AppException.versionConflict()` when `count === 0`.
* Lists: keyset pagination via `decodeCursor/buildPage/cursorWhere` (`src/common/utils/cursor.ts`), `take: limit + 1`, order `[{ createdAt: 'desc' }, { id: 'desc' }]`.
* Never `deleteMany` operational data; use status flags / soft delete where the schema provides them.
* Encrypt PII with `encrypt/decrypt` (`src/common/utils/crypto.util.ts`, key from `AppConfigService.encryptionKey`); hash secrets with `hmacHash(value, config.env.OTP_PEPPER)`.

## 6. Cross-module contracts (implemented by their owners; import the service, don't re-implement)

| Need | Use |
| --- | --- |
| Config values / feature flags | `SystemConfigService.getNumber(CONFIG_KEYS.X)`, `.getBoolean`, `.isEnabled(FEATURE_FLAGS.X, { userId, zoneId })`, `.assertEnabled` |
| Audit entry | `AuditService.record({ actorId, action, entity, entityId, oldValue, newValue, reason, requestId }, tx?)` |
| Notification | `NotificationsService.notify({ userId, event: NotificationEvent.X, vars, data, jobId, priority, channels })` (async, queued) |
| Media validation / URLs | `MediaService.assertOwnedReady(userId, mediaIds, [MediaPurpose.X])`, `MediaUrlService.urlFor(ref, 'medium')`, `MediaService.toDto(row)` |
| Zone lookup | `ZonesService.resolveZoneForPoint(lat, lng)` → `{ id, currency, timezone } | null`, `ZonesService.assertServiceAvailable(zoneId, { serviceTypeId?, categoryId?, vehicleTypeId? }, at?)` |
| Catalog | `CatalogService.getCategory(id)`, `.getVehicleType(id)`, `.getPackageCategory(id)`, `.validateDynamicFields(category, values)` |
| Jobs | `JobsService.getForUser(jobId, user)` (policy-checked), `JobsService.transition(jobId, to, actor, opts)`; `JobPolicy.canView(user, job)`, `.canChat(user, job)`, `.canTrack(user, job)`, `.isAssignedPartner(user, job)` |
| Job events (domain events) | `EventEmitter2` names: `job.created`, `job.status_changed` (`{ jobId, from, to, actorType, actorId }`), `job.assigned`, `job.completed`, `job.cancelled`, `payment.captured`, `payment.failed`, `quote.submitted`, `quote.decided`, `partner.approved`, `banner.clicked` |
| Pricing | `PricingService.estimate*(…)`, `.finalizeFare(job, actuals)`, `.cancellationFee(job, actor)` |
| Ledger | `LedgerService.post({ type, currency, entries:[{accountCode|walletId, direction, amountMinor}], jobId?, reference, description, idempotencyKey, actorId? }, tx)`, `.settleJob(jobId)`, `.walletBalance(walletId)` |
| Wallet | `WalletService.getOrCreate(ownerType, ownerId, currency, tx?)` |
| Payments | `PaymentsService.createForJob(job, tx)`, `.captureForJob(jobId)`, `.refund(input, actor)` |
| Promotions | `PromotionsService.evaluate(code, ctx)` → discount; `.reserve(jobId, ...)`, `.release(jobId)` |
| Dispatch | `DispatchService.start(jobId)`, `.cancel(jobId, reason)`, `.manualAssign(jobId, partnerId, actor)` |
| Tracking | `TrackingService.latestPartnerLocation(partnerId)`, `TrackingGateway.emitJobStatus(job)` |
| Chat | `ChatService.ensureForJob(jobId, tx)`, `.close(jobId)` |
| Risk | `RiskService.assertCanCreateJob(userId, deviceId?)`, `.assertCanUsePromo(userId)`, `.assertCanUseWallet(userId)`, `.recordSignal(userId, signal, score, details?, jobId?)` |
| Metrics | `MetricsService.<counter>.inc(...)` |

Owners publish these exact signatures; if you must change one, change every caller.

## 7. Real-time

Gateways use namespaces from `WsNamespace` and event names from `WsEvent` (shared-types). Handshake auth: `socket.handshake.auth.token` (Bearer access token) validated by `TokenService.resolvePrincipal`. Rooms: `job:<jobId>`, `user:<userId>`, `admin:zone:<zoneId>`, `admin:all`.

## 8. Localisation

Never hard-code user-facing text in services: use notification templates (AR/EN) and `LocalizedText` DTO objects (`{ ar, en }`) built from `nameAr/nameEn` columns. Errors' `message` is developer-facing English; clients translate by `code`.

## 9. Tests

* `*.spec.ts` next to the code; Jest + ts-jest; mock `PrismaService` with plain objects/jest.fn. Domain classes must have tests (state machine, pricing math, scoring, promo evaluation, ledger balancing, banner targeting).
* Integration/E2E specs live in `apps/api/test/*.e2e-spec.ts` (run against Postgres+Redis from docker-compose).

## 10. Forbidden (spec §200)

`TODO`/`FIXME`/`HACK`/`TEMP` markers, mock data in production paths, hard-coded prices/permissions, `any`, unprotected admin routes, `console.log`, catching and ignoring errors, business logic in controllers.
