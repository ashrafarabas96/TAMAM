import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// The pair of tokens issued by `POST /auth/otp/verify` and `POST /auth/refresh`.
class AuthTokens {
  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.accessExpiresAt,
  });

  final String accessToken;
  final String refreshToken;
  final DateTime accessExpiresAt;

  /// Treated as expired a minute early so an in-flight request never races the clock.
  bool get isAccessExpired => DateTime.now().isAfter(accessExpiresAt.subtract(const Duration(seconds: 60)));
}

/// Tokens live only in the platform keystore/keychain — never in shared
/// preferences, never in a plain file (spec §113).
class SecureTokenStore {
  SecureTokenStore(this._storage);

  static const String _accessKey = 'tamam.auth.accessToken';
  static const String _refreshKey = 'tamam.auth.refreshToken';
  static const String _expiresKey = 'tamam.auth.accessExpiresAt';

  final FlutterSecureStorage _storage;

  Future<AuthTokens?> read() async {
    final String? access = await _storage.read(key: _accessKey);
    final String? refresh = await _storage.read(key: _refreshKey);
    final String? expires = await _storage.read(key: _expiresKey);
    if (access == null || refresh == null) return null;
    return AuthTokens(
      accessToken: access,
      refreshToken: refresh,
      accessExpiresAt: DateTime.tryParse(expires ?? '') ?? DateTime.now(),
    );
  }

  Future<void> write(AuthTokens tokens) async {
    await _storage.write(key: _accessKey, value: tokens.accessToken);
    await _storage.write(key: _refreshKey, value: tokens.refreshToken);
    await _storage.write(key: _expiresKey, value: tokens.accessExpiresAt.toIso8601String());
  }

  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    await _storage.delete(key: _expiresKey);
  }
}
