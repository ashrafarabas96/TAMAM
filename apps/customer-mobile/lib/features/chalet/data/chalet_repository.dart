import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/api_client.dart';
import 'package:tamam_customer/core/network/api_paths.dart';
import 'package:tamam_customer/features/chalet/domain/chalet.dart';
import 'package:tamam_customer/features/chalet/domain/chalet_booking.dart';

/// Everything the chalet screens ask the API for.
///
/// Availability, prices and the free/taken verdict all come from the server.
/// The app never works out whether a slot is free — the cleaning buffers, the
/// booking grid and the owner's own opening hours live there, and a second
/// implementation here would drift from them.
class ChaletRepository {
  const ChaletRepository(this._api);

  final ApiClient _api;

  Future<List<ChaletSummary>> search({
    String? city,
    int? guestCount,
    DateTime? startAt,
    DateTime? endAt,
    int? maxHourlyRateMinor,
  }) async {
    final JsonMap page = await _api.getObject(
      ApiPaths.chalets,
      query: <String, Object?>{
        if (city != null && city.isNotEmpty) 'city': city,
        if (guestCount != null) 'guestCount': guestCount,
        if (startAt != null) 'startAt': _instant(startAt),
        if (endAt != null) 'endAt': _instant(endAt),
        if (maxHourlyRateMinor != null) 'maxHourlyRateMinor': maxHourlyRateMinor,
      },
    );
    return asJsonList(page['items']).map(ChaletSummary.fromJson).toList(growable: false);
  }

  Future<ChaletDetail> detail(String chaletId) async =>
      ChaletDetail.fromJson(await _api.getObject(ApiPaths.chalet(chaletId)));

  Future<ChaletAvailability> availability(
    String chaletId, {
    required DateTime date,
    int? durationMinutes,
  }) async {
    final JsonMap json = await _api.getObject(
      ApiPaths.chaletAvailability(chaletId),
      query: <String, Object?>{
        'date': _day(date),
        if (durationMinutes != null) 'durationMinutes': durationMinutes,
      },
    );
    return ChaletAvailability.fromJson(json);
  }

  Future<ChaletSlotCheck> checkSlot(
    String chaletId, {
    required DateTime startAt,
    required DateTime endAt,
  }) async {
    final JsonMap json = await _api.getObject(
      ApiPaths.chaletSlotCheck(chaletId),
      query: <String, Object?>{'startAt': _instant(startAt), 'endAt': _instant(endAt)},
    );
    return ChaletSlotCheck.fromJson(json);
  }

  Future<ChaletBooking> hold({
    required String chaletId,
    required DateTime startAt,
    required DateTime endAt,
    required int guestCount,
    String? offerId,
  }) async {
    final JsonMap json = await _api.postObject(
      ApiPaths.chaletBookings,
      body: <String, Object?>{
        'chaletId': chaletId,
        'startAt': _instant(startAt),
        'endAt': _instant(endAt),
        'guestCount': guestCount,
        if (offerId != null) 'offerId': offerId,
      },
    );
    return ChaletBooking.fromJson(json);
  }

  Future<ChaletBooking> confirm(String bookingId) async =>
      ChaletBooking.fromJson(await _api.postObject(ApiPaths.chaletBookingConfirm(bookingId)));

  Future<void> cancel(String bookingId, String reason) =>
      _api.postObject(ApiPaths.chaletBookingCancel(bookingId), body: <String, Object?>{'reason': reason});

  /// The API rejects an instant carrying seconds rather than truncating it, so
  /// the app trims them here instead of discovering it at the 422.
  static String _instant(DateTime at) {
    final DateTime utc = at.toUtc();
    return DateTime.utc(utc.year, utc.month, utc.day, utc.hour, utc.minute).toIso8601String();
  }

  static String _day(DateTime at) =>
      '${at.year.toString().padLeft(4, '0')}-'
      '${at.month.toString().padLeft(2, '0')}-'
      '${at.day.toString().padLeft(2, '0')}';
}
