import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/models/money.dart';

/// One chalet as its owner sees it.
///
/// Includes the ones still waiting for approval, because "where is my chalet?"
/// is exactly the question an owner asks the day after submitting one.
class OwnerChalet {
  const OwnerChalet({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.city,
    required this.status,
    required this.approvalStatus,
    required this.maximumGuests,
    required this.baseHourlyRate,
    required this.minimumHourlyRate,
    required this.smartPricingEnabled,
    required this.gapFillerEnabled,
    required this.lastMinutePricingEnabled,
    required this.autoExtensionOffersEnabled,
    required this.instantBookingEnabled,
    required this.rating,
    required this.ratingCount,
    this.rejectionReason,
  });

  factory OwnerChalet.fromJson(JsonMap json) => OwnerChalet(
        id: readStringOr(json, 'id', ''),
        nameAr: readStringOr(json, 'nameAr', ''),
        nameEn: readStringOr(json, 'nameEn', ''),
        city: readStringOr(json, 'city', ''),
        status: readStringOr(json, 'status', 'DRAFT'),
        approvalStatus: readStringOr(json, 'approvalStatus', 'DRAFT'),
        maximumGuests: readIntOr(json, 'maximumGuests', 0),
        baseHourlyRate: Money.fromJson(asJsonMap(json['baseHourlyRate']) ?? const <String, Object?>{}),
        minimumHourlyRate:
            Money.fromJson(asJsonMap(json['minimumHourlyRate']) ?? const <String, Object?>{}),
        smartPricingEnabled: readBoolOr(json, 'smartPricingEnabled', false),
        gapFillerEnabled: readBoolOr(json, 'gapFillerEnabled', false),
        lastMinutePricingEnabled: readBoolOr(json, 'lastMinutePricingEnabled', false),
        autoExtensionOffersEnabled: readBoolOr(json, 'autoExtensionOffersEnabled', false),
        instantBookingEnabled: readBoolOr(json, 'instantBookingEnabled', true),
        rating: readDoubleOr(json, 'rating', 0),
        ratingCount: readIntOr(json, 'ratingCount', 0),
        rejectionReason: readString(json, 'rejectionReason'),
      );

  final String id;
  final String nameAr;
  final String nameEn;
  final String city;
  final String status;
  final String approvalStatus;
  final int maximumGuests;
  final Money baseHourlyRate;

  /// The floor the owner set. Smart Pricing never quotes below it.
  final Money minimumHourlyRate;
  final bool smartPricingEnabled;
  final bool gapFillerEnabled;
  final bool lastMinutePricingEnabled;
  final bool autoExtensionOffersEnabled;
  final bool instantBookingEnabled;
  final double rating;
  final int ratingCount;
  final String? rejectionReason;

  bool get isLive => status == 'ACTIVE' && approvalStatus == 'APPROVED';
  bool get awaitingApproval => approvalStatus == 'PENDING' || approvalStatus == 'UNDER_REVIEW';
  bool get wasRejected => approvalStatus == 'REJECTED';
}

/// Whether the chalet is earning, and where the empty hours are.
class ChaletOccupancy {
  const ChaletOccupancy({
    required this.chaletId,
    required this.fromDate,
    required this.toDate,
    required this.bookableMinutes,
    required this.bookedMinutes,
    required this.occupancyPercent,
    required this.bookingCount,
    required this.cancelledCount,
    required this.revenue,
    required this.averageBookingDurationMinutes,
    required this.averageHourlyRate,
    required this.byDayOfWeek,
    required this.byHourOfDay,
  });

  factory ChaletOccupancy.fromJson(JsonMap json) => ChaletOccupancy(
        chaletId: readStringOr(json, 'chaletId', ''),
        fromDate: readStringOr(json, 'fromDate', ''),
        toDate: readStringOr(json, 'toDate', ''),
        bookableMinutes: readIntOr(json, 'bookableMinutes', 0),
        bookedMinutes: readIntOr(json, 'bookedMinutes', 0),
        occupancyPercent: readIntOr(json, 'occupancyPercent', 0),
        bookingCount: readIntOr(json, 'bookingCount', 0),
        cancelledCount: readIntOr(json, 'cancelledCount', 0),
        revenue: Money.fromJson(asJsonMap(json['revenue']) ?? const <String, Object?>{}),
        averageBookingDurationMinutes: readIntOr(json, 'averageBookingDurationMinutes', 0),
        averageHourlyRate:
            Money.fromJson(asJsonMap(json['averageHourlyRate']) ?? const <String, Object?>{}),
        byDayOfWeek: asJsonList(json['byDayOfWeek'])
            .map(ChaletDayStat.fromJson)
            .toList(growable: false),
        byHourOfDay: asJsonList(json['byHourOfDay'])
            .map(ChaletHourStat.fromJson)
            .toList(growable: false),
      );

  final String chaletId;
  final String fromDate;
  final String toDate;

  /// Minutes the chalet was open for. Occupancy is measured against this rather
  /// than the whole day, so closing overnight does not read as empty.
  final int bookableMinutes;
  final int bookedMinutes;
  final int occupancyPercent;
  final int bookingCount;

  /// Counted separately: losing a quarter of your bookings is invisible in an
  /// occupancy percentage, and an owner needs to see it.
  final int cancelledCount;
  final Money revenue;
  final int averageBookingDurationMinutes;
  final Money averageHourlyRate;
  final List<ChaletDayStat> byDayOfWeek;
  final List<ChaletHourStat> byHourOfDay;

  /// The weekday that earns least. What an owner would discount first.
  ChaletDayStat? get quietestDay {
    if (byDayOfWeek.isEmpty) return null;
    return byDayOfWeek.reduce(
      (ChaletDayStat a, ChaletDayStat b) => a.bookedMinutes <= b.bookedMinutes ? a : b,
    );
  }
}

class ChaletDayStat {
  const ChaletDayStat({
    required this.dayOfWeek,
    required this.bookedMinutes,
    required this.occupancyPercent,
  });

  factory ChaletDayStat.fromJson(JsonMap json) => ChaletDayStat(
        dayOfWeek: readIntOr(json, 'dayOfWeek', 0),
        bookedMinutes: readIntOr(json, 'bookedMinutes', 0),
        occupancyPercent: readIntOr(json, 'occupancyPercent', 0),
      );

  /// 0 is Sunday, matching the server.
  final int dayOfWeek;
  final int bookedMinutes;
  final int occupancyPercent;
}

class ChaletHourStat {
  const ChaletHourStat({required this.hour, required this.bookedMinutes});

  factory ChaletHourStat.fromJson(JsonMap json) => ChaletHourStat(
        hour: readIntOr(json, 'hour', 0),
        bookedMinutes: readIntOr(json, 'bookedMinutes', 0),
      );

  final int hour;
  final int bookedMinutes;
}

/// A booking on the owner's calendar, whoever made it.
class OwnerBooking {
  const OwnerBooking({
    required this.id,
    required this.bookingNumber,
    required this.startAt,
    required this.endAt,
    required this.blockedUntil,
    required this.guestCount,
    required this.status,
    required this.source,
    required this.total,
    required this.cleaningDurationMinutes,
    this.guestName,
    this.guestPhone,
  });

  factory OwnerBooking.fromJson(JsonMap json) => OwnerBooking(
        id: readStringOr(json, 'id', ''),
        bookingNumber: readStringOr(json, 'bookingNumber', ''),
        startAt: readDateTimeOr(json, 'startAt', DateTime.now()),
        endAt: readDateTimeOr(json, 'endAt', DateTime.now()),
        blockedUntil: readDateTimeOr(json, 'blockedUntil', DateTime.now()),
        guestCount: readIntOr(json, 'guestCount', 0),
        status: readStringOr(json, 'status', 'DRAFT'),
        source: readStringOr(json, 'source', 'TAMAM'),
        total: Money.fromJson(asJsonMap(json['total']) ?? const <String, Object?>{}),
        cleaningDurationMinutes: readIntOr(json, 'cleaningDurationMinutes', 0),
        guestName: readString(json, 'guestName'),
        guestPhone: readString(json, 'guestPhone'),
      );

  final String id;
  final String bookingNumber;
  final DateTime startAt;
  final DateTime endAt;

  /// When the slot is actually free again — the booking plus its cleaning.
  final DateTime blockedUntil;
  final int guestCount;
  final String status;

  /// TAMAM, OWNER_MANUAL or ADMIN. Shown so an owner can tell their own phone
  /// bookings from the ones the platform brought them.
  final String source;
  final Money total;
  final int cleaningDurationMinutes;
  final String? guestName;
  final String? guestPhone;

  bool get isExternal => source != 'TAMAM';
}

/// A stretch of empty time boxed in between two bookings.
class ChaletGap {
  const ChaletGap({required this.startAt, required this.endAt, required this.availableMinutes});

  factory ChaletGap.fromJson(JsonMap json) => ChaletGap(
        startAt: readDateTimeOr(json, 'startAt', DateTime.now()),
        endAt: readDateTimeOr(json, 'endAt', DateTime.now()),
        availableMinutes: readIntOr(json, 'availableMinutes', 0),
      );

  final DateTime startAt;
  final DateTime endAt;
  final int availableMinutes;
}
