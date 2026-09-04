# TAMAM — API reference

> Route table generated from the NestJS controllers in `apps/api/src/modules/**/*.controller.ts`.
> Regenerate after adding or renaming a route — the table is part of the review checklist.

## Conventions

- **Base URL** — every route below is prefixed with `/api/v1` (`API_PREFIX` in
  `@tamam/shared-types`). Only `/health/live`, `/health/ready` and `/metrics` sit outside the prefix.
- **Interactive documentation** — Swagger UI is served at `GET /docs` in every environment except
  production (`main.ts` mounts it only when `NODE_ENV !== 'production'`).
- **Authentication** — `Authorization: Bearer <access token>`. Access tokens are short-lived
  (`auth.access_ttl_s`, default 15 min); refresh with `POST /auth/refresh`.
  Customers and partners authenticate with a phone OTP, staff with email + password.
- **Authorization** — the guard chain is `RateLimitGuard → JwtAuthGuard → AccountStatusGuard →
PermissionsGuard`. The table shows the _route-level_ gate; object-level checks (is this your
  job?) always happen inside the service and answer **404** rather than 403 when the caller has no
  relationship to the resource (spec §88).
- **Errors** — every failure is `{ code, message, details?, requestId }` with `code` from
  `ErrorCode`. Clients translate by `code`; `message` is developer-facing English.
- **Pagination** — list endpoints are keyset-paginated: `?cursor=<opaque>&limit=<1..100>` and
  respond `{ items, nextCursor }`.
- **Money** — always `{ amount, currency }` where `amount` is an **integer in minor units**
  (agorot for ILS). Never a float, never a string.
- **Idempotency** — routes marked _Idempotency-Key_ require that header (8–128 chars). Replays
  return the first response with `Idempotent-Replayed: true`.
- **Headers** — `X-Request-Id` (echoed), `X-Device-Id`, `X-App-Version`, `Accept-Language`
  (`ar` default, `en` supported), `X-Timezone`.
- **Rate limits** — the _Notes_ column shows `requests/window-seconds`; exceeding one returns
  `429` with `RATE_LIMITED` and `Retry-After`.
- **restricted-ok** — the route stays reachable for accounts in the `RESTRICTED` state.

## WebSocket namespaces

Socket.IO, same host, handshake auth `{ auth: { token: '<access token>' } }`.

| Namespace   | Who                                 | Client → server                                        | Server → client                                                           |
| ----------- | ----------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `/tracking` | customers, partners, staff          | `partner:location`, `job:subscribe`, `job:unsubscribe` | `job:location`, `job:status`, `job:eta`, `job:offer`, `job:offer:expired` |
| `/chat`     | job participants                    | `chat:send`, `chat:read`                               | `chat:message`, `chat:delivery`                                           |
| `/admin`    | staff with `tracking.view_live_map` | `admin:map:subscribe` `{ zoneId? }`                    | `admin:map:update`, `admin:metrics` (every 15 s)                          |

Rooms: `job:<jobId>`, `user:<userId>`, `admin:zone:<zoneId>`, `admin:all`.

## Routes by module

### `admin`

| Method | Path                                           | Auth / permission                                                                                           | Notes                                            |
| ------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| GET    | `/api/v1/admin/overview`                       | `ANALYTICS_READ`                                                                                            | —                                                |
| GET    | `/api/v1/admin/search`                         | any of `JOBS_READ_ALL`, `CUSTOMERS_READ`, `PARTNERS_READ`, `PAYMENTS_READ`, `SUPPORT_READ`, `DISPUTES_READ` | rate 120/60s                                     |
| GET    | `/api/v1/admin/dispatch/console`               | `JOBS_READ_ALL`                                                                                             | —                                                |
| GET    | `/api/v1/admin/dispatch/partners/:id/timeline` | `JOBS_READ_ALL`                                                                                             | —                                                |
| GET    | `/api/v1/admin/staff`                          | `ADMIN_USERS_MANAGE`                                                                                        | —                                                |
| GET    | `/api/v1/admin/staff/:id`                      | `ADMIN_USERS_MANAGE`                                                                                        | —                                                |
| POST   | `/api/v1/admin/staff`                          | `ADMIN_USERS_MANAGE`                                                                                        | audit `admin_user.create`                        |
| PATCH  | `/api/v1/admin/staff/:id/roles`                | `ROLES_MANAGE`                                                                                              | audit `admin_user.roles_update`                  |
| POST   | `/api/v1/admin/staff/:id/reset-password`       | `ADMIN_USERS_MANAGE`                                                                                        | audit `admin_user.password_reset`, rate 10/3600s |
| POST   | `/api/v1/admin/staff/:id/status`               | `ADMIN_USERS_MANAGE`                                                                                        | audit `admin_user.status`                        |

### `analytics`

| Method | Path                       | Auth / permission | Notes        |
| ------ | -------------------------- | ----------------- | ------------ |
| POST   | `/api/v1/analytics/events` | **public**        | rate 120/60s |
| GET    | `/api/v1/admin/dashboard`  | `ANALYTICS_READ`  | —            |
| GET    | `/api/v1/admin/kpis`       | `ANALYTICS_READ`  | —            |
| GET    | `/api/v1/admin/reports`    | `ANALYTICS_READ`  | —            |

### `audit`

| Method | Path                       | Auth / permission | Notes |
| ------ | -------------------------- | ----------------- | ----- |
| GET    | `/api/v1/admin/audit-logs` | `AUDIT_READ`      | —     |

### `auth`

| Method | Path                                 | Auth / permission | Notes         |
| ------ | ------------------------------------ | ----------------- | ------------- |
| POST   | `/api/v1/auth/otp/request`           | **public**        | rate 5/600s   |
| POST   | `/api/v1/auth/otp/verify`            | **public**        | rate 10/600s  |
| POST   | `/api/v1/auth/refresh`               | **public**        | rate 30/600s  |
| POST   | `/api/v1/auth/logout`                | authenticated     | restricted-ok |
| POST   | `/api/v1/auth/admin/login`           | **public**        | rate 10/900s  |
| POST   | `/api/v1/auth/admin/change-password` | authenticated     | —             |

### `campaigns`

| Method | Path                                 | Auth / permission  | Notes                   |
| ------ | ------------------------------------ | ------------------ | ----------------------- |
| GET    | `/api/v1/banners/feed`               | **public**         | rate 60/60s             |
| POST   | `/api/v1/banners/events`             | **public**         | rate 120/60s            |
| GET    | `/api/v1/admin/campaigns`            | `CAMPAIGNS_READ`   | —                       |
| GET    | `/api/v1/admin/campaigns/:id`        | `CAMPAIGNS_READ`   | —                       |
| POST   | `/api/v1/admin/campaigns`            | `CAMPAIGNS_MANAGE` | audit `campaign.create` |
| PUT    | `/api/v1/admin/campaigns/:id`        | `CAMPAIGNS_MANAGE` | audit `campaign.update` |
| POST   | `/api/v1/admin/campaigns/:id/status` | `CAMPAIGNS_MANAGE` | —                       |
| GET    | `/api/v1/admin/campaigns/:id/stats`  | `CAMPAIGNS_READ`   | —                       |
| POST   | `/api/v1/admin/campaigns/preview`    | `CAMPAIGNS_READ`   | —                       |

### `catalog`

| Method | Path                                           | Auth / permission | Notes         |
| ------ | ---------------------------------------------- | ----------------- | ------------- |
| GET    | `/api/v1/catalog/service-types`                | **public**        | —             |
| GET    | `/api/v1/catalog/categories`                   | **public**        | —             |
| GET    | `/api/v1/catalog/categories/:id`               | **public**        | —             |
| GET    | `/api/v1/catalog/vehicle-types`                | **public**        | —             |
| GET    | `/api/v1/catalog/package-categories`           | **public**        | —             |
| GET    | `/api/v1/catalog/search`                       | **public**        | restricted-ok |
| GET    | `/api/v1/admin/catalog/categories`             | `SERVICES_READ`   | —             |
| POST   | `/api/v1/admin/catalog/categories`             | `SERVICES_MANAGE` | —             |
| PUT    | `/api/v1/admin/catalog/categories/:id`         | `SERVICES_MANAGE` | —             |
| POST   | `/api/v1/admin/catalog/subcategories`          | `SERVICES_MANAGE` | —             |
| PUT    | `/api/v1/admin/catalog/subcategories/:id`      | `SERVICES_MANAGE` | —             |
| POST   | `/api/v1/admin/catalog/options`                | `SERVICES_MANAGE` | —             |
| PUT    | `/api/v1/admin/catalog/options/:id`            | `SERVICES_MANAGE` | —             |
| GET    | `/api/v1/admin/catalog/vehicle-types`          | `SERVICES_READ`   | —             |
| POST   | `/api/v1/admin/catalog/vehicle-types`          | `SERVICES_MANAGE` | —             |
| PUT    | `/api/v1/admin/catalog/vehicle-types/:id`      | `SERVICES_MANAGE` | —             |
| GET    | `/api/v1/admin/catalog/package-categories`     | `SERVICES_READ`   | —             |
| POST   | `/api/v1/admin/catalog/package-categories`     | `SERVICES_MANAGE` | —             |
| PUT    | `/api/v1/admin/catalog/package-categories/:id` | `SERVICES_MANAGE` | —             |

### `chat`

| Method | Path                             | Auth / permission | Notes         |
| ------ | -------------------------------- | ----------------- | ------------- |
| GET    | `/api/v1/jobs/:id/chat/messages` | authenticated     | restricted-ok |
| POST   | `/api/v1/jobs/:id/chat/messages` | authenticated     | restricted-ok |
| POST   | `/api/v1/jobs/:id/chat/read`     | authenticated     | restricted-ok |

### `config`

| Method | Path                               | Auth / permission      | Notes |
| ------ | ---------------------------------- | ---------------------- | ----- |
| GET    | `/api/v1/config/feature-flags`     | **public**             | —     |
| GET    | `/api/v1/admin/config`             | `CONFIG_READ`          | —     |
| PATCH  | `/api/v1/admin/config`             | `CONFIG_MANAGE`        | —     |
| GET    | `/api/v1/admin/feature-flags`      | `CONFIG_READ`          | —     |
| PATCH  | `/api/v1/admin/feature-flags/:key` | `FEATURE_FLAGS_MANAGE` | —     |

### `customers`

| Method | Path                                         | Auth / permission | Notes         |
| ------ | -------------------------------------------- | ----------------- | ------------- |
| GET    | `/api/v1/customers/me`                       | authenticated     | restricted-ok |
| GET    | `/api/v1/customers/me/places`                | authenticated     | restricted-ok |
| POST   | `/api/v1/customers/me/places`                | authenticated     | —             |
| PUT    | `/api/v1/customers/me/places/:id`            | authenticated     | —             |
| DELETE | `/api/v1/customers/me/places/:id`            | authenticated     | —             |
| GET    | `/api/v1/customers/me/favorites`             | authenticated     | restricted-ok |
| POST   | `/api/v1/customers/me/favorites`             | authenticated     | —             |
| DELETE | `/api/v1/customers/me/favorites/:categoryId` | authenticated     | —             |
| GET    | `/api/v1/customers/me/recent-services`       | authenticated     | restricted-ok |
| GET    | `/api/v1/customers/me/jobs`                  | authenticated     | restricted-ok |
| GET    | `/api/v1/customers/me/jobs/:id`              | authenticated     | restricted-ok |
| POST   | `/api/v1/customers/me/reorder`               | authenticated     | —             |

### `dispatch`

| Method | Path                                     | Auth / permission        | Notes                          |
| ------ | ---------------------------------------- | ------------------------ | ------------------------------ |
| GET    | `/api/v1/partners/me/offers`             | role `PARTNER`           | —                              |
| POST   | `/api/v1/partners/me/offers/respond`     | role `PARTNER`           | —                              |
| POST   | `/api/v1/jobs/:id/release`               | role `PARTNER`           | —                              |
| POST   | `/api/v1/jobs/:id/retry-dispatch`        | role `CUSTOMER`          | —                              |
| GET    | `/api/v1/admin/dispatch/nearby-partners` | `DISPATCH_MANUAL_ASSIGN` | —                              |
| GET    | `/api/v1/admin/jobs/:id/assignments`     | `JOBS_READ_ALL`          | —                              |
| POST   | `/api/v1/admin/jobs/:id/assign`          | `DISPATCH_MANUAL_ASSIGN` | audit `dispatch.manual_assign` |
| POST   | `/api/v1/admin/jobs/:id/redispatch`      | `DISPATCH_REASSIGN`      | audit `dispatch.redispatch`    |

### `disputes`

| Method | Path                                  | Auth / permission | Notes                                   |
| ------ | ------------------------------------- | ----------------- | --------------------------------------- |
| POST   | `/api/v1/disputes`                    | authenticated     | rate 5/3600s                            |
| GET    | `/api/v1/disputes`                    | authenticated     | restricted-ok                           |
| GET    | `/api/v1/disputes/:id`                | authenticated     | restricted-ok                           |
| POST   | `/api/v1/disputes/:id/messages`       | authenticated     | —                                       |
| POST   | `/api/v1/disputes/:id/evidence`       | authenticated     | —                                       |
| GET    | `/api/v1/admin/disputes`              | `DISPUTES_READ`   | —                                       |
| GET    | `/api/v1/admin/disputes/:id`          | `DISPUTES_READ`   | —                                       |
| POST   | `/api/v1/admin/disputes/:id/messages` | `DISPUTES_READ`   | —                                       |
| POST   | `/api/v1/admin/disputes/:id/decision` | `DISPUTES_DECIDE` | Idempotency-Key, audit `dispute.decide` |

### `health`

| Method | Path                   | Auth / permission | Notes |
| ------ | ---------------------- | ----------------- | ----- |
| GET    | `/api/v1/health/live`  | **public**        | —     |
| GET    | `/api/v1/health/ready` | **public**        | —     |
| GET    | `/api/v1/metrics`      | **public**        | —     |

### `jobs`

| Method | Path                                      | Auth / permission | Notes                         |
| ------ | ----------------------------------------- | ----------------- | ----------------------------- |
| POST   | `/api/v1/jobs`                            | role `CUSTOMER`   | Idempotency-Key, rate 10/600s |
| GET    | `/api/v1/jobs`                            | authenticated     | restricted-ok                 |
| GET    | `/api/v1/jobs/:id`                        | authenticated     | restricted-ok                 |
| GET    | `/api/v1/jobs/:id/timeline`               | authenticated     | restricted-ok                 |
| POST   | `/api/v1/jobs/:id/cancel`                 | authenticated     | —                             |
| POST   | `/api/v1/jobs/:id/confirm-work`           | role `CUSTOMER`   | —                             |
| POST   | `/api/v1/jobs/:id/share`                  | authenticated     | —                             |
| DELETE | `/api/v1/jobs/:id/share`                  | authenticated     | —                             |
| POST   | `/api/v1/jobs/:id/sos`                    | authenticated     | rate 5/600s                   |
| GET    | `/api/v1/track/:token`                    | **public**        | rate 120/60s                  |
| POST   | `/api/v1/jobs/:id/en-route`               | role `PARTNER`    | —                             |
| POST   | `/api/v1/jobs/:id/arrive`                 | role `PARTNER`    | —                             |
| POST   | `/api/v1/jobs/:id/start`                  | role `PARTNER`    | rate 10/300s                  |
| POST   | `/api/v1/jobs/:id/complete`               | role `PARTNER`    | rate 10/300s                  |
| POST   | `/api/v1/jobs/:id/work/start`             | role `PARTNER`    | —                             |
| POST   | `/api/v1/jobs/:id/work/waiting-for-parts` | role `PARTNER`    | —                             |
| POST   | `/api/v1/jobs/:id/work/resume`            | role `PARTNER`    | —                             |
| POST   | `/api/v1/jobs/:id/work/complete`          | role `PARTNER`    | —                             |
| GET    | `/api/v1/admin/jobs`                      | `JOBS_READ_ALL`   | —                             |
| GET    | `/api/v1/admin/jobs/:id`                  | `JOBS_READ_ALL`   | —                             |
| POST   | `/api/v1/admin/jobs/:id/transition`       | `JOBS_CANCEL`     | audit `job.admin_transition`  |
| GET    | `/api/v1/admin/sos`                       | `JOBS_READ_ALL`   | —                             |
| POST   | `/api/v1/admin/sos/:id/acknowledge`       | `JOBS_READ_ALL`   | —                             |
| POST   | `/api/v1/admin/sos/:id/resolve`           | `JOBS_READ_ALL`   | —                             |

### `ledger`

| Method | Path                                               | Auth / permission   | Notes                            |
| ------ | -------------------------------------------------- | ------------------- | -------------------------------- |
| GET    | `/api/v1/admin/ledger/accounts`                    | `LEDGER_READ`       | —                                |
| GET    | `/api/v1/admin/ledger/transactions`                | `LEDGER_READ`       | —                                |
| GET    | `/api/v1/admin/ledger/wallets/:walletId/statement` | `LEDGER_READ`       | —                                |
| POST   | `/api/v1/admin/ledger/wallets/:walletId/verify`    | `LEDGER_READ`       | —                                |
| GET    | `/api/v1/admin/commission-policies`                | `COMMISSION_MANAGE` | —                                |
| PUT    | `/api/v1/admin/commission-policies`                | `COMMISSION_MANAGE` | audit `commission_policy.upsert` |

### `maintenance`

| Method | Path                                 | Auth / permission | Notes                   |
| ------ | ------------------------------------ | ----------------- | ----------------------- |
| POST   | `/api/v1/admin/maintenance/run/:job` | `CONFIG_MANAGE`   | audit `maintenance.run` |
| GET    | `/api/v1/admin/maintenance/queues`   | `CONFIG_READ`     | —                       |

### `media`

| Method | Path                           | Auth / permission | Notes                       |
| ------ | ------------------------------ | ----------------- | --------------------------- |
| POST   | `/api/v1/media/upload-intents` | authenticated     | rate 60/600s, restricted-ok |
| POST   | `/api/v1/media/:id/confirm`    | authenticated     | restricted-ok               |
| GET    | `/api/v1/media/:key/view`      | authenticated     | restricted-ok               |

### `notifications`

| Method | Path                                    | Auth / permission               | Notes                                |
| ------ | --------------------------------------- | ------------------------------- | ------------------------------------ |
| GET    | `/api/v1/notifications`                 | authenticated                   | restricted-ok                        |
| GET    | `/api/v1/notifications/unread-count`    | authenticated                   | restricted-ok                        |
| POST   | `/api/v1/notifications/read`            | authenticated                   | restricted-ok                        |
| GET    | `/api/v1/notifications/preferences`     | authenticated                   | restricted-ok                        |
| PUT    | `/api/v1/notifications/preferences`     | authenticated                   | restricted-ok                        |
| GET    | `/api/v1/admin/notification-templates`  | `NOTIFICATION_TEMPLATES_MANAGE` | —                                    |
| PUT    | `/api/v1/admin/notification-templates`  | `NOTIFICATION_TEMPLATES_MANAGE` | audit `notification_template.upsert` |
| POST   | `/api/v1/admin/notifications/broadcast` | `NOTIFICATIONS_BROADCAST`       | audit `notification.broadcast`       |

### `partners`

| Method | Path                                                 | Auth / permission                             | Notes                           |
| ------ | ---------------------------------------------------- | --------------------------------------------- | ------------------------------- |
| POST   | `/api/v1/partners/onboarding/personal`               | role `PARTNER`                                | —                               |
| POST   | `/api/v1/partners/onboarding/roles`                  | role `PARTNER`                                | —                               |
| POST   | `/api/v1/partners/onboarding/skills`                 | role `PARTNER`                                | —                               |
| POST   | `/api/v1/partners/onboarding/documents`              | role `PARTNER`                                | —                               |
| POST   | `/api/v1/partners/onboarding/vehicle`                | role `PARTNER`                                | —                               |
| POST   | `/api/v1/partners/onboarding/zones`                  | role `PARTNER`                                | —                               |
| POST   | `/api/v1/partners/onboarding/submit`                 | role `PARTNER`                                | rate 5/3600s                    |
| GET    | `/api/v1/partners/me`                                | role `PARTNER`                                | restricted-ok                   |
| GET    | `/api/v1/partners/me/documents`                      | role `PARTNER`                                | restricted-ok                   |
| POST   | `/api/v1/partners/me/documents`                      | role `PARTNER`                                | —                               |
| GET    | `/api/v1/partners/me/availability`                   | role `PARTNER`                                | restricted-ok                   |
| PUT    | `/api/v1/partners/me/availability`                   | role `PARTNER`                                | —                               |
| POST   | `/api/v1/partners/me/heartbeat`                      | role `PARTNER`                                | rate 120/60s                    |
| GET    | `/api/v1/partners/me/jobs`                           | role `PARTNER`                                | restricted-ok                   |
| GET    | `/api/v1/partners/me/bank-accounts`                  | role `PARTNER`                                | restricted-ok                   |
| POST   | `/api/v1/partners/me/bank-accounts`                  | role `PARTNER`                                | —                               |
| GET    | `/api/v1/admin/partners`                             | `PARTNERS_READ`                               | —                               |
| GET    | `/api/v1/admin/partners/:id`                         | `PARTNERS_READ`                               | —                               |
| POST   | `/api/v1/admin/partners/:id/documents/:docId/review` | `PARTNERS_REVIEW_DOCUMENTS`                   | audit `partner_document.review` |
| POST   | `/api/v1/admin/partners/:id/decision`                | any of `PARTNERS_APPROVE`, `PARTNERS_SUSPEND` | audit `partner.decision`        |
| PATCH  | `/api/v1/admin/partners/:id`                         | `PARTNERS_MANAGE`                             | audit `partner.manage`          |

### `payments`

| Method | Path                                  | Auth / permission | Notes                                 |
| ------ | ------------------------------------- | ----------------- | ------------------------------------- |
| GET    | `/api/v1/jobs/:id/payment`            | authenticated     | —                                     |
| POST   | `/api/v1/payments/webhooks/:provider` | **public**        | rate 600/60s                          |
| GET    | `/api/v1/admin/payments`              | `PAYMENTS_READ`   | —                                     |
| GET    | `/api/v1/admin/payments/:id`          | `PAYMENTS_READ`   | —                                     |
| POST   | `/api/v1/admin/refunds`               | `REFUNDS_ISSUE`   | Idempotency-Key, audit `refund.issue` |
| GET    | `/api/v1/admin/refunds`               | `PAYMENTS_READ`   | —                                     |

### `pricing`

| Method | Path                                              | Auth / permission | Notes        |
| ------ | ------------------------------------------------- | ----------------- | ------------ |
| POST   | `/api/v1/estimates/ride`                          | role `CUSTOMER`   | rate 60/300s |
| POST   | `/api/v1/estimates/delivery`                      | role `CUSTOMER`   | rate 60/300s |
| POST   | `/api/v1/estimates/service`                       | role `CUSTOMER`   | rate 60/300s |
| GET    | `/api/v1/admin/pricing/rules`                     | `PRICING_READ`    | —            |
| POST   | `/api/v1/admin/pricing/rules`                     | `PRICING_MANAGE`  | —            |
| PUT    | `/api/v1/admin/pricing/rules/:id`                 | `PRICING_MANAGE`  | —            |
| GET    | `/api/v1/admin/pricing/surge`                     | `PRICING_READ`    | —            |
| POST   | `/api/v1/admin/pricing/surge`                     | `PRICING_MANAGE`  | —            |
| DELETE | `/api/v1/admin/pricing/surge/:id`                 | `PRICING_MANAGE`  | —            |
| GET    | `/api/v1/admin/pricing/cancellation-policies`     | `PRICING_READ`    | —            |
| POST   | `/api/v1/admin/pricing/cancellation-policies`     | `PRICING_MANAGE`  | —            |
| PUT    | `/api/v1/admin/pricing/cancellation-policies/:id` | `PRICING_MANAGE`  | —            |

### `promotions`

| Method | Path                                  | Auth / permission  | Notes                           |
| ------ | ------------------------------------- | ------------------ | ------------------------------- |
| POST   | `/api/v1/promos/validate`             | role `CUSTOMER`    | rate 30/300s                    |
| GET    | `/api/v1/referrals/me`                | role `CUSTOMER`    | restricted-ok                   |
| GET    | `/api/v1/admin/promo-codes`           | `PROMOS_MANAGE`    | —                               |
| POST   | `/api/v1/admin/promo-codes`           | `PROMOS_MANAGE`    | audit `promo_code.create`       |
| PUT    | `/api/v1/admin/promo-codes/:id`       | `PROMOS_MANAGE`    | audit `promo_code.update`       |
| GET    | `/api/v1/admin/promo-codes/:id/stats` | `PROMOS_MANAGE`    | —                               |
| GET    | `/api/v1/admin/referral-program`      | `REFERRALS_MANAGE` | —                               |
| PUT    | `/api/v1/admin/referral-program`      | `REFERRALS_MANAGE` | audit `referral_program.update` |
| GET    | `/api/v1/admin/referral-rewards`      | `REFERRALS_MANAGE` | —                               |

### `quotes`

| Method | Path                                            | Auth / permission | Notes         |
| ------ | ----------------------------------------------- | ----------------- | ------------- |
| GET    | `/api/v1/jobs/:id/quotes`                       | authenticated     | restricted-ok |
| POST   | `/api/v1/jobs/:id/quotes`                       | role `PARTNER`    | —             |
| POST   | `/api/v1/jobs/:id/quotes/decision`              | authenticated     | —             |
| POST   | `/api/v1/jobs/:id/quotes/close-inspection-only` | role `CUSTOMER`   | —             |

### `ratings`

| Method | Path                              | Auth / permission                        | Notes         |
| ------ | --------------------------------- | ---------------------------------------- | ------------- |
| POST   | `/api/v1/jobs/:id/rating`         | authenticated                            | —             |
| GET    | `/api/v1/jobs/:id/rating`         | authenticated                            | restricted-ok |
| GET    | `/api/v1/partners/me/reviews`     | role `PARTNER`                           | restricted-ok |
| GET    | `/api/v1/admin/users/:id/reviews` | any of `CUSTOMERS_READ`, `PARTNERS_READ` | —             |

### `rbac`

| Method | Path                             | Auth / permission | Notes |
| ------ | -------------------------------- | ----------------- | ----- |
| GET    | `/api/v1/admin/rbac/roles`       | `ROLES_MANAGE`    | —     |
| GET    | `/api/v1/admin/rbac/permissions` | `ROLES_MANAGE`    | —     |
| PUT    | `/api/v1/admin/rbac/roles`       | `ROLES_MANAGE`    | —     |

### `risk`

| Method | Path                                       | Auth / permission | Notes                      |
| ------ | ------------------------------------------ | ----------------- | -------------------------- |
| GET    | `/api/v1/admin/risk/signals`               | `RISK_READ`       | —                          |
| POST   | `/api/v1/admin/risk/signals/:id/review`    | `RISK_MANAGE`     | audit `risk.signal.review` |
| GET    | `/api/v1/admin/risk/restrictions`          | `RISK_READ`       | —                          |
| POST   | `/api/v1/admin/risk/restrictions`          | `RISK_MANAGE`     | —                          |
| POST   | `/api/v1/admin/risk/restrictions/:id/lift` | `RISK_MANAGE`     | —                          |

### `support`

| Method | Path                                         | Auth / permission | Notes                         |
| ------ | -------------------------------------------- | ----------------- | ----------------------------- |
| POST   | `/api/v1/support/tickets`                    | authenticated     | rate 10/3600s, restricted-ok  |
| GET    | `/api/v1/support/tickets`                    | authenticated     | restricted-ok                 |
| GET    | `/api/v1/support/tickets/:id`                | authenticated     | restricted-ok                 |
| POST   | `/api/v1/support/tickets/:id/messages`       | authenticated     | rate 60/3600s, restricted-ok  |
| POST   | `/api/v1/support/reports`                    | authenticated     | rate 10/3600s, restricted-ok  |
| GET    | `/api/v1/admin/support/tickets`              | `SUPPORT_READ`    | —                             |
| GET    | `/api/v1/admin/support/tickets/:id`          | `SUPPORT_READ`    | —                             |
| PATCH  | `/api/v1/admin/support/tickets/:id`          | `SUPPORT_MANAGE`  | audit `support_ticket.update` |
| POST   | `/api/v1/admin/support/tickets/:id/messages` | `SUPPORT_MANAGE`  | —                             |
| GET    | `/api/v1/admin/support/reports`              | `SUPPORT_READ`    | —                             |

### `tracking`

| Method | Path                           | Auth / permission        | Notes         |
| ------ | ------------------------------ | ------------------------ | ------------- |
| POST   | `/api/v1/partners/me/location` | role `PARTNER`           | rate 120/60s  |
| GET    | `/api/v1/jobs/:id/location`    | authenticated            | restricted-ok |
| GET    | `/api/v1/jobs/:id/path`        | authenticated            | restricted-ok |
| GET    | `/api/v1/admin/live-map`       | `TRACKING_VIEW_LIVE_MAP` | —             |

### `users`

| Method | Path                             | Auth / permission   | Notes               |
| ------ | -------------------------------- | ------------------- | ------------------- |
| GET    | `/api/v1/me`                     | authenticated       | restricted-ok       |
| PATCH  | `/api/v1/me`                     | authenticated       | restricted-ok       |
| POST   | `/api/v1/me/push-token`          | authenticated       | restricted-ok       |
| GET    | `/api/v1/me/sessions`            | authenticated       | restricted-ok       |
| DELETE | `/api/v1/me/sessions/:id`        | authenticated       | restricted-ok       |
| GET    | `/api/v1/admin/customers`        | `CUSTOMERS_READ`    | —                   |
| GET    | `/api/v1/admin/users/:id`        | `CUSTOMERS_READ`    | —                   |
| POST   | `/api/v1/admin/users/:id/status` | `CUSTOMERS_SUSPEND` | audit `user.status` |

### `vehicles`

| Method | Path                                                 | Auth / permission           | Notes                           |
| ------ | ---------------------------------------------------- | --------------------------- | ------------------------------- |
| GET    | `/api/v1/partners/me/vehicles`                       | role `PARTNER`              | restricted-ok                   |
| GET    | `/api/v1/partners/me/vehicles/:id`                   | role `PARTNER`              | restricted-ok                   |
| POST   | `/api/v1/partners/me/vehicles`                       | role `PARTNER`              | —                               |
| PUT    | `/api/v1/partners/me/vehicles/:id`                   | role `PARTNER`              | —                               |
| POST   | `/api/v1/partners/me/vehicles/:id/activate`          | role `PARTNER`              | —                               |
| GET    | `/api/v1/partners/me/vehicles/:id/documents`         | role `PARTNER`              | restricted-ok                   |
| POST   | `/api/v1/partners/me/vehicles/:id/documents`         | role `PARTNER`              | —                               |
| GET    | `/api/v1/admin/vehicles`                             | `PARTNERS_READ`             | —                               |
| GET    | `/api/v1/admin/vehicles/:id`                         | `PARTNERS_READ`             | —                               |
| POST   | `/api/v1/admin/vehicles/:id/review`                  | `PARTNERS_REVIEW_DOCUMENTS` | audit `vehicle.review`          |
| POST   | `/api/v1/admin/vehicles/:id/documents/:docId/review` | `PARTNERS_REVIEW_DOCUMENTS` | audit `vehicle_document.review` |

### `wallet`

| Method | Path                                     | Auth / permission    | Notes                          |
| ------ | ---------------------------------------- | -------------------- | ------------------------------ |
| GET    | `/api/v1/wallet`                         | authenticated        | restricted-ok                  |
| GET    | `/api/v1/wallet/statement`               | authenticated        | restricted-ok                  |
| POST   | `/api/v1/wallet/top-up`                  | authenticated        | Idempotency-Key, rate 10/3600s |
| POST   | `/api/v1/wallet/withdrawals`             | role `PARTNER`       | Idempotency-Key, rate 10/3600s |
| GET    | `/api/v1/wallet/withdrawals`             | role `PARTNER`       | restricted-ok                  |
| GET    | `/api/v1/partners/me/earnings`           | role `PARTNER`       | restricted-ok                  |
| POST   | `/api/v1/admin/wallets/adjust`           | `WALLET_ADJUST`      | audit `wallet.adjust`          |
| GET    | `/api/v1/admin/withdrawals`              | `WITHDRAWALS_MANAGE` | —                              |
| POST   | `/api/v1/admin/withdrawals/:id/decision` | `WITHDRAWALS_MANAGE` | audit `withdrawal.decision`    |

### `zones`

| Method | Path                            | Auth / permission | Notes             |
| ------ | ------------------------------- | ----------------- | ----------------- |
| GET    | `/api/v1/zones`                 | **public**        | —                 |
| GET    | `/api/v1/zones/resolve`         | **public**        | restricted-ok     |
| GET    | `/api/v1/admin/zones`           | `ZONES_READ`      | —                 |
| GET    | `/api/v1/admin/zones/:id`       | `ZONES_READ`      | —                 |
| POST   | `/api/v1/admin/zones`           | `ZONES_MANAGE`    | —                 |
| PUT    | `/api/v1/admin/zones/:id`       | `ZONES_MANAGE`    | —                 |
| GET    | `/api/v1/admin/zones/:id/rules` | `ZONES_READ`      | —                 |
| PUT    | `/api/v1/admin/zones/rules`     | `ZONES_MANAGE`    | audit `zone.rule` |

<!-- total routes: 246 -->
