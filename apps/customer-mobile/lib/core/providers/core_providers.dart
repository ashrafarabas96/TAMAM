import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart' hide Headers;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:tamam_customer/core/config/feature_flags.dart';
import 'package:tamam_customer/core/device/device_info.dart';
import 'package:tamam_customer/core/device/push_token_provider.dart';
import 'package:tamam_customer/core/env/app_env.dart';
import 'package:tamam_customer/core/format/money_formatter.dart';
import 'package:tamam_customer/core/format/unit_formatter.dart';
import 'package:tamam_customer/core/maps/geocoding_service.dart';
import 'package:tamam_customer/core/maps/location_service.dart';
import 'package:tamam_customer/core/network/api_client.dart';
import 'package:tamam_customer/core/network/api_paths.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/core/network/connectivity_service.dart';
import 'package:tamam_customer/core/network/interceptors.dart';
import 'package:tamam_customer/core/network/token_refresher.dart';
import 'package:tamam_customer/core/session/session_controller.dart';
import 'package:tamam_customer/core/session/session_repository.dart';
import 'package:tamam_customer/core/session/session_state.dart';
import 'package:tamam_customer/core/storage/prefs_store.dart';
import 'package:tamam_customer/core/storage/secure_token_store.dart';
import 'package:uuid/uuid.dart';

/* ------------------------------------------------------------ bootstrapping */

/// Overridden in `main()` after `SharedPreferences` resolves.
final Provider<PrefsStore> prefsStoreProvider = Provider<PrefsStore>(
  (Ref ref) => throw UnimplementedError('prefsStoreProvider must be overridden in main()'),
);

/// Overridden in `main()` with the values read from `--dart-define`.
final Provider<AppEnv> appEnvProvider = Provider<AppEnv>(
  (Ref ref) => throw UnimplementedError('appEnvProvider must be overridden in main()'),
);

/// Push registration; the default is a no-op so the app runs without Firebase.
final Provider<PushTokenProvider> pushTokenProviderProvider =
    Provider<PushTokenProvider>((Ref ref) => const NoopPushTokenProvider());

/* ----------------------------------------------------------------- storage */

final Provider<FlutterSecureStorage> secureStorageProvider = Provider<FlutterSecureStorage>(
  (Ref ref) => const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  ),
);

final Provider<SecureTokenStore> secureTokenStoreProvider =
    Provider<SecureTokenStore>((Ref ref) => SecureTokenStore(ref.watch(secureStorageProvider)));

/* ------------------------------------------------------------------ device */

/// Caches the device profile for the life of the process: the loader touches
/// platform channels, and every request needs the result.
class DeviceProfileHolder {
  DeviceProfileHolder(this._loader);

  final DeviceInfoLoader _loader;
  Future<DeviceProfile>? _future;

  Future<DeviceProfile> get() => _future ??= _loader.load();
}

final Provider<DeviceProfileHolder> deviceProfileHolderProvider = Provider<DeviceProfileHolder>(
  (Ref ref) => DeviceProfileHolder(DeviceInfoLoader(ref.watch(prefsStoreProvider))),
);

final FutureProvider<DeviceProfile> deviceProfileProvider =
    FutureProvider<DeviceProfile>((Ref ref) => ref.watch(deviceProfileHolderProvider).get());

/// A per-launch identifier used to de-duplicate banner impressions server-side.
final Provider<String> appSessionIdProvider = Provider<String>((Ref ref) => const Uuid().v4());

/* ------------------------------------------------------------ localization */

/// Persisted UI language. Arabic is the default and the app is RTL-first.
class LocaleController extends Notifier<Locale> {
  @override
  Locale build() {
    final String? saved = ref.read(prefsStoreProvider).getString(PrefsStore.keyLocale);
    return Locale(saved == 'en' ? 'en' : 'ar');
  }

  Future<void> setLanguage(String languageCode) async {
    final String next = languageCode == 'en' ? 'en' : 'ar';
    await ref.read(prefsStoreProvider).setString(PrefsStore.keyLocale, next);
    state = Locale(next);
  }
}

final NotifierProvider<LocaleController, Locale> localeControllerProvider =
    NotifierProvider<LocaleController, Locale>(LocaleController.new);

/// Persisted light/dark/system preference.
class ThemeModeController extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    switch (ref.read(prefsStoreProvider).getString(PrefsStore.keyThemeMode)) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  Future<void> set(ThemeMode mode) async {
    await ref.read(prefsStoreProvider).setString(PrefsStore.keyThemeMode, mode.name);
    state = mode;
  }
}

final NotifierProvider<ThemeModeController, ThemeMode> themeModeControllerProvider =
    NotifierProvider<ThemeModeController, ThemeMode>(ThemeModeController.new);

final Provider<MoneyFormatter> moneyFormatterProvider = Provider<MoneyFormatter>(
  (Ref ref) => MoneyFormatter(ref.watch(localeControllerProvider).toLanguageTag()),
);

final Provider<UnitFormatter> unitFormatterProvider = Provider<UnitFormatter>(
  (Ref ref) => UnitFormatter(ref.watch(localeControllerProvider).toLanguageTag()),
);

/* ------------------------------------------------------------ connectivity */

final Provider<ConnectivityService> connectivityServiceProvider = Provider<ConnectivityService>((Ref ref) {
  final ConnectivityService service = ConnectivityService(Connectivity());
  ref.onDispose(service.dispose);
  return service;
});

/// `true` while the device reports a usable network interface.
final StreamProvider<bool> connectivityStatusProvider = StreamProvider<bool>((Ref ref) {
  final ConnectivityService service = ref.watch(connectivityServiceProvider);
  return service.onStatusChanged;
});

/// Convenience for widgets: optimistic while the first value is pending.
final Provider<bool> isOnlineProvider = Provider<bool>(
  (Ref ref) => ref.watch(connectivityStatusProvider).maybeWhen(
        data: (bool online) => online,
        orElse: () => ref.watch(connectivityServiceProvider).isOnline,
      ),
);

/* --------------------------------------------------------------- networking */

/// A Dio instance with no interceptors — used for token refresh and retries so
/// neither can recurse through the auth interceptor.
final Provider<Dio> bareDioProvider = Provider<Dio>((Ref ref) {
  final AppEnv env = ref.watch(appEnvProvider);
  final Dio dio = Dio(_baseOptions(env));
  ref.onDispose(dio.close);
  return dio;
});

final Provider<TokenRefresher> tokenRefresherProvider = Provider<TokenRefresher>(
  (Ref ref) => TokenRefresher(
    bareClient: ref.watch(bareDioProvider),
    store: ref.watch(secureTokenStoreProvider),
    device: ref.watch(deviceProfileHolderProvider).get,
  ),
);

final Provider<Dio> dioProvider = Provider<Dio>((Ref ref) {
  final AppEnv env = ref.watch(appEnvProvider);
  final Dio dio = Dio(_baseOptions(env));
  dio.interceptors.addAll(<Interceptor>[
    OfflineGuardInterceptor(ref.watch(connectivityServiceProvider)),
    PlatformHeadersInterceptor(
      device: ref.watch(deviceProfileHolderProvider).get,
      languageCode: () => ref.read(localeControllerProvider).languageCode,
    ),
    AuthInterceptor(
      store: ref.watch(secureTokenStoreProvider),
      refresher: ref.watch(tokenRefresherProvider),
      retryClient: ref.watch(bareDioProvider),
      onSessionLost: () => ref.read(sessionControllerProvider.notifier).handleTokensLost(),
    ),
  ]);
  ref.onDispose(dio.close);
  return dio;
});

final Provider<ApiClient> apiClientProvider = Provider<ApiClient>((Ref ref) => ApiClient(ref.watch(dioProvider)));

BaseOptions _baseOptions(AppEnv env) => BaseOptions(
      baseUrl: env.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      contentType: 'application/json',
      responseType: ResponseType.json,
      // Non-2xx is handled by ApiClient's envelope mapping, not by Dio.
      validateStatus: (int? status) => status != null && status >= 200 && status < 300,
    );

/* -------------------------------------------------------------- session */

final Provider<SessionRepository> sessionRepositoryProvider =
    Provider<SessionRepository>((Ref ref) => SessionRepository(ref.watch(apiClientProvider)));

final NotifierProvider<SessionController, SessionState> sessionControllerProvider =
    NotifierProvider<SessionController, SessionState>(SessionController.new);

/// The signed-in customer's id, or `null` — used by chat to tell messages apart.
final Provider<String?> currentUserIdProvider =
    Provider<String?>((Ref ref) => ref.watch(sessionControllerProvider).user?.id);

/* --------------------------------------------------------- feature flags */

/// Feature flags with a persisted copy so a cold, offline start still hides
/// what the operator disabled.
class FeatureFlagsController extends AsyncNotifier<FeatureFlags> {
  @override
  Future<FeatureFlags> build() async {
    final PrefsStore prefs = ref.read(prefsStoreProvider);
    // Re-read whenever the session changes: rollout targeting is per user.
    ref.watch(sessionControllerProvider.select((SessionState s) => s.user?.id));
    try {
      final FeatureFlags flags = FeatureFlags.fromJson(await ref.read(apiClientProvider).getObject(ApiPaths.featureFlags));
      await prefs.setJson(PrefsStore.keyFeatureFlags, flags.toJson());
      return flags;
    } on AppFailure {
      final Map<String, Object?>? cached = prefs.getJson(PrefsStore.keyFeatureFlags);
      return cached == null ? const FeatureFlags.defaults() : FeatureFlags.fromJson(cached);
    }
  }

  /// Re-fetches after sign-in or when the operator changed a rollout.
  void reload() => ref.invalidateSelf();
}

final AsyncNotifierProvider<FeatureFlagsController, FeatureFlags> featureFlagsProvider =
    AsyncNotifierProvider<FeatureFlagsController, FeatureFlags>(FeatureFlagsController.new);

/// Flags with defaults applied — safe to read synchronously anywhere.
final Provider<FeatureFlags> featureFlagsValueProvider = Provider<FeatureFlags>(
  (Ref ref) => ref.watch(featureFlagsProvider).maybeWhen(
        data: (FeatureFlags flags) => flags,
        orElse: () => const FeatureFlags.defaults(),
      ),
);

/* ------------------------------------------------------------ maps & geo */

final Provider<LocationService> locationServiceProvider =
    Provider<LocationService>((Ref ref) => const LocationService());

final Provider<GeocodingService> geocodingServiceProvider = Provider<GeocodingService>((Ref ref) {
  final AppEnv env = ref.watch(appEnvProvider);
  return NominatimGeocodingService(
    baseUrl: env.nominatimBaseUrl,
    userAgent: 'TamamCustomer/1.0 (+https://${env.universalLinkHost})',
  );
});
