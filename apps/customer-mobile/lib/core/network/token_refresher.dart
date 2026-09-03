import 'dart:async';

import 'package:dio/dio.dart';
import 'package:tamam_customer/core/device/device_info.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/api_paths.dart';
import 'package:tamam_customer/core/storage/secure_token_store.dart';

/// Refreshes the access token, guaranteeing **one** in-flight refresh no matter
/// how many requests fail at the same moment (single-flight).
///
/// It owns a bare Dio with no interceptors, so a refresh can never recurse into
/// the auth interceptor that triggered it.
class TokenRefresher {
  TokenRefresher({
    required Dio bareClient,
    required SecureTokenStore store,
    required Future<DeviceProfile> Function() device,
  })  : _dio = bareClient,
        _store = store,
        _device = device;

  final Dio _dio;
  final SecureTokenStore _store;
  final Future<DeviceProfile> Function() _device;

  Future<AuthTokens?>? _inFlight;

  /// Returns fresh tokens, or `null` when the refresh token is no longer valid
  /// (the caller must then sign the user out).
  Future<AuthTokens?> refresh() {
    final Future<AuthTokens?>? existing = _inFlight;
    if (existing != null) return existing;
    final Future<AuthTokens?> future = _performRefresh().whenComplete(() => _inFlight = null);
    _inFlight = future;
    return future;
  }

  Future<AuthTokens?> _performRefresh() async {
    final AuthTokens? current = await _store.read();
    if (current == null) return null;
    final DeviceProfile device = await _device();
    try {
      final Response<Object?> response = await _dio.post<Object?>(
        ApiPaths.refresh,
        data: <String, Object?>{
          'refreshToken': current.refreshToken,
          'device': <String, Object?>{'deviceId': device.deviceId},
        },
      );
      final JsonMap? body = asJsonMap(response.data);
      final AuthTokens? tokens = body == null ? null : parseTokens(body);
      if (tokens == null) return null;
      await _store.write(tokens);
      return tokens;
    } on DioException catch (error) {
      final int? status = error.response?.statusCode;
      // Only a definitive rejection invalidates the session; a network blip must not.
      if (status != null && status >= 400 && status < 500) {
        await _store.clear();
        return null;
      }
      rethrow;
    }
  }

  /// Maps the `AuthTokens` DTO, turning the TTL into an absolute expiry.
  static AuthTokens? parseTokens(JsonMap json) {
    final String? access = readString(json, 'accessToken');
    final String? refresh = readString(json, 'refreshToken');
    if (access == null || refresh == null) return null;
    final int ttl = readIntOr(json, 'accessExpiresInSeconds', 900);
    return AuthTokens(
      accessToken: access,
      refreshToken: refresh,
      accessExpiresAt: DateTime.now().add(Duration(seconds: ttl)),
    );
  }
}
