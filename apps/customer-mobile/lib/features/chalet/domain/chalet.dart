import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/models/money.dart';

/// A chalet as a search result shows it (`ChaletSummaryDto`).
class ChaletSummary {
  const ChaletSummary({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.city,
    required this.location,
    required this.maximumGuests,
    required this.baseHourlyRate,
    required this.effectiveHourlyRate,
    required this.rating,
    required this.ratingCount,
    required this.instantBookingEnabled,
    this.coverUrl,
    this.activeOfferKind,
  });

  factory ChaletSummary.fromJson(JsonMap json) => ChaletSummary(
        id: readStringOr(json, 'id', ''),
        nameAr: readStringOr(json, 'nameAr', ''),
        nameEn: readStringOr(json, 'nameEn', ''),
        city: readStringOr(json, 'city', ''),
        location: GeoPoint.fromJson(asJsonMap(json['location']) ?? const <String, Object?>{}),
        maximumGuests: readIntOr(json, 'maximumGuests', 0),
        baseHourlyRate: Money.fromJson(asJsonMap(json['baseHourlyRate']) ?? const <String, Object?>{}),
        effectiveHourlyRate:
            Money.fromJson(asJsonMap(json['effectiveHourlyRate']) ?? const <String, Object?>{}),
        rating: readDoubleOr(json, 'rating', 0),
        ratingCount: readIntOr(json, 'ratingCount', 0),
        instantBookingEnabled: readBoolOr(json, 'instantBookingEnabled', true),
        coverUrl: readString(json, 'coverUrl'),
        activeOfferKind: ChaletOfferKind.fromValue(readString(json, 'activeOfferKind')),
      );

  final String id;
  final String nameAr;
  final String nameEn;
  final String city;
  final GeoPoint location;
  final int maximumGuests;
  final Money baseHourlyRate;

  /// What it costs right now. Below [baseHourlyRate] when an offer applies.
  final Money effectiveHourlyRate;
  final double rating;
  final int ratingCount;
  final bool instantBookingEnabled;
  final String? coverUrl;
  final ChaletOfferKind? activeOfferKind;

  bool get isDiscounted => effectiveHourlyRate.amount < baseHourlyRate.amount;
}

/// The scheduling rules of one chalet (`ChaletSchedulingDto`).
///
/// These are what the slot picker is built from: the grid every start sits on,
/// the shortest and longest stay, and the cleaning that follows every booking.
class ChaletScheduling {
  const ChaletScheduling({
    required this.openingTime,
    required this.closingTime,
    required this.bookingIntervalMinutes,
    required this.minimumBookingDurationMinutes,
    required this.maximumBookingDurationMinutes,
    required this.cleaningDurationMinutes,
    required this.holdDurationMinutes,
  });

  factory ChaletScheduling.fromJson(JsonMap json) => ChaletScheduling(
        openingTime: readStringOr(json, 'openingTime', '08:00'),
        closingTime: readStringOr(json, 'closingTime', '23:00'),
        bookingIntervalMinutes: readIntOr(json, 'bookingIntervalMinutes', 15),
        minimumBookingDurationMinutes: readIntOr(json, 'minimumBookingDurationMinutes', 60),
        maximumBookingDurationMinutes: readIntOr(json, 'maximumBookingDurationMinutes', 720),
        cleaningDurationMinutes: readIntOr(json, 'defaultCleaningDurationMinutes', 0),
        holdDurationMinutes: readIntOr(json, 'holdDurationMinutes', 7),
      );

  final String openingTime;
  final String closingTime;
  final int bookingIntervalMinutes;
  final int minimumBookingDurationMinutes;
  final int maximumBookingDurationMinutes;
  final int cleaningDurationMinutes;
  final int holdDurationMinutes;

  /// The durations the picker offers, from the shortest stay to the longest.
  List<int> get selectableDurations {
    final List<int> out = <int>[];
    for (
      int minutes = minimumBookingDurationMinutes;
      minutes <= maximumBookingDurationMinutes;
      minutes += bookingIntervalMinutes
    ) {
      out.add(minutes);
      if (out.length >= 48) break;
    }
    return out;
  }
}

/// A chalet in full (`ChaletDto`).
class ChaletDetail {
  const ChaletDetail({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.city,
    required this.addressLine,
    required this.location,
    required this.maximumGuests,
    required this.amenities,
    required this.photoUrls,
    required this.scheduling,
    required this.baseHourlyRate,
    required this.rating,
    required this.ratingCount,
    required this.instantBookingEnabled,
    this.descriptionAr,
    this.descriptionEn,
    this.minimumGuests,
  });

  factory ChaletDetail.fromJson(JsonMap json) {
    final JsonMap address = asJsonMap(json['address']) ?? const <String, Object?>{};
    final JsonMap pricing = asJsonMap(json['pricing']) ?? const <String, Object?>{};
    return ChaletDetail(
      id: readStringOr(json, 'id', ''),
      nameAr: readStringOr(json, 'nameAr', ''),
      nameEn: readStringOr(json, 'nameEn', ''),
      city: readStringOr(address, 'city', ''),
      addressLine: readStringOr(address, 'formatted', ''),
      location: GeoPoint.fromJson(address),
      maximumGuests: readIntOr(json, 'maximumGuests', 0),
      amenities: (json['amenities'] as List<Object?>? ?? const <Object?>[])
          .whereType<String>()
          .toList(growable: false),
      photoUrls: asJsonList(json['media'])
          .map((JsonMap m) => readStringOr(m, 'url', ''))
          .where((String url) => url.isNotEmpty)
          .toList(growable: false),
      scheduling: ChaletScheduling.fromJson(asJsonMap(json['scheduling']) ?? const <String, Object?>{}),
      baseHourlyRate:
          Money.fromJson(asJsonMap(pricing['baseHourlyRate']) ?? const <String, Object?>{}),
      rating: readDoubleOr(json, 'rating', 0),
      ratingCount: readIntOr(json, 'ratingCount', 0),
      instantBookingEnabled: readBoolOr(json, 'instantBookingEnabled', true),
      descriptionAr: readString(json, 'descriptionAr'),
      descriptionEn: readString(json, 'descriptionEn'),
      minimumGuests: readInt(json, 'minimumGuests'),
    );
  }

  final String id;
  final String nameAr;
  final String nameEn;
  final String city;
  final String addressLine;
  final GeoPoint location;
  final int maximumGuests;
  final List<String> amenities;
  final List<String> photoUrls;
  final ChaletScheduling scheduling;
  final Money baseHourlyRate;
  final double rating;
  final int ratingCount;
  final bool instantBookingEnabled;
  final String? descriptionAr;
  final String? descriptionEn;
  final int? minimumGuests;
}
