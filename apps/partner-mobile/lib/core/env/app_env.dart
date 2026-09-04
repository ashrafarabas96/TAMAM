import 'package:flutter/foundation.dart';

/// Build flavours are selected entirely with `--dart-define`, so one binary
/// definition serves dev / staging / production without extra entry points.
enum AppEnvironment { dev, staging, prod }

/// Compile-time configuration. Every value has a working default so the app
/// runs against a local API with a plain `flutter run`.
@immutable
class AppEnv {
  const AppEnv({
    required this.environment,
    required this.apiBaseUrl,
    required this.socketBaseUrl,
    required this.mapTileUrlTemplate,
    required this.mapAttribution,
    required this.deepLinkScheme,
    required this.universalLinkHost,
  });

  /// Reads the `--dart-define` values once at startup.
  /// [apiBaseUrlOverride] wins over the compile-time default. A build installed
  /// on a real phone cannot know the address of the machine running the API, so
  /// it is chosen on the device instead (see `server_setup.dart`).
  factory AppEnv.fromDefines({String? apiBaseUrlOverride}) {
    const String rawEnv = String.fromEnvironment('ENV', defaultValue: 'dev');
    const String compiledApiBaseUrl = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://10.0.2.2:3000/api/v1',
    );
    final String apiBaseUrl =
        (apiBaseUrlOverride != null && apiBaseUrlOverride.isNotEmpty)
            ? apiBaseUrlOverride
            : compiledApiBaseUrl;
    const String socketBaseUrl = String.fromEnvironment('SOCKET_BASE_URL');
    const String tiles = String.fromEnvironment(
      'MAP_TILE_URL',
      defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
    const String attribution = String.fromEnvironment(
      'MAP_ATTRIBUTION',
      defaultValue: '© OpenStreetMap contributors',
    );
    return AppEnv(
      environment: _parseEnvironment(rawEnv),
      apiBaseUrl: _stripTrailingSlash(apiBaseUrl),
      socketBaseUrl:
          _stripTrailingSlash(socketBaseUrl.isEmpty ? _deriveSocketUrl(apiBaseUrl) : socketBaseUrl),
      mapTileUrlTemplate: tiles,
      mapAttribution: attribution,
      deepLinkScheme: 'tamam-partner',
      universalLinkHost: 'partner.tamam.app',
    );
  }

  final AppEnvironment environment;

  /// Includes the `/api/v1` prefix.
  final String apiBaseUrl;

  /// Origin only — namespaces (`/tracking`, `/chat`) are appended by the socket client.
  final String socketBaseUrl;
  final String mapTileUrlTemplate;
  final String mapAttribution;
  final String deepLinkScheme;
  final String universalLinkHost;

  bool get isProduction => environment == AppEnvironment.prod;

  /// Dev codes returned by the OTP endpoint are only ever shown off-production.
  bool get showsDevOtpCode => !isProduction && !kReleaseMode;

  static AppEnvironment _parseEnvironment(String raw) {
    switch (raw.toLowerCase()) {
      case 'prod':
      case 'production':
        return AppEnvironment.prod;
      case 'staging':
      case 'stage':
        return AppEnvironment.staging;
      default:
        return AppEnvironment.dev;
    }
  }

  /// `https://api.tamam.app/api/v1` → `https://api.tamam.app`.
  static String _deriveSocketUrl(String apiBaseUrl) {
    final Uri? uri = Uri.tryParse(apiBaseUrl);
    if (uri == null) return apiBaseUrl;
    return uri.replace(path: '', query: '').toString();
  }

  static String _stripTrailingSlash(String value) =>
      value.endsWith('/') ? value.substring(0, value.length - 1) : value;
}
