# TAMAM — Partner app

The Flutter app for the people who do the work: drivers, couriers, technicians
and service providers. Arabic-first (RTL), Palestine / ILS, Android + iOS.

It is a **work** app, not a shopping app. Everything is arranged around one
question — *am I online, and what is the next thing I press?* — so the home
screen is a single large ONLINE/OFFLINE toggle, and the active-job screen never
shows two competing primary buttons.

---

## 1. Setting up a clone

The repository tracks only the Dart source and the platform files that carry
real configuration (`AndroidManifest.xml`, `android/app/build.gradle`,
`ios/Runner/Info.plist`). The rest of the Android/iOS scaffolding is generated,
so a fresh clone needs one `flutter create` pass before it will build:

```bash
cd apps/partner-mobile

# Regenerates the platform folders around the files already in git.
# `flutter create` never overwrites an existing file, so the manifest,
# build.gradle and Info.plist below survive it — check `git status` after.
flutter create --org app.tamam --project-name tamam_partner --platforms=android,ios .

flutter pub get
flutter gen-l10n          # writes lib/l10n/generated/ from the two ARB files
```

`flutter gen-l10n` also runs automatically on every build (`generate: true` in
`pubspec.yaml`), but running it once by hand up front means the analyzer stops
complaining about `package:tamam_partner/l10n/generated/app_localizations.dart`
before you have built anything.

Then:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

`10.0.2.2` is how the Android emulator reaches the host machine. On an iOS
simulator use `http://localhost:3000/api/v1`; on a physical device use your
machine's LAN address.

### Build flavours

There are no separate entry points — everything is `--dart-define`:

| Define | Default | Notes |
| --- | --- | --- |
| `ENV` | `dev` | `dev` \| `staging` \| `prod`. Only non-prod shows the OTP dev code. |
| `API_BASE_URL` | `http://10.0.2.2:3000/api/v1` | Must include `/api/v1`. |
| `SOCKET_BASE_URL` | derived from `API_BASE_URL` | Origin only; namespaces are appended. |
| `MAP_TILE_URL` | OpenStreetMap | `{z}/{x}/{y}` template. |
| `MAP_ATTRIBUTION` | `© OpenStreetMap contributors` | Shown on every map. |

```bash
flutter build apk --release \
  --dart-define=ENV=prod \
  --dart-define=API_BASE_URL=https://api.tamam.app/api/v1
```

---

## 2. Layout

```
lib/
  core/          config, contracts (generated), device, env, format, maps,
                 models, network, providers, realtime, routing, session,
                 storage, theme (tokens generated), widgets
  features/      account  active_job  auth     banners  catalog  chat
                 documents earnings   home     jobs     location media
                 notifications offers  onboarding quotes shell   support
                 vehicles
  l10n/          app_ar.arb (template) + app_en.arb → generated/
```

Two directories are **generated and must never be hand-edited**:

* `lib/core/theme/generated/tamam_tokens.dart` — from `packages/ui-tokens`
  (`pnpm tokens:generate` at the repo root).
* `lib/core/contracts/generated/tamam_contracts.dart` — the enums and error
  codes mirrored from `packages/shared-types`.

Each feature is `data/` (repository, talks to `ApiClient`), `domain/` (plain
Dart models and rules, unit-testable), `presentation/` (Riverpod controllers and
widgets). Navigation lives entirely in `lib/core/routing/`: screens push
destinations from `Routes`, and `app_router.dart`'s single `_redirect` decides
whether the session is allowed to be there.

### The server is the source of truth

The client never computes anything a customer is charged. Money is integer
minor units end to end (`Money`), and the only arithmetic in the app is
presentational. The one place a total appears before the server has produced it
is the quote builder, where it is labelled a **preview**
(`quotePreviewDisclaimer`) and recomputed on submit.

Availability is the same: the ONLINE/OFFLINE pill displays the server's answer.
Tapping it starts a round-trip to `PUT /partners/me/availability`, and nothing
flips until the server agrees.

---

## 3. Screens

| Area | Screens |
| --- | --- |
| Auth | splash · phone · OTP |
| Onboarding | 7-step resumable wizard (personal · roles · skills · documents · vehicle · zones · review) · status (draft / under review / approved / rejected / suspended) |
| Shell | bottom nav (home · jobs · earnings · account) · persistent active-job card · offline banner |
| Home | availability toggle · go-online sheet · today's earnings · stats · warnings · resume-shift card |
| Offers | full-screen offer sheet with countdown ring |
| Active job | status-driven primary action · map · customer card · start-code sheet · proof of delivery · completion sheets · cancel / release sheets |
| Quotes | quote builder · item sheet · summary card |
| Jobs | history with filters · detail with earnings breakdown and the customer's rating · rate-customer |
| Earnings | today/week/month · statement · withdraw sheet · withdrawals |
| Documents | required / other, status chips, re-upload, expiry badges |
| Vehicles | list · detail (activate, documents) · add/edit form |
| Account | profile · work preferences · preferences (language, theme) · notification settings · notifications inbox · sessions · support · legal |
| Chat | per-job chat |

Every list and detail screen has explicit loading, empty, error and offline
states (`AsyncView`, `EmptyState`), and the whole app is laid out RTL-first.

---

## 4. Background location — the part that actually breaks

Continuous location is the app's hardest platform problem, and both OSes fight
it. What the app does:

* Location is recorded **only while the partner is online**. Going offline stops
  the stream, the uploads and the sockets. Signing out does the same
  (`SessionTeardown`).
* If the permission is revoked or location services are switched off mid-shift,
  the app flips itself to **OFFLINE** and explains why
  (`interruptionPermission` / `interruptionServiceDisabled`) rather than
  pretending to still be tracking.
* `LocationBatcher` drops stale (>60 s) and inaccurate (>150 m) samples before
  they reach the radio, and bounds its queue so a long tunnel cannot grow it
  without limit. `TrackingCadence` uploads every ~20 s while idle and every ~4 s
  on a job, with a distance filter (25 m / 10 m) that is the real battery
  lever — a parked partner produces almost no samples.
* A slow server-pushed interval (`tracking:config`) is honoured while idle but
  can never delay an active job.

### Android

* Needs `ACCESS_FINE_LOCATION` **and** `ACCESS_BACKGROUND_LOCATION`. Android 11+
  refuses to grant background location in the same prompt as foreground: the app
  asks for foreground first, and only offers "allow all the time" from the
  go-online sheet afterwards. Users often have to pick it from system Settings,
  which is what `actionOpenSettings` is for.
* A foreground service (`flutter_background_service`, declared with
  `android:foregroundServiceType="location"`) runs for the whole shift with a
  persistent notification. Without it the process is frozen when the screen goes
  off. Android 14 enforces that the declared type matches actual use, which is
  why `location` is the only type declared.
* `stopWithTask="false"`: swiping the app away must not silently end a shift the
  partner believes is running.
* OEM battery managers (Xiaomi, Huawei, Oppo, Samsung) kill foreground services
  anyway, and there is no API that fixes this — the partner has to allow
  autostart and disable battery optimisation for the app by hand. The app does
  **not** currently request a battery-optimisation exemption; if that is added,
  declare `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` at the same time and be ready
  to justify it in Play review. Test on a real device from the target market,
  not just an emulator.
* The battery level is read (no permission needed) and sent on the heartbeat, so
  ops can see a partner whose phone is about to die.
* `POST_NOTIFICATIONS` is runtime-requested on Android 13+. Denying it means the
  partner never sees an offer, so the go-online sheet treats it as a blocker.

### iOS

* `UIBackgroundModes` includes `location`. iOS shows a blue status bar whenever
  background location is in use; that is intended — the partner should always be
  able to see that a shift is running.
* "Always" is never granted on the first prompt. iOS shows "While Using the App"
  first and re-prompts for "Always" later, on its own schedule. Until then the
  app is in a **limited** mode: uploads pause when the app is backgrounded, and
  the home screen says so (`backgroundLimitedBanner`).
* The three usage strings in `Info.plist` say plainly that tracking happens only
  while online. App Review checks that claim against actual behaviour, so do not
  loosen it without changing the code first.
* iOS may still suspend the app after long periods without movement. The app
  relies on the `location` background mode to be resumed; there is no
  significant-location-change fallback yet, so a shift left parked for a very
  long time can go quiet until the partner opens the app. The heartbeat is what
  surfaces that server-side.

---

## 5. Testing against the seeded API

Start the backend from the repo root:

```bash
pnpm db:reset && pnpm db:seed     # resets and seeds
pnpm --filter @tamam/api dev
```

The seed creates three approved partners and one customer:

| Role | Phone |
| --- | --- |
| Driver | `+970599000002` |
| Courier | `+970599000003` |
| Technician | `+970599000004` |
| Customer | `+970599000001` |

With the console SMS provider (the dev default), `POST /auth/otp/request`
returns the code in its response, and the OTP screen shows it on screen
(`otpDevCode`) whenever `ENV` is not `prod`. There is no need to read the API
logs.

### Walking the offer flow end to end

1. Run the partner app, sign in as `+970599000002`, and read the dev code off
   the OTP screen.
2. Go online. Grant location; on Android also grant "allow all the time" when
   the sheet offers it. The toggle turns yellow only after the server confirms.
3. Put the emulator somewhere inside a seeded zone — Android Studio's
   *Extended controls → Location*, or `adb emu geo fix 35.2034 31.9038`
   (Ramallah; note **lng lat** order). The app will not receive offers from
   outside its approved zones.
4. Create a job as the customer: either run the customer app and order a ride,
   or `POST /api/v1/jobs` with the customer's token.
5. The offer arrives over the `job:offer` socket event and the full-screen sheet
   opens with the countdown ring. `GET /partners/me/offers` is the fallback if
   the socket is down, so an offer is never lost to a flaky connection.
6. Accept, then walk the job: en route → arrive (geofenced — move the emulator
   close to the pickup or the API returns the distance and the app explains it)
   → start → complete.

For the home-service flow use the technician (`+970599000004`) and order a home
service as the customer. That path goes inspection → quote builder → the
customer approves → work start → work complete → the customer confirms.

A few things worth exercising because they are easy to get wrong:

* **Two offers at once.** Dispatch waves overlap; create two jobs quickly and
  check the queue counter on the sheet.
* **Losing a race.** Accept an offer that another partner already took: the API
  answers `JOB_ALREADY_ASSIGNED` and the app says so instead of failing silently.
* **Version conflict.** Transition a job from the admin console while the app
  sits on the active-job screen; the app should refuse the stale action and
  explain it (`errorVersionConflict`).
* **Airplane mode** mid-job, to see the offline banner and the queued location
  batch flush on reconnect.

---

## 6. Tests

```bash
flutter test
flutter analyze
```

Unit tests cover the rules most likely to cause real damage — money and quote
preview totals, the offer countdown, the location batcher and tracking cadence,
and the job status → primary action mapping. Widget tests cover the offer sheet
and the availability toggle.

Every test runs inside a `ProviderScope` whose `ApiClient` points at a dead
local address, so nothing in `test/` can reach the network.

---

## 7. Localisation

`lib/l10n/app_ar.arb` is the **template**; `app_en.arb` must carry the same key
set. Arabic is the default locale and the app is designed RTL-first: use
`EdgeInsetsDirectional`, `AlignmentDirectional` and `start`/`end` rather than
`left`/`right`.

No user-facing string may be hard-coded in a widget, and no colour may be
written as a literal — colours come from `TamamColors` / the generated tokens,
strings from `context.l10n`.

To add a string: add the key to **both** ARB files (with a `@key` placeholders
block if it takes arguments), run `flutter gen-l10n`, then use
`context.l10n.myKey`.

---

## 8. Push notifications

`pushTokenProviderProvider` ships as a no-op so the app builds and runs with no
Firebase project. To enable push, add `firebase_messaging`, implement
`PushTokenProvider`, and override the provider in `main.dart`:

```dart
overrides: <Override>[
  pushTokenProviderProvider.overrideWithValue(FirebasePushTokenProvider()),
],
```

The app registers whatever token it gets with `POST /me/push-token` and routes
payloads through `DeepLinks.resolve`, so no other code has to change.

---

## 9. Security notes

* Access and refresh tokens live in `flutter_secure_storage` (Keychain /
  EncryptedSharedPreferences), never in `SharedPreferences`.
* `minSdk` is 23 because that is the floor for encrypted shared preferences.
* Signing out clears the tokens, stops the location pipeline, disconnects the
  sockets and cancels the foreground service before the router leaves the
  authenticated tree.
* ATS and `usesCleartextTraffic="false"` are both on: every endpoint is HTTPS.
  The `http://10.0.2.2` default is for the emulator in debug builds only.
