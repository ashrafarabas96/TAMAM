# TAMAM — Customer app (`tamam_customer`)

The Flutter customer app for TAMAM: rides (مشوار), delivery (توصيل), home services
(خدمات) and urgent service (خدمة عاجلة), for Palestine, Arabic-first (RTL) with
English, priced in ILS.

Visual identity follows the Getir-style system encoded in
`packages/ui-tokens/tokens.json`: deep purple `#5D3EBC` headers, vivid yellow
`#FFD300` primary CTAs with dark-purple labels, a light grey canvas, white cards
with a 16 px radius, a white bottom navigation bar with purple active state, and
full dark-mode support.

---

## 1. First-time setup

Platform folders (`android/`, `ios/`, gradle wrappers, the Xcode project) are
**not** committed; only the files that carry real configuration are. Materialise
the rest once, in this folder:

```bash
cd apps/customer-mobile
flutter create --org app.tamam --project-name tamam_customer --platforms=android,ios .
```

`flutter create` never overwrites existing files, so the committed
`android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml` and
`ios/Runner/Info.plist` survive. If you regenerate into a dirty tree, check
`git diff` on those three files and keep the committed version.

Then:

```bash
flutter pub get
flutter gen-l10n          # generates lib/l10n/generated/app_localizations.dart
flutter analyze
flutter test
```

`flutter gen-l10n` is **required before the first build** — the app imports the
generated `AppLocalizations`. It re-runs automatically on `flutter run`.

---

## 2. Running against an API

Everything environment-specific comes from `--dart-define`; there is a single
entry point and no per-flavour `main_*.dart`.

| Define              | Default                              | Meaning                                        |
| ------------------- | ------------------------------------ | ---------------------------------------------- |
| `ENV`               | `dev`                                | `dev` / `staging` / `prod`                     |
| `API_BASE_URL`      | `http://10.0.2.2:3000/api/v1`        | REST base URL, including `/api/v1`             |
| `SOCKET_BASE_URL`   | derived from `API_BASE_URL`          | Socket.IO origin (namespaces are appended)     |
| `NOMINATIM_BASE_URL`| `https://nominatim.openstreetmap.org`| Geocoding service (see §6)                     |
| `MAP_TILE_URL`      | OpenStreetMap raster tiles           | `{z}/{x}/{y}` tile template                    |
| `MAP_ATTRIBUTION`   | `© OpenStreetMap contributors`       | Attribution text drawn on every map            |

```bash
# Local API on an Android emulator (10.0.2.2 is the host machine)
flutter run

# Staging
flutter run \
  --dart-define=ENV=staging \
  --dart-define=API_BASE_URL=https://staging.tamam.app/api/v1

# Production release
flutter build appbundle --release \
  --dart-define=ENV=prod \
  --dart-define=API_BASE_URL=https://api.tamam.app/api/v1
```

Off-production builds show the OTP `devCode` returned by
`POST /auth/otp/request`, so you can sign in without SMS.

---

## 3. Architecture

```
lib/
  main.dart                 entry point, ProviderScope overrides
  app.dart                  MaterialApp.router, theme/locale, lifecycle hooks
  core/
    config/                 feature flags (GET /config/feature-flags)
    contracts/generated/    enums generated from packages/shared-types — DO NOT EDIT
    device/                 device identity, PushTokenProvider interface
    env/                    --dart-define configuration
    format/                 money, dates/distances, phone (E.164)
    maps/                   MapView over flutter_map, geocoding, location, polyline
    models/                 Money, Address/GeoPoint, LocalizedText, CursorPage, JSON readers
    network/                Dio client, interceptors, AppFailure, failure → copy
    providers/              the composition root (core_providers.dart)
    realtime/               SocketClient + /tracking and /chat providers
    routing/                routes, go_router config, deep links
    session/                User, SessionController, session repository
    storage/                secure token store, shared-preferences store
    theme/                  TamamTheme + generated tokens — DO NOT EDIT the generated file
    widgets/                AsyncView, TamamButton/Card, StatusPill, MoneyText, …
  features/<feature>/
    data/                   repositories + DTO mapping
    domain/                 entities and pure rules
    presentation/           controllers (Riverpod) + screens + widgets
  l10n/                     app_ar.arb (template) + app_en.arb
```

* **State**: Riverpod 2 without codegen (`Notifier` / `AsyncNotifier`).
  Screens read state and call controller methods; no networking in widgets.
* **Routing**: `go_router` 14 with a `StatefulShellRoute` for the four tabs.
  All auth policy lives in one `redirect`.
* **Models**: hand-written immutable classes mirroring `packages/shared-types/src/dto.ts`,
  with total `fromJson` readers — a malformed field degrades, it never throws.
* **Errors**: the API envelope `{code,message,details,requestId}` maps to
  `AppFailure`; `localizedFailure()` turns a code into Arabic/English copy.
* **Money**: integer minor units everywhere. The client never computes a price —
  it formats what the server returned and renders the server's breakdown.

### Mandatory screen states

Every API-backed surface goes through `AsyncView`, which renders loading, empty,
error+retry and offline. `OfflineBanner` sits in the shells, and
`OfflineGuardInterceptor` fails requests fast while the device is offline.

---

## 4. Promotional banners

Admin-managed campaigns, rendered from `GET /banners/feed?placement=…`.

* `features/banners/data/banner_feed_repository.dart` — one feed per placement,
  cached in memory until the server's `cacheUntil`, and persisted so an offline
  launch still shows the last creatives. Any failure resolves to an *empty*
  feed: a campaign outage can never break home.
* `features/banners/data/banner_event_queue.dart` — batches IMPRESSION / CLICK /
  DISMISS with the signed `trackingToken`, `occurredAt`, `placement` and a
  per-launch `sessionId`. Flushes every 10 s, at 20 events, and when the app is
  backgrounded (`app.dart`). The backlog is persisted, bounded, and a failed
  flush is retried rather than dropped.
* Widgets — `HeroBannerCarousel` (viewport 0.92, autoplay 4.5 s that pauses on
  touch and off-screen, RTL-aware paging, parallax, page dots, shimmer
  placeholder, theme-coloured fallback when the image fails),
  `InlineBanner` (optionally dismissible) and `PlacementBanner`, which picks the
  layout and aspect ratio from the tokens for any placement.
* Impressions — `BannerImpressionTracker` fires at ≥ 50 % visibility held for
  ≥ 1 s, once per banner per session.
* Actions — `BannerActionHandler`: `DEEP_LINK` via `go_router`, `EXTERNAL_URL`
  after a confirmation sheet, `PROMO_CODE` copies the code and pre-fills the next
  checkout, `SERVICE_CATEGORY` opens the category.
* The whole feature is behind the `promo_banners` feature flag.

Add a placement to a screen with one line:

```dart
const PlacementBanner(placement: BannerPlacement.checkoutPromo);
```

---

## 5. Deep links

| Link                              | Destination                    |
| --------------------------------- | ------------------------------ |
| `tamam://home`                    | Home                           |
| `tamam://jobs/<id>`               | Tracking                       |
| `tamam://jobs/<id>/chat`          | Chat                           |
| `tamam://category/<id>`           | Category                       |
| `tamam://service/<categoryId>`    | Home-service flow              |
| `tamam://ride`, `tamam://delivery`| Order flows                    |
| `tamam://wallet`, `tamam://promos`| Wallet, offers                 |
| `tamam://invite/<code>`           | Referrals (code captured)      |
| `https://tamam.app/t/<token>`     | Public shared-trip view        |

`DeepLinks.resolve(Uri)` maps both shapes to an in-app location and returns
`null` for anything foreign, so an unknown link opens in the browser instead of
being swallowed. Android registers both the custom scheme and verified App Links
(`android/app/src/main/AndroidManifest.xml`); iOS registers the scheme in
`Info.plist`. Universal Links additionally need
`https://tamam.app/.well-known/apple-app-site-association`.

---

## 6. Maps and geocoding

`MapView` wraps `flutter_map` with OpenStreetMap raster tiles; the tile URL and
attribution are `--dart-define`s, so swapping in MapLibre or a commercial
provider is a configuration change.

**The TAMAM API exposes no geocoding endpoints.** Address search and reverse
geocoding therefore go directly to a Nominatim-compatible service behind the
`GeocodingService` interface. Requests are debounced (600 ms while dragging the
picker, 350 ms while typing) to stay inside the public instance's usage policy —
**point `NOMINATIM_BASE_URL` at a self-hosted instance before production.**

---

## 7. Fonts

Cairo (Arabic) and Inter (Latin) are fetched at runtime by `google_fonts`, with
the platform stack as fallback, so no font binaries are committed. To bundle them
instead (recommended for release, so the first frame is never unstyled):

1. drop the `.ttf` files under `assets/fonts/`;
2. declare them in `pubspec.yaml` under `flutter: fonts:`;
3. `GoogleFonts.config.allowRuntimeFetching = false;` in `main()`.

---

## 8. Push notifications

Push is behind `PushTokenProvider` (`core/device/push_token_provider.dart`), and
the default implementation is a no-op — the app builds and runs with no Firebase
project. To enable it:

1. `flutter pub add firebase_core firebase_messaging` and run `flutterfire configure`;
2. implement `PushTokenProvider` with `FirebaseMessaging.instance`
   (`requestPermission`, `getToken`, `onTokenRefresh`);
3. override `pushTokenProviderProvider` in `main.dart`.

The token is sent on `POST /auth/otp/verify` (`device.pushToken`) and refreshed
through `POST /me/push-token`. Notification payloads carry `deepLink` / `jobId`,
which `DeepLinks.resolve` already understands.

---

## 9. Screens

Auth: splash · onboarding (3 slides) · phone · OTP · name capture · location
explainer.
Shell: home · orders · wallet · account.
Ordering: search · category · ride flow · delivery flow · home-service flow ·
address sheet · map location picker.
Jobs: tracking (map + stepper + partner card + PIN/OTP + quote + SOS + share ·
cancel) · chat · rating · receipt · dispute · public shared-trip view.
Account: profile · saved places · favourites · notifications · preferences
(language, theme, channels) · sessions · support (list, new, thread) · disputes ·
offers & referrals · about/legal & account deletion.

---

## 10. Testing

```bash
flutter test
```

Unit tests cover model `fromJson` mapping, the money formatter, the banner event
queue (de-duplication, retry, persistence) and the dynamic-field validator.
Widget tests cover `ServiceTile` and `HeroBannerCarousel`.
`test/support/harness.dart` provides the themed, localised, Riverpod-scoped pump
helper used by widget tests.

---

## 11. Screenshots

> Add captures here once the API is running; suggested set, in Arabic (RTL) and
> in both themes.

| Screen | Light | Dark |
| ------ | ----- | ---- |
| Home (hero banners + service grid) | _screenshots/home-light.png_ | _screenshots/home-dark.png_ |
| Ride flow (map + fare options)     | _screenshots/ride-light.png_ | _screenshots/ride-dark.png_ |
| Tracking (partner + trip PIN)      | _screenshots/tracking-light.png_ | _screenshots/tracking-dark.png_ |
| Home-service quote review          | _screenshots/quote-light.png_ | _screenshots/quote-dark.png_ |
| Wallet & statement                 | _screenshots/wallet-light.png_ | _screenshots/wallet-dark.png_ |

---

## 12. Regenerating design tokens and contracts

Both generated files are produced from the monorepo's single sources of truth and
must never be edited by hand:

```bash
pnpm tokens:generate                       # → lib/core/theme/generated/tamam_tokens.dart
node scripts/generate-dart-contracts.mjs   # → lib/core/contracts/generated/tamam_contracts.dart
```
