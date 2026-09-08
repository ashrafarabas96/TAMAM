import 'package:dio/dio.dart' hide Headers;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tamam_customer/core/env/app_env.dart';
import 'package:tamam_customer/core/network/api_client.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/storage/prefs_store.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Builds the provider overrides every widget test needs: preferences backed by
/// the in-memory mock, a fixed environment, and an API client that never talks
/// to a real server.
Future<List<Override>> testOverrides({Map<String, Object> prefs = const <String, Object>{}}) async {
  SharedPreferences.setMockInitialValues(prefs);
  final SharedPreferences preferences = await SharedPreferences.getInstance();
  return <Override>[
    prefsStoreProvider.overrideWithValue(PrefsStore(preferences)),
    appEnvProvider.overrideWithValue(AppEnv.fromDefines()),
    apiClientProvider.overrideWithValue(ApiClient(Dio(BaseOptions(baseUrl: 'http://localhost')))),
  ];
}

/// Pumps [child] inside the real theme, localisations and a Riverpod scope, so
/// widget tests exercise the same wiring the app uses.
/// Pass [container] when the test needs to read providers back; [overrides] is then
/// ignored because the container already carries them.
Future<void> pumpAppWidget(
  WidgetTester tester,
  Widget child, {
  List<Override> overrides = const <Override>[],
  ProviderContainer? container,
  Locale locale = const Locale('ar'),
  Size surfaceSize = const Size(390, 844),
  // Layout defects hide at the defaults: a 390-wide light-theme screen at 1.0x
  // text is the one every developer looks at. Small phones, large accessibility
  // text and the dark theme are where overflows and vanished text actually
  // show up, so a test can ask for any of them.
  double textScale = 1.0,
  Brightness brightness = Brightness.light,
}) async {
  await tester.binding.setSurfaceSize(surfaceSize);
  addTearDown(() => tester.binding.setSurfaceSize(null));

  final Widget app = MaterialApp(
    locale: locale,
    supportedLocales: supportedAppLocales,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    theme: brightness == Brightness.dark
        ? TamamTheme.dark(locale.languageCode)
        : TamamTheme.light(locale.languageCode),
    builder: (BuildContext context, Widget? inner) => MediaQuery(
      data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
      child: inner ?? const SizedBox.shrink(),
    ),
    home: Scaffold(body: child),
  );
  await tester.pumpWidget(
    container == null
        ? ProviderScope(overrides: overrides, child: app)
        : UncontrolledProviderScope(container: container, child: app),
  );
  await tester.pump();
}
