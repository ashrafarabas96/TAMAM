# TAMAM — Implementation Roadmap

The master prompt mandates 20 phases. This roadmap maps each phase to concrete deliverables, the modules involved and the gate that must pass before moving on (build → lint → typecheck → tests → docs → git checkpoint).

| # | Phase | Deliverables | Gate |
| --- | --- | --- | --- |
| 1 | Architecture + ERD + Repository + Infrastructure | `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `prisma/schema.prisma`, monorepo skeleton, `packages/*`, docker-compose, CI skeleton | schema validates; tokens generate |
| 2 | Auth + Users + RBAC | OTP login (SMS provider abstraction), admin email/password, JWT access + rotating refresh, device sessions, logout/revoke, roles/permissions, guards, audit writer | unit tests for token rotation & OTP limits; permission tests |
| 3 | Services + Zones + Partners + Vehicles | Catalog CRUD (admin) & public read, dynamic forms, PostGIS zones & rules, partner onboarding + documents + approval, vehicles & types | zone lookup tests; onboarding flow test |
| 4 | Universal Job Engine | `Job` creation per type, `JobStateMachine` with `JOB_TRANSITIONS`, job events, stops, media, PIN/OTP, cancellation policy, share links, SOS | state machine unit tests (every illegal transition rejected) |
| 5 | Pricing | Rule resolution, estimates (Redis TTL), snapshots, surge/urgency, promo application, final fare, cancellation fee, integer-money math | pricing unit tests with fixtures |
| 6 | Dispatch | Candidate query, scoring, waves via BullMQ, offers, atomic accept, timeouts, manual assign/reassign | **race test: two partners accept simultaneously → exactly one succeeds** |
| 7 | Real-time tracking | Socket.IO gateways, auth/authz, location validation, adaptive intervals, geofence arrival, ETA via MapsProvider, retention | tracking authorization tests |
| 8 | Customer App core | Flutter app shell, theme, i18n, auth, home (services + banners), saved places, profile, error states | `flutter analyze` clean; widget tests |
| 9 | Partner App core | Shell, onboarding wizard, availability/heartbeat, offer sheet, documents, earnings | `flutter analyze` clean |
| 10 | Ride flow | Estimate → vehicle options → request → tracking → PIN start → complete → payment → rating (both apps) | E2E ride journey |
| 11 | Delivery flow | Package form → courier → pickup OTP → tracking → delivery OTP/POD → completion | E2E delivery journey |
| 12 | Home service + Quote | Category/subcategory → problem media → technician → inspection → quote → approval → work → confirmation | E2E service journey |
| 13 | Payments + Wallet + Ledger | Providers (cash, wallet, gateway adapter), idempotency, webhooks, refunds, ledger settlement, commission, withdrawals, receipts | idempotency tests; ledger balance tests |
| 14 | Notifications + Chat | Templates AR/EN, channels, preferences, broadcast; job chat with receipts | delivery tests |
| 15 | Admin Dashboard | Ops dashboard, live map, dispatcher console, customers/partners/services/zones/pricing/config/flags, **campaign & banner manager**, reports | `next build` clean; RBAC nav tests |
| 16 | Support + Disputes | Tickets, reports, disputes with financial decisions | tests |
| 17 | Analytics + Audit | Product events, KPIs, audit viewer, exports | tests |
| 18 | Security hardening | Rate limits, headers, IDOR sweep, upload hardening, secrets scan, PII encryption review | security checklist in `docs/SECURITY.md` |
| 19 | Automated E2E | Cross-app journeys + race + payment retry + permission suites in CI | CI green |
| 20 | Performance + Production readiness | Load tests (WS connections, location bursts, dispatch/notification bursts), pagination audit, image pipeline, backup/restore drill, runbooks, `FINAL_IMPLEMENTATION_REPORT.md` | production checklist (§197) |

## Definition of Done per feature (§190)

UI exists · API exists · DB where needed · permissions applied · validation applied · error states · tests · docs updated · mobile RTL works · no console errors · no broken actions.

## Status vocabulary (§191)

Every item in `FINAL_IMPLEMENTATION_REPORT.md` is marked exactly one of: **Implemented**, **Partially Implemented**, **Blocked**, **Not Implemented** — with the reason.
