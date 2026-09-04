import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/models/money.dart';

/// One window a customer can book (`ChaletAvailabilityWindowDto`).
///
/// The API returns these already clear of other bookings, owner blocks and
/// cleaning buffers, so the app never subtracts anything itself.
class ChaletWindow {
  const ChaletWindow({
    required this.startAt,
    required this.endAt,
    required this.availableMinutes,
    required this.isGap,
  });

  factory ChaletWindow.fromJson(JsonMap json) => ChaletWindow(
        startAt: readDateTimeOr(json, 'startAt', DateTime.now()),
        endAt: readDateTimeOr(json, 'endAt', DateTime.now()),
        availableMinutes: readIntOr(json, 'availableMinutes', 0),
        isGap: readBoolOr(json, 'isGap', false),
      );

  final DateTime startAt;
  final DateTime endAt;
  final int availableMinutes;

  /// True when the window sits between two bookings — usually discounted.
  final bool isGap;
}

/// What can be booked on one day (`ChaletAvailabilityDto`).
class ChaletAvailability {
  const ChaletAvailability({
    required this.chaletId,
    required this.date,
    required this.windows,
    required this.startTimes,
    required this.bookingIntervalMinutes,
    required this.cleaningDurationMinutes,
  });

  factory ChaletAvailability.fromJson(JsonMap json) => ChaletAvailability(
        chaletId: readStringOr(json, 'chaletId', ''),
        date: readStringOr(json, 'date', ''),
        windows: asJsonList(json['windows']).map(ChaletWindow.fromJson).toList(growable: false),
        startTimes: (json['suggestedStartTimes'] as List<Object?>? ?? const <Object?>[])
            .whereType<String>()
            .map(DateTime.parse)
            .toList(growable: false),
        bookingIntervalMinutes: readIntOr(json, 'bookingIntervalMinutes', 15),
        cleaningDurationMinutes: readIntOr(json, 'cleaningDurationMinutes', 0),
      );

  final String chaletId;
  final String date;
  final List<ChaletWindow> windows;

  /// Start times that actually fit the requested length, on the chalet's grid.
  final List<DateTime> startTimes;
  final int bookingIntervalMinutes;
  final int cleaningDurationMinutes;

  bool get hasAnything => startTimes.isNotEmpty;
}

/// One line of a price, in words the customer can read.
class ChaletPriceLine {
  const ChaletPriceLine({
    required this.label,
    required this.labelAr,
    required this.percent,
    required this.amount,
  });

  factory ChaletPriceLine.fromJson(JsonMap json) => ChaletPriceLine(
        label: readStringOr(json, 'label', ''),
        labelAr: readStringOr(json, 'labelAr', ''),
        percent: readIntOr(json, 'percent', 0),
        amount: Money.fromJson(asJsonMap(json['amount']) ?? const <String, Object?>{}),
      );

  final String label;
  final String labelAr;
  final int percent;
  final Money amount;

  bool get isDiscount => amount.isNegative;
}

/// Why a booking costs what it does (`ChaletPriceBreakdownDto`).
///
/// Every component the API computed is kept, so the sheet can show the whole
/// arithmetic rather than a total the customer has to trust.
class ChaletPrice {
  const ChaletPrice({
    required this.baseHourlyRate,
    required this.effectiveHourlyRate,
    required this.durationMinutes,
    required this.subtotal,
    required this.lines,
    required this.discount,
    required this.serviceFee,
    required this.tax,
    required this.deposit,
    required this.total,
    required this.clampedToMinimum,
  });

  factory ChaletPrice.fromJson(JsonMap json) => ChaletPrice(
        baseHourlyRate: Money.fromJson(asJsonMap(json['baseHourlyRate']) ?? const <String, Object?>{}),
        effectiveHourlyRate:
            Money.fromJson(asJsonMap(json['effectiveHourlyRate']) ?? const <String, Object?>{}),
        durationMinutes: readIntOr(json, 'durationMinutes', 0),
        subtotal: Money.fromJson(asJsonMap(json['subtotal']) ?? const <String, Object?>{}),
        lines: asJsonList(json['adjustments']).map(ChaletPriceLine.fromJson).toList(growable: false),
        discount: Money.fromJson(asJsonMap(json['discount']) ?? const <String, Object?>{}),
        serviceFee: Money.fromJson(asJsonMap(json['serviceFee']) ?? const <String, Object?>{}),
        tax: Money.fromJson(asJsonMap(json['tax']) ?? const <String, Object?>{}),
        deposit: Money.fromJson(asJsonMap(json['deposit']) ?? const <String, Object?>{}),
        total: Money.fromJson(asJsonMap(json['total']) ?? const <String, Object?>{}),
        clampedToMinimum: readBoolOr(json, 'clampedToMinimum', false),
      );

  final Money baseHourlyRate;
  final Money effectiveHourlyRate;
  final int durationMinutes;
  final Money subtotal;
  final List<ChaletPriceLine> lines;
  final Money discount;
  final Money serviceFee;
  final Money tax;
  final Money deposit;
  final Money total;

  /// True when the owner's own minimum rate is what set the price.
  final bool clampedToMinimum;

  bool get isDiscounted => effectiveHourlyRate.amount < baseHourlyRate.amount;
}

/// Why a requested window will not work.
enum ChaletSlotReason {
  free('FREE'),
  overlapsBooking('OVERLAPS_BOOKING'),
  overlapsBlock('OVERLAPS_BLOCK'),
  outsideHours('OUTSIDE_HOURS'),
  durationOutOfBounds('DURATION_OUT_OF_BOUNDS'),
  notOnInterval('NOT_ON_INTERVAL');

  const ChaletSlotReason(this.value);

  final String value;

  static ChaletSlotReason fromValue(String? value) {
    for (final ChaletSlotReason reason in ChaletSlotReason.values) {
      if (reason.value == value) return reason;
    }
    return ChaletSlotReason.free;
  }
}

/// The answer to "can I book exactly this?" (`ChaletSlotCheckDto`).
class ChaletSlotCheck {
  const ChaletSlotCheck({
    required this.available,
    required this.reason,
    required this.alternatives,
    this.price,
  });

  factory ChaletSlotCheck.fromJson(JsonMap json) => ChaletSlotCheck(
        available: readBoolOr(json, 'available', false),
        reason: ChaletSlotReason.fromValue(readString(json, 'reason')),
        alternatives:
            asJsonList(json['alternatives']).map(ChaletWindow.fromJson).toList(growable: false),
        price: asJsonMap(json['price']) == null
            ? null
            : ChaletPrice.fromJson(asJsonMap(json['price'])!),
      );

  final bool available;
  final ChaletSlotReason reason;

  /// Nearby windows that would work. Shown when the requested one will not.
  final List<ChaletWindow> alternatives;
  final ChaletPrice? price;
}

/// A booking the customer has made (`ChaletBookingDto` and the raw booking row).
class ChaletBooking {
  const ChaletBooking({
    required this.id,
    required this.bookingNumber,
    required this.chaletId,
    required this.startAt,
    required this.endAt,
    required this.guestCount,
    required this.status,
    required this.total,
    this.chaletName = '',
    this.price,
    this.holdExpiresAt,
    this.cleaningDurationMinutes = 0,
    this.blockedUntil,
  });

  factory ChaletBooking.fromJson(JsonMap json) {
    // The API sends ChaletBookingDto: the total lives inside the price
    // breakdown, not as a bare minor-unit column on the row.
    final JsonMap? price = asJsonMap(json['price']);
    return ChaletBooking(
      id: readStringOr(json, 'id', ''),
      bookingNumber: readStringOr(json, 'bookingNumber', ''),
      chaletId: readStringOr(json, 'chaletId', ''),
      chaletName: readStringOr(json, 'chaletNameAr', ''),
      startAt: readDateTimeOr(json, 'startAt', DateTime.now()),
      endAt: readDateTimeOr(json, 'endAt', DateTime.now()),
      guestCount: readIntOr(json, 'guestCount', 1),
      status:
          ChaletBookingStatus.fromValue(readString(json, 'status')) ?? ChaletBookingStatus.draft,
      total: price == null
          ? const Money.zero('ILS')
          : Money.fromJson(asJsonMap(price['total']) ?? const <String, Object?>{}),
      price: price == null ? null : ChaletPrice.fromJson(price),
      holdExpiresAt: readDateTime(json, 'holdExpiresAt'),
      cleaningDurationMinutes: readIntOr(json, 'cleaningDurationMinutes', 0),
      blockedUntil: readDateTime(json, 'blockedUntil'),
    );
  }

  final String id;
  final String bookingNumber;
  final String chaletId;
  final String chaletName;
  final DateTime startAt;
  final DateTime endAt;
  final int guestCount;
  final ChaletBookingStatus status;
  final Money total;

  /// The whole breakdown, frozen at the time of booking.
  final ChaletPrice? price;

  /// Set only while the booking is held. The countdown the customer sees.
  final DateTime? holdExpiresAt;
  final int cleaningDurationMinutes;

  /// When the slot is free again — the booking plus its cleaning.
  final DateTime? blockedUntil;

  /// How long is left to pay. Negative once the hold has lapsed.
  Duration remainingHold(DateTime now) =>
      holdExpiresAt == null ? Duration.zero : holdExpiresAt!.difference(now);

  bool get isHeld => status == ChaletBookingStatus.held;
}
