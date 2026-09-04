import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tamam_partner/app.dart';
import 'package:tamam_partner/core/env/app_env.dart';
import 'package:tamam_partner/core/env/server_setup.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/storage/prefs_store.dart';
import 'package:tamam_partner/features/location/data/foreground_service.dart';

/// Entry point.
///
/// Flavours come entirely from `--dart-define`, e.g.
/// ```
/// flutter run --dart-define=ENV=staging \
///             --dart-define=API_BASE_URL=https://staging.tamam.app/api/v1
/// ```
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await SystemChrome.setPreferredOrientations(<DeviceOrientation>[
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(statusBarIconBrightness: Brightness.light),
  );

  // Locale date symbols must be loaded before anything builds a DateFormat. Inside a
  // resolved widget tree Flutter loads them for us; a formatter constructed earlier — in a
  // background isolate, or at provider-construction time — would throw without this.
  await initializeDateFormatting('ar');
  await initializeDateFormatting('en');

  final SharedPreferences preferences = await SharedPreferences.getInstance();

  // A build with no API address compiled in is a local test build: it is meant
  // to reach a machine on the same network, whose address changes with every
  // Wi-Fi, so it is asked for on the device instead. Release builds always pass
  // --dart-define=API_BASE_URL and never see this screen.
  const bool hasCompiledApi = bool.hasEnvironment('API_BASE_URL');
  if (!hasCompiledApi) {
    final String? server = await resolveServerBaseUrl(preferences);
    if (server == null) {
      runApp(
        ServerSetupApp(
          prefs: preferences,
          previous: preferences.getString(kServerBaseUrlKey),
          onReady: (String url) => unawaited(_launch(preferences, url)),
        ),
      );
      return;
    }
    await _launch(preferences, server);
    return;
  }

  await _launch(preferences, null);
}

/// Builds the environment and starts the real app.
Future<void> _launch(SharedPreferences preferences, String? apiBaseUrl) async {
  final AppEnv env = AppEnv.fromDefines(apiBaseUrlOverride: apiBaseUrl);

  // The Android foreground service must be configured before it can be
  // started; configuration is idempotent and does not start anything.
  await WorkForegroundService.configure(
    locale: Locale(preferences.getString(PrefsStore.keyLocale) == 'en' ? 'en' : 'ar'),
  );

  // Framework errors must never take the app down silently in release.
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    if (kReleaseMode) debugPrint('Unhandled Flutter error: ${details.exceptionAsString()}');
  };

  runApp(
    ProviderScope(
      overrides: <Override>[
        prefsStoreProvider.overrideWithValue(PrefsStore(preferences)),
        appEnvProvider.overrideWithValue(env),
        // To enable push, override `pushTokenProviderProvider` here with a
        // Firebase-backed implementation (see README → Push notifications).
      ],
      child: const TamamPartnerApp(),
    ),
  );
}
