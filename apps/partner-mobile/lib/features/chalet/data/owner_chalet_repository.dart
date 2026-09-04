import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/network/api_client.dart';
import 'package:tamam_partner/core/network/api_paths.dart';
import 'package:tamam_partner/features/chalet/domain/owner_chalet.dart';

/// The owner's side of a chalet.
class OwnerChaletRepository {
  const OwnerChaletRepository(this._api);

  final ApiClient _api;

  Future<List<OwnerChalet>> myChalets() async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.ownerChalets);
    return raw.map(OwnerChalet.fromJson).toList(growable: false);
  }

  Future<ChaletOccupancy> occupancy(String chaletId, {required DateTime toDate}) async =>
      ChaletOccupancy.fromJson(await _api.getObject(
        ApiPaths.ownerChaletOccupancy(chaletId),
        query: <String, Object?>{'date': _day(toDate)},
      ));

  Future<List<OwnerBooking>> bookings(String chaletId, {String? status}) async {
    final List<JsonMap> raw = await _api.getList(
      ApiPaths.ownerChaletBookings(chaletId),
      query: <String, Object?>{if (status != null) 'status': status},
    );
    return raw.map(OwnerBooking.fromJson).toList(growable: false);
  }

  Future<List<ChaletGap>> gaps(String chaletId, {required DateTime date}) async {
    final List<JsonMap> raw = await _api.getList(
      ApiPaths.ownerChaletGaps(chaletId),
      query: <String, Object?>{'date': _day(date)},
    );
    return raw.map(ChaletGap.fromJson).toList(growable: false);
  }

  /// Record a booking taken over the phone or on another site.
  ///
  /// It occupies the calendar exactly like one made through TAMAM, which is
  /// what keeps this the only calendar the owner has to keep.
  Future<OwnerBooking> recordExternalBooking(
    String chaletId, {
    required DateTime startAt,
    required DateTime endAt,
    required int guestCount,
    required String guestName,
    String? guestPhone,
    int? totalAmountMinor,
    String? note,
  }) async =>
      OwnerBooking.fromJson(await _api.postObject(
        ApiPaths.ownerChaletExternalBooking(chaletId),
        body: <String, Object?>{
          'startAt': _instant(startAt),
          'endAt': _instant(endAt),
          'guestCount': guestCount,
          'guestName': guestName,
          if (guestPhone != null && guestPhone.isNotEmpty) 'guestPhone': guestPhone,
          if (totalAmountMinor != null) 'totalAmountMinor': totalAmountMinor,
          if (note != null && note.isNotEmpty) 'note': note,
        },
      ));

  /// Flip one automation switch. Only what is sent is changed.
  Future<JsonMap> setAutomation(String chaletId, Map<String, bool> switches) =>
      _api.patchObject(ApiPaths.ownerChaletAutomation(chaletId), body: switches);

  /// The API rejects an instant carrying seconds rather than truncating it.
  static String _instant(DateTime at) {
    final DateTime utc = at.toUtc();
    return DateTime.utc(utc.year, utc.month, utc.day, utc.hour, utc.minute).toIso8601String();
  }

  static String _day(DateTime at) =>
      '${at.year.toString().padLeft(4, '0')}-'
      '${at.month.toString().padLeft(2, '0')}-'
      '${at.day.toString().padLeft(2, '0')}';
}
