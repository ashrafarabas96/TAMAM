import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tamam_customer/app.dart';
import 'package:tamam_customer/core/env/app_env.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/storage/prefs_store.dart';

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

  final SharedPreferences preferences = await SharedPreferences.getInstance();
  final AppEnv env = AppEnv.fromDefines();

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
      child: const TamamApp(),
    ),
  );
}
