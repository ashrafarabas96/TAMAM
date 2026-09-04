# TAMAM Admin console (`@tamam/admin-web`)

Next.js 14 (App Router) operations console for the TAMAM platform: live map, dispatcher console,
job engine, catalog, zones, pricing, promotions, promotional campaigns, finance, support, disputes,
risk, configuration, staff/RBAC and the audit log.

Arabic is the default locale and the UI is RTL-first; English is a one-click toggle.

## Quick start

```bash
pnpm install                       # from the repository root
pnpm --filter @tamam/ui-tokens generate
pnpm --filter @tamam/shared-types --filter @tamam/validation build
cp apps/admin-web/.env.example apps/admin-web/.env.local   # then fill SESSION_SECRET
pnpm --filter @tamam/admin-web dev                          # http://localhost:3001
```

| Script                                     | What it does                                                      |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `pnpm --filter @tamam/admin-web dev`       | Dev server on port 3001                                           |
| `pnpm --filter @tamam/admin-web build`     | Production build (`output: 'standalone'`, used by the Dockerfile) |
| `pnpm --filter @tamam/admin-web typecheck` | `tsc --noEmit`                                                    |
| `pnpm --filter @tamam/admin-web lint`      | `next lint`, zero warnings tolerated                              |
| `pnpm --filter @tamam/admin-web test`      | Vitest (jsdom)                                                    |

### Environment

| Variable                     | Scope   | Purpose                                                                 |
| ---------------------------- | ------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`   | browser | REST base, including `/api/v1`                                          |
| `NEXT_PUBLIC_WS_BASE_URL`    | browser | Socket.IO origin (the client appends the `/admin` namespace)            |
| `NEXT_PUBLIC_MAP_STYLE_URL`  | browser | MapLibre style JSON                                                     |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | browser | `ar` (default) or `en`                                                  |
| `API_INTERNAL_BASE_URL`      | server  | API origin reachable from the Next.js server (may differ inside Docker) |
| `SESSION_SECRET`             | server  | ≥ 32 chars; derives the AES-256-GCM key of the session cookie           |
| `SESSION_COOKIE_SECURE`      | server  | `true` behind TLS                                                       |

## Authentication & session handling

The refresh token never reaches the browser.

1. `POST /api/session` (route handler) proxies `POST /auth/admin/login`, then seals
   `{ userId, deviceId, accessToken, refreshToken, expiries }` into an **encrypted JWE cookie**
   (`jose`, `dir` + `A256GCM`) that is `httpOnly`, `sameSite=lax` and `secure` in production.
2. `middleware.ts` decrypts that cookie on every `(console)` request; a missing or expired session
   redirects to `/login?next=…`, and an authenticated visit to `/login` bounces to `/dashboard`.
3. The browser calls `GET /api/session/token` to obtain the **short-lived access token only**, kept
   in memory (`src/lib/auth/token-store.ts`), never in `localStorage`.
4. On a 401 the API client calls the same route with `?force=1`; the server rotates the refresh
   token against `POST /auth/refresh`, re-seals the cookie and returns a fresh access token. The
   client refreshes **single-flight**: many parallel 401s trigger exactly one rotation, then each
   request is retried once (rotating refresh tokens make a double refresh a family-reuse event, so
   refreshes are also serialised per user inside the route handler).
5. `DELETE /api/session` calls `POST /auth/logout` and clears the cookie.

Permissions — never roles — gate the UI: `src/lib/auth/permissions.ts` resolves the effective set
(`SUPER_ADMIN` implicitly holds everything), `RequirePermission` guards a page and `Can` guards a
button. Navigation entries in `src/components/layout/nav.ts` declare the same permissions, so the
sidebar only shows what the account can actually open. The API remains the authority: the console
never assumes an action will succeed because a button is visible.

## Conventions

- **API client** (`src/lib/api/client.ts`) — base URL, bearer, `X-Request-Id`, `Accept-Language`,
  `X-Timezone`, optional `Idempotency-Key`, and a typed `ApiError { code, message, details, requestId }`.
  Endpoint wrappers live in `src/lib/api/endpoints/*` and use the exact routes from `docs/API.md`.
- **Pagination** — every list uses keyset pagination through `useCursorList` (`{ items, nextCursor }`)
  and a "load more" footer.
- **Money** — integer minor units end-to-end; `formatMoney` renders through `Intl` with the right
  fraction digits per currency (ILS/USD 2, JOD 3) and Latin digits in Arabic.
- **Time** — everything is rendered in `Asia/Jerusalem`; `datetime-local` inputs are converted to
  ISO-8601 UTC with DST-correct offsets before they reach the API.
- **Forms** — `react-hook-form` + `zodResolver` with the shared schemas from `@tamam/validation`;
  server-side field errors are pushed back onto the form by `applyApiFieldErrors`.
- **Mutations** — confirm dialog (with a reason where the API audits one) → toast → query invalidation.
- **Design tokens** — Tailwind reads its colours from the CSS variables generated by
  `@tamam/ui-tokens`; no colour literal exists in the app code. Chart palettes are validated for
  colour-vision separation in both themes.
- **i18n** — `src/i18n/{ar,en}.ts` are typed dictionaries: `TranslationKey` is derived from the
  English dictionary and the Arabic one is typed `Dictionary`, so a missing key fails the build.

## Real time

`src/lib/socket/admin-socket.ts` connects to the `/admin` Socket.IO namespace with the current access
token, emits `admin:map:subscribe { zoneId? }` and consumes `admin:map:update` and `admin:metrics`
(pushed every 15 s). The dashboard prefers the live metrics payload and falls back to polling
`GET /admin/overview`; the live map merges socket updates over the `GET /admin/live-map` snapshot.

## Directory map

```
src/
├── app/
│   ├── (auth)/login            email + password sign-in
│   ├── (console)/…             every operations screen (see the table below)
│   └── api/session/…           login proxy + access-token exchange (server only)
├── components/
│   ├── ui/                     design-system primitives (button, table, dialog, form fields…)
│   ├── layout/                 shell, sidebar, top bar, global search, permission gates
│   ├── charts/                 Recharts wrappers + token-driven palette
│   └── domain/                 feature widgets (map, dispatch, campaigns, catalog, zones…)
├── i18n/                       ar + en dictionaries and the provider
└── lib/                        api client, auth/session, formatters, query keys, socket, theme
```

## Testing

`pnpm --filter @tamam/admin-web test` runs Vitest with jsdom:

- money and date/timezone formatting (including DST and minor-unit conversion),
- the permissions helper,
- the API client (headers, query serialisation, typed errors and the single-flight refresh),
- the campaign form schema (targeting, action types, per-placement metadata),
- the `DataTable` component (loading, empty, error+retry, load-more, keyboard row activation).
