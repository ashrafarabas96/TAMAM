import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_customer/features/chalet/domain/chalet.dart';
import 'package:tamam_customer/features/chalet/domain/chalet_booking.dart';

void main() {
  group('ChaletScheduling', () {
    test('offers durations on the chalet’s own grid', () {
      const ChaletScheduling scheduling = ChaletScheduling(
        openingTime: '08:00',
        closingTime: '23:00',
        bookingIntervalMinutes: 15,
        minimumBookingDurationMinutes: 120,
        maximumBookingDurationMinutes: 240,
        cleaningDurationMinutes: 90,
        holdDurationMinutes: 7,
      );

      expect(scheduling.selectableDurations.first, 120);
      expect(scheduling.selectableDurations, contains(135));
      expect(scheduling.selectableDurations.last, 240);
    });

    test('never offers a duration the chalet does not allow', () {
      const ChaletScheduling scheduling = ChaletScheduling(
        openingTime: '08:00',
        closingTime: '23:00',
        bookingIntervalMinutes: 30,
        minimumBookingDurationMinutes: 120,
        maximumBookingDurationMinutes: 180,
        cleaningDurationMinutes: 0,
        holdDurationMinutes: 7,
      );
      expect(scheduling.selectableDurations, <int>[120, 150, 180]);
    });

    test('stops rather than listing a whole day of a very long window', () {
      const ChaletScheduling scheduling = ChaletScheduling(
        openingTime: '00:00',
        closingTime: '23:59',
        bookingIntervalMinutes: 15,
        minimumBookingDurationMinutes: 15,
        maximumBookingDurationMinutes: 10080,
        cleaningDurationMinutes: 0,
        holdDurationMinutes: 7,
      );
      expect(scheduling.selectableDurations.length, lessThanOrEqualTo(48));
    });
  });

  group('ChaletAvailability', () {
    test('reads the start times the server offered', () {
      final ChaletAvailability availability = ChaletAvailability.fromJson(<String, Object?>{
        'chaletId': 'c1',
        'date': '2026-10-01',
        'windows': <Object?>[
          <String, Object?>{
            'startAt': '2026-10-01T05:00:00.000Z',
            'endAt': '2026-10-01T09:00:00.000Z',
            'availableMinutes': 240,
            'isGap': true,
          },
        ],
        'suggestedStartTimes': <Object?>[
          '2026-10-01T05:00:00.000Z',
          '2026-10-01T05:15:00.000Z',
        ],
        'bookingIntervalMinutes': 15,
        'cleaningDurationMinutes': 90,
      });

      expect(availability.startTimes, hasLength(2));
      expect(availability.hasAnything, isTrue);
      expect(availability.windows.single.isGap, isTrue);
      expect(availability.cleaningDurationMinutes, 90);
    });

    test('reports a day with nothing free rather than crashing', () {
      final ChaletAvailability availability = ChaletAvailability.fromJson(<String, Object?>{
        'chaletId': 'c1',
        'date': '2026-10-01',
        'windows': <Object?>[],
        'suggestedStartTimes': <Object?>[],
      });
      expect(availability.hasAnything, isFalse);
      // Defaults rather than nulls: a missing field must never crash the app.
      expect(availability.bookingIntervalMinutes, 15);
    });
  });

  group('ChaletPrice', () {
    test('keeps every adjustment so the sheet can show the arithmetic', () {
      final ChaletPrice price = ChaletPrice.fromJson(<String, Object?>{
        'baseHourlyRate': <String, Object?>{'amount': 10000, 'currency': 'ILS'},
        'effectiveHourlyRate': <String, Object?>{'amount': 8000, 'currency': 'ILS'},
        'durationMinutes': 240,
        'subtotal': <String, Object?>{'amount': 32000, 'currency': 'ILS'},
        'adjustments': <Object?>[
          <String, Object?>{
            'label': 'Quiet week',
            'labelAr': 'إقبال منخفض هذا الأسبوع',
            'percent': -20,
            'amount': <String, Object?>{'amount': -8000, 'currency': 'ILS'},
          },
        ],
        'discount': <String, Object?>{'amount': 8000, 'currency': 'ILS'},
        'serviceFee': <String, Object?>{'amount': 0, 'currency': 'ILS'},
        'tax': <String, Object?>{'amount': 0, 'currency': 'ILS'},
        'deposit': <String, Object?>{'amount': 0, 'currency': 'ILS'},
        'total': <String, Object?>{'amount': 32000, 'currency': 'ILS'},
        'clampedToMinimum': false,
      });

      expect(price.isDiscounted, isTrue);
      expect(price.lines.single.isDiscount, isTrue);
      expect(price.lines.single.labelAr, 'إقبال منخفض هذا الأسبوع');
      expect(price.clampedToMinimum, isFalse);
    });

    test('carries the note that the owner’s floor set the price', () {
      final ChaletPrice price = ChaletPrice.fromJson(<String, Object?>{
        'baseHourlyRate': <String, Object?>{'amount': 10000, 'currency': 'ILS'},
        'effectiveHourlyRate': <String, Object?>{'amount': 10000, 'currency': 'ILS'},
        'total': <String, Object?>{'amount': 40000, 'currency': 'ILS'},
        'clampedToMinimum': true,
      });
      expect(price.clampedToMinimum, isTrue);
      expect(price.isDiscounted, isFalse);
    });
  });

  group('ChaletSlotCheck', () {
    test('carries the reason a window will not work', () {
      final ChaletSlotCheck check = ChaletSlotCheck.fromJson(<String, Object?>{
        'available': false,
        'reason': 'OVERLAPS_BOOKING',
        'alternatives': <Object?>[
          <String, Object?>{
            'startAt': '2026-10-01T11:30:00.000Z',
            'endAt': '2026-10-01T13:30:00.000Z',
            'availableMinutes': 120,
            'isGap': false,
          },
        ],
      });

      expect(check.available, isFalse);
      expect(check.reason, ChaletSlotReason.overlapsBooking);
      expect(check.alternatives, hasLength(1));
      expect(check.price, isNull);
    });

    test('falls back to free rather than crashing on an unknown reason', () {
      final ChaletSlotCheck check = ChaletSlotCheck.fromJson(<String, Object?>{
        'available': true,
        'reason': 'SOMETHING_NEW_FROM_THE_SERVER',
      });
      expect(check.reason, ChaletSlotReason.free);
    });
  });

  group('ChaletBooking', () {
    test('reads a held booking and the time left on it', () {
      final DateTime expiry = DateTime.now().add(const Duration(minutes: 5));
      // The shape the API actually sends: ChaletBookingDto, with the total
      // inside the price breakdown rather than as a bare column.
      final ChaletBooking booking = ChaletBooking.fromJson(<String, Object?>{
        'id': 'b1',
        'bookingNumber': 'CH-2610-000007',
        'chaletId': 'c1',
        'chaletNameAr': 'شاليه الريحان',
        'chaletNameEn': 'Al Rayhan Chalet',
        'startAt': '2026-10-01T09:00:00.000Z',
        'endAt': '2026-10-01T13:00:00.000Z',
        'blockedUntil': '2026-10-01T14:30:00.000Z',
        'guestCount': 4,
        'status': 'HELD',
        'price': <String, Object?>{
          'total': <String, Object?>{'amount': 40000, 'currency': 'ILS'},
          'effectiveHourlyRate': <String, Object?>{'amount': 10000, 'currency': 'ILS'},
          'baseHourlyRate': <String, Object?>{'amount': 10000, 'currency': 'ILS'},
          'durationMinutes': 240,
          'adjustments': <Object?>[],
          'clampedToMinimum': false,
        },
        'holdExpiresAt': expiry.toIso8601String(),
        'cleaningDurationMinutes': 90,
      });

      expect(booking.isHeld, isTrue);
      expect(booking.total.amount, 40000);
      expect(booking.chaletName, 'شاليه الريحان');
      expect(booking.price?.durationMinutes, 240);
      // The cleaning window is on the booking, so the app can say when the
      // slot is genuinely free again.
      expect(booking.blockedUntil?.difference(booking.endAt).inMinutes, 90);
      expect(booking.remainingHold(DateTime.now()).inMinutes, closeTo(4, 1));
    });

    test('survives a booking with no price breakdown', () {
      // An owner's phone booking has no TAMAM price to explain.
      final ChaletBooking booking = ChaletBooking.fromJson(<String, Object?>{
        'id': 'b1',
        'status': 'CONFIRMED',
      });
      expect(booking.price, isNull);
      expect(booking.total.amount, 0);
    });

    test('reports no time left once the hold has lapsed', () {
      final ChaletBooking booking = ChaletBooking.fromJson(<String, Object?>{
        'id': 'b1',
        'status': 'HELD',
        'holdExpiresAt': DateTime.now().subtract(const Duration(minutes: 1)).toIso8601String(),
      });
      expect(booking.remainingHold(DateTime.now()).isNegative, isTrue);
    });

    test('handles a confirmed booking, which has no hold left', () {
      final ChaletBooking booking = ChaletBooking.fromJson(<String, Object?>{
        'id': 'b1',
        'status': 'CONFIRMED',
        'holdExpiresAt': null,
      });
      expect(booking.isHeld, isFalse);
      expect(booking.remainingHold(DateTime.now()), Duration.zero);
    });
  });

  group('ChaletSummary', () {
    test('knows when an offer is what makes it cheaper', () {
      final ChaletSummary summary = ChaletSummary.fromJson(<String, Object?>{
        'id': 'c1',
        'nameAr': 'شاليه',
        'nameEn': 'Chalet',
        'city': 'Nablus',
        'location': <String, Object?>{'lat': 32.2, 'lng': 35.2},
        'maximumGuests': 20,
        'baseHourlyRate': <String, Object?>{'amount': 10000, 'currency': 'ILS'},
        'effectiveHourlyRate': <String, Object?>{'amount': 7500, 'currency': 'ILS'},
        'rating': 4.5,
        'ratingCount': 12,
        'instantBookingEnabled': true,
        'activeOfferKind': 'GAP_FILLER',
      });

      expect(summary.isDiscounted, isTrue);
      expect(summary.activeOfferKind?.value, 'GAP_FILLER');
    });

    test('survives a result with no cover photo and no ratings', () {
      final ChaletSummary summary = ChaletSummary.fromJson(<String, Object?>{
        'id': 'c1',
        'nameAr': 'شاليه',
        'nameEn': 'Chalet',
      });
      expect(summary.coverUrl, isNull);
      expect(summary.ratingCount, 0);
      expect(summary.isDiscounted, isFalse);
    });
  });
}
