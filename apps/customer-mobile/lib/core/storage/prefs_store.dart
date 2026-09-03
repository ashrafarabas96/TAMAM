import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:tamam_customer/core/models/json.dart';

/// Non-sensitive preferences and offline caches.
///
/// Anything secret belongs in [SecureTokenStore]; this class deliberately holds
/// only data that would be harmless in a device backup.
class PrefsStore {
  PrefsStore(this._prefs);

  static const String keyLocale = 'tamam.locale';
  static const String keyThemeMode = 'tamam.themeMode';
  static const String keyOnboardingSeen = 'tamam.onboardingSeen';
  static const String keyLastAddress = 'tamam.lastAddress';
  static const String keySessionId = 'tamam.sessionId';
  static const String keyDeviceId = 'tamam.deviceId';
  static const String keyBannerEventQueue = 'tamam.banners.queue';
  static const String keyFeatureFlags = 'tamam.featureFlags';
  static const String keyPendingPromoCode = 'tamam.promo.pending';
  static const String keyLocationPromptShown = 'tamam.locationPromptShown';

  static String bannerFeedKey(String placement) => 'tamam.banners.feed.$placement';

  final SharedPreferences _prefs;

  String? getString(String key) => _prefs.getString(key);

  Future<void> setString(String key, String value) => _prefs.setString(key, value);

  bool getBool(String key, {bool fallback = false}) => _prefs.getBool(key) ?? fallback;

  Future<void> setBool(String key, {required bool value}) => _prefs.setBool(key, value);

  Future<void> remove(String key) => _prefs.remove(key);

  /// Reads a JSON object previously written with [setJson]; malformed payloads
  /// are dropped rather than thrown so a bad cache can never brick a launch.
  JsonMap? getJson(String key) {
    final String? raw = _prefs.getString(key);
    if (raw == null || raw.isEmpty) return null;
    try {
      return asJsonMap(jsonDecode(raw));
    } on FormatException {
      return null;
    }
  }

  Future<void> setJson(String key, JsonMap value) => _prefs.setString(key, jsonEncode(value));

  List<JsonMap> getJsonList(String key) {
    final String? raw = _prefs.getString(key);
    if (raw == null || raw.isEmpty) return const <JsonMap>[];
    try {
      return asJsonList(jsonDecode(raw));
    } on FormatException {
      return const <JsonMap>[];
    }
  }

  Future<void> setJsonList(String key, List<JsonMap> value) => _prefs.setString(key, jsonEncode(value));

  /// Clears everything that belongs to a signed-in customer, keeping device-level
  /// settings (locale, theme, deviceId) so the next sign-in feels continuous.
  Future<void> clearUserScopedData() async {
    await _prefs.remove(keyLastAddress);
    await _prefs.remove(keyPendingPromoCode);
    await _prefs.remove(keyFeatureFlags);
    for (final String key in _prefs.getKeys().where((String k) => k.startsWith('tamam.banners.feed.')).toList()) {
      await _prefs.remove(key);
    }
  }
}
