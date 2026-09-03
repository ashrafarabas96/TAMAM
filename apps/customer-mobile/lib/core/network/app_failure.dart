import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/json.dart';

/// One field-level validation problem from `details`.
class FieldError {
  const FieldError({required this.field, required this.message});

  final String field;
  final String message;
}

/// Every failure surfaced to the UI, mapped from the API envelope
/// `{ code, message, details, requestId }` (spec §101).
///
/// Widgets never inspect HTTP status codes — they branch on [code], which is a
/// stable part of the contract, and fall back to [message] for anything the app
/// does not translate itself.
class AppFailure implements Exception {
  const AppFailure({
    required this.code,
    required this.message,
    this.fieldErrors = const <FieldError>[],
    this.details,
    this.requestId,
    this.statusCode,
  });

  /// Synthesised when the device has no usable connection.
  const AppFailure.offline()
      : code = offlineCode,
        message = 'No internet connection',
        fieldErrors = const <FieldError>[],
        details = null,
        requestId = null,
        statusCode = null;

  /// Synthesised when the request timed out or the socket died mid-flight.
  const AppFailure.network(this.message)
      : code = networkCode,
        fieldErrors = const <FieldError>[],
        details = null,
        requestId = null,
        statusCode = null;

  /// Synthesised for anything the client itself could not handle.
  const AppFailure.unexpected(this.message)
      : code = ErrorCode.internalError,
        fieldErrors = const <FieldError>[],
        details = null,
        requestId = null,
        statusCode = null;

  /// Parses the API error envelope. Falls back to a generic internal error when
  /// a proxy or gateway returns something that is not our envelope.
  factory AppFailure.fromEnvelope(Object? body, int? statusCode) {
    final JsonMap? json = asJsonMap(body);
    if (json == null) {
      return AppFailure(
        code: _codeForStatus(statusCode),
        message: 'Request failed',
        statusCode: statusCode,
      );
    }
    final Object? rawDetails = json['details'];
    return AppFailure(
      code: readStringOr(json, 'code', _codeForStatus(statusCode)),
      message: readStringOr(json, 'message', 'Request failed'),
      fieldErrors: _parseFieldErrors(rawDetails),
      details: asJsonMap(rawDetails),
      requestId: readString(json, 'requestId'),
      statusCode: statusCode,
    );
  }

  static const String offlineCode = 'OFFLINE';
  static const String networkCode = 'NETWORK_ERROR';

  final String code;
  final String message;
  final List<FieldError> fieldErrors;
  final JsonMap? details;
  final String? requestId;
  final int? statusCode;

  bool get isOffline => code == offlineCode;
  bool get isNetwork => code == offlineCode || code == networkCode;
  bool get isAuth => code == ErrorCode.unauthenticated || code == ErrorCode.tokenExpired || code == ErrorCode.tokenRevoked;
  bool get isNotFound => code == ErrorCode.notFound;
  bool get isVersionConflict => code == ErrorCode.versionConflict;

  /// `true` when retrying the exact same request could succeed.
  bool get isRetryable => isNetwork || statusCode == null || (statusCode! >= 500);

  /// The first message for [field], used to decorate text inputs.
  String? errorFor(String field) {
    for (final FieldError error in fieldErrors) {
      if (error.field == field || error.field.endsWith('.$field')) return error.message;
    }
    return null;
  }

  static List<FieldError> _parseFieldErrors(Object? details) {
    if (details is! List) return const <FieldError>[];
    final List<FieldError> out = <FieldError>[];
    for (final Object? entry in details) {
      final JsonMap? map = asJsonMap(entry);
      if (map == null) continue;
      final String? field = readString(map, 'field');
      final String? message = readString(map, 'message');
      if (field != null && message != null) out.add(FieldError(field: field, message: message));
    }
    return out;
  }

  static String _codeForStatus(int? status) {
    switch (status) {
      case 400:
        return ErrorCode.validationFailed;
      case 401:
        return ErrorCode.unauthenticated;
      case 403:
        return ErrorCode.forbidden;
      case 404:
        return ErrorCode.notFound;
      case 409:
        return ErrorCode.conflict;
      case 429:
        return ErrorCode.rateLimited;
      default:
        return ErrorCode.internalError;
    }
  }

  @override
  String toString() => 'AppFailure($code): $message';
}
