import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tamam_partner/core/env/app_env.dart';
import 'package:tamam_partner/core/network/api_client.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/storage/prefs_store.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Builds the provider overrides every widget test needs: preferences backed by
/// the in-memory mock, a fixed environment, and an API client whose `Dio` has
/// no adapter wired to a real server.
///
/// Nothing in `test/` may touch the network: a screen that reaches for one gets
/// a connection error rather than a live call.
Future<List<Override>> testOverrides(
    {Map<String, Object> prefs = const <String, Object>{}}) async {
  // `UnitFormatter` builds `DateFormat`s, which throw for any locale whose
  // symbols have not been loaded. In the running app `GlobalMaterialLocalizations`
  // loads them as a side effect of resolving the locale; a test may construct a
  // formatter before (or without) that, so load both locales up front.
  await initializeDateFormatting('ar');
  await initializeDateFormatting('en');

  SharedPreferences.setMockInitialValues(prefs);
  final SharedPreferences preferences = await SharedPreferences.getInstance();
  return <Override>[
    prefsStoreProvider.overrideWithValue(PrefsStore(preferences)),
    appEnvProvider.overrideWithValue(AppEnv.fromDefines()),
    apiClientProvider.overrideWithValue(
        ApiClient(Dio(BaseOptions(baseUrl: 'http://localhost')))),
  ];
}

/// Registers the bundled brand fonts with the test engine.
///
/// Without this every glyph renders in the test font, a square one em wide,
/// which makes Arabic about twice as wide as Tajawal draws it. Layout tests
/// would then fail on rows that fit a real phone and pass on rows that do not.
///
/// Loaded afresh in every test on purpose: a future memoised from one test's
/// fake-async zone never completes when the next test awaits it.
Future<void> loadBrandFonts() async {
  for (final (String family, String prefix) in <(String, String)>[
    ('Tajawal', 'assets/fonts/Tajawal'),
    ('Poppins', 'assets/fonts/Poppins'),
  ]) {
    final FontLoader loader = FontLoader(family);
    for (final int weight in <int>[400, 500, 700, 800]) {
      loader.addFont(rootBundle.load('$prefix-$weight.ttf'));
    }
    await loader.load();
  }
}

/// Pumps [child] inside the real theme, localisations and a Riverpod scope, so
/// widget tests exercise the same wiring the app uses.
///
/// The default locale is Arabic because the app is Arabic-first: a test that
/// passes in RTL has also checked the direction the partner actually sees.
Future<void> pumpAppWidget(
  WidgetTester tester,
  Widget child, {
  List<Override> overrides = const <Override>[],
  Locale locale = const Locale('ar'),
  Size surfaceSize = const Size(390, 844),
  // Defects hide at the defaults; let a test ask for large text or dark mode.
  double textScale = 1.0,
  Brightness brightness = Brightness.light,
}) async {
  await loadBrandFonts();
  await tester.binding.setSurfaceSize(surfaceSize);
  addTearDown(() => tester.binding.setSurfaceSize(null));

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        locale: locale,
        supportedLocales: supportedAppLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        theme: brightness == Brightness.dark
            ? TamamTheme.dark(locale.languageCode)
            : TamamTheme.light(locale.languageCode),
        builder: (BuildContext context, Widget? inner) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(textScale)),
          child: inner ?? const SizedBox.shrink(),
        ),
        home: Scaffold(body: child),
      ),
    ),
  );
  // Two frames, not `pumpAndSettle`: the localisation delegates resolve
  // asynchronously, and screens such as the offer sheet run a periodic ticker
  // that would keep `pumpAndSettle` spinning forever.
  await tester.pump();
  await tester.pump();
}

/// Reads the translations for [locale] outside a widget tree, so a test can
/// assert against the shipped Arabic wording instead of hard-coding it.
Future<AppLocalizations> loadL10n([Locale locale = const Locale('ar')]) =>
    AppLocalizations.delegate.load(locale);
