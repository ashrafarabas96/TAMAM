import 'dart:async';

import 'package:dio/dio.dart' hide Headers;
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/app_failure.dart';

/// The single entry point every repository uses to reach the API.
///
/// It hides Dio entirely: callers get decoded JSON or an [AppFailure], never a
/// `DioException`. That keeps error handling identical on every screen.
class ApiClient {
  ApiClient(this._dio);

  final Dio _dio;

  /// Exposed so the socket client can reuse the configured base URL.
  String get baseUrl => _dio.options.baseUrl;

  Future<JsonMap> getObject(String path, {Map<String, Object?>? query}) async =>
      _object(() => _dio.get<Object?>(path, queryParameters: _clean(query)));

  Future<List<JsonMap>> getList(String path, {Map<String, Object?>? query}) async =>
      _list(() => _dio.get<Object?>(path, queryParameters: _clean(query)));

  Future<JsonMap> postObject(
    String path, {
    Object? body,
    Map<String, Object?>? query,
    String? idempotencyKey,
  }) async =>
      _object(
        () => _dio.post<Object?>(
          path,
          data: body,
          queryParameters: _clean(query),
          options: _idempotent(idempotencyKey),
        ),
      );

  Future<List<JsonMap>> postList(String path, {Object? body, Map<String, Object?>? query}) async =>
      _list(() => _dio.post<Object?>(path, data: body, queryParameters: _clean(query)));

  Future<JsonMap> putObject(String path, {Object? body}) async =>
      _object(() => _dio.put<Object?>(path, data: body));

  Future<JsonMap> patchObject(String path, {Object? body}) async =>
      _object(() => _dio.patch<Object?>(path, data: body));

  /// DELETE endpoints return `{ ok: true }` or `204`; both are accepted.
  Future<void> delete(String path, {Object? body}) async {
    await _guard(() => _dio.delete<Object?>(path, data: body));
  }

  /// Uploads a file body straight to a pre-signed storage URL — no auth headers,
  /// no base URL, and the storage response is never JSON.
  Future<void> putBinary(
    Uri uploadUrl,
    List<int> bytes, {
    required Map<String, String> headers,
  }) async {
    final Dio bare = Dio(BaseOptions(followRedirects: false, validateStatus: (int? s) => s != null && s < 400));
    try {
      await bare.putUri<void>(
        uploadUrl,
        data: Stream<List<int>>.fromIterable(<List<int>>[bytes]),
        options: Options(
          headers: <String, Object?>{...headers, 'content-length': bytes.length},
          contentType: headers['Content-Type'] ?? headers['content-type'],
        ),
      );
    } on DioException catch (error) {
      throw _mapError(error);
    } finally {
      bare.close();
    }
  }

  Options? _idempotent(String? key) =>
      key == null ? null : Options(headers: <String, Object?>{Headers.idempotencyKey: key});

  Future<JsonMap> _object(Future<Response<Object?>> Function() send) async {
    final Response<Object?> response = await _guard(send);
    return asJsonMap(response.data) ?? const <String, Object?>{};
  }

  Future<List<JsonMap>> _list(Future<Response<Object?>> Function() send) async {
    final Response<Object?> response = await _guard(send);
    return asJsonList(response.data);
  }

  Future<Response<Object?>> _guard(Future<Response<Object?>> Function() send) async {
    try {
      return await send();
    } on DioException catch (error) {
      throw _mapError(error);
    } on Object catch (error) {
      throw AppFailure.unexpected(error.toString());
    }
  }

  /// Removes null query values so Dio does not serialise `?zoneId=null`.
  Map<String, Object?>? _clean(Map<String, Object?>? query) {
    if (query == null) return null;
    final Map<String, Object?> out = <String, Object?>{};
    query.forEach((String key, Object? value) {
      if (value != null) out[key] = value;
    });
    return out.isEmpty ? null : out;
  }

  AppFailure _mapError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionError:
        return const AppFailure.offline();
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return AppFailure.network(error.message ?? 'Request timed out');
      case DioExceptionType.cancel:
        return const AppFailure(code: 'CANCELLED', message: 'Request cancelled');
      case DioExceptionType.badCertificate:
        return AppFailure.network(error.message ?? 'Bad TLS certificate');
      case DioExceptionType.badResponse:
        return AppFailure.fromEnvelope(error.response?.data, error.response?.statusCode);
      case DioExceptionType.unknown:
        return error.error is FormatException
            ? const AppFailure(code: ErrorCode.internalError, message: 'Malformed response')
            : AppFailure.network(error.message ?? 'Network error');
    }
  }
}
