import 'dart:async';

// `Headers` is hidden because the generated contracts own that name here.
import 'package:dio/dio.dart' hide Headers;
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/device/device_info.dart';
import 'package:tamam_customer/core/network/api_paths.dart';
import 'package:tamam_customer/core/network/connectivity_service.dart';
import 'package:tamam_customer/core/network/token_refresher.dart';
import 'package:tamam_customer/core/storage/secure_token_store.dart';
import 'package:uuid/uuid.dart';

/// Requests that must never carry (or trigger a refresh of) a bearer token.
const Set<String> _anonymousPaths = <String>{
  ApiPaths.otpRequest,
  ApiPaths.otpVerify,
  ApiPaths.refresh,
};

/// Adds the platform headers every endpoint expects (spec §100).
class PlatformHeadersInterceptor extends Interceptor {
  PlatformHeadersInterceptor({
    required Future<DeviceProfile> Function() device,
    required String Function() languageCode,
  })  : _device = device,
        _languageCode = languageCode;

  final Future<DeviceProfile> Function() _device;
  final String Function() _languageCode;
  final Uuid _uuid = const Uuid();

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final DeviceProfile device = await _device();
    options.headers[Headers.deviceId] = device.deviceId;
    options.headers[Headers.appVersion] = device.appVersion;
    options.headers[Headers.acceptLanguage] = _languageCode();
    options.headers[Headers.timezone] = DateTime.now().timeZoneName;
    options.headers[Headers.requestId] ??= _uuid.v4();
    handler.next(options);
  }
}

/// Fails fast when the device is offline so screens can show the offline state
/// instead of waiting out a full connect timeout.
class OfflineGuardInterceptor extends Interceptor {
  OfflineGuardInterceptor(this._connectivity);

  final ConnectivityService _connectivity;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (!_connectivity.isOnline) {
      handler.reject(
        DioException.connectionError(
          requestOptions: options,
          reason: 'offline',
        ),
        true,
      );
      return;
    }
    handler.next(options);
  }
}

/// Attaches the bearer token and performs a single silent refresh + retry when
/// the API says the access token expired.
///
/// Extends [QueuedInterceptor] so concurrent requests queue behind one refresh
/// rather than each firing their own.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor({
    required SecureTokenStore store,
    required TokenRefresher refresher,
    required Dio retryClient,
    required Future<void> Function() onSessionLost,
  })  : _store = store,
        _refresher = refresher,
        _retryClient = retryClient,
        _onSessionLost = onSessionLost;

  static const String _retriedFlag = 'tamam.retriedAfterRefresh';

  final SecureTokenStore _store;
  final TokenRefresher _refresher;
  final Dio _retryClient;
  final Future<void> Function() _onSessionLost;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (_isAnonymous(options)) {
      handler.next(options);
      return;
    }
    AuthTokens? tokens = await _store.read();
    if (tokens == null) {
      handler.next(options);
      return;
    }
    // Proactive refresh: cheaper than a guaranteed 401 round-trip.
    if (tokens.isAccessExpired) {
      tokens = await _refreshOrNull();
      if (tokens == null) {
        await _onSessionLost();
        handler.next(options);
        return;
      }
    }
    options.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final RequestOptions request = err.requestOptions;
    final bool alreadyRetried = request.extra[_retriedFlag] == true;
    if (err.response?.statusCode != 401 || alreadyRetried || _isAnonymous(request)) {
      handler.next(err);
      return;
    }

    final AuthTokens? tokens = await _refreshOrNull();
    if (tokens == null) {
      await _onSessionLost();
      handler.next(err);
      return;
    }

    request
      ..extra[_retriedFlag] = true
      ..headers['Authorization'] = 'Bearer ${tokens.accessToken}';
    try {
      final Response<Object?> response = await _retryClient.fetch<Object?>(request);
      handler.resolve(response);
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  Future<AuthTokens?> _refreshOrNull() async {
    try {
      return await _refresher.refresh();
    } on DioException {
      // Network failure during refresh: keep the session, surface the original error.
      return null;
    }
  }

  bool _isAnonymous(RequestOptions options) => _anonymousPaths.contains(options.path);
}
