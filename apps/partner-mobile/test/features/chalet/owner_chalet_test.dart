import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_partner/features/chalet/domain/owner_chalet.dart';

void main() {
  group('OwnerChalet', () {
    test('knows a live chalet from one still waiting', () {
      final OwnerChalet live = OwnerChalet.fromJson(<String, Object?>{
        'id': 'c1',
        'status': 'ACTIVE',
        'approvalStatus': 'APPROVED',
      });
      expect(live.isLive, isTrue);
      expect(live.awaitingApproval, isFalse);

      final OwnerChalet pending = OwnerChalet.fromJson(<String, Object?>{
        'id': 'c2',
        'status': 'DRAFT',
        'approvalStatus': 'PENDING',
      });
      expect(pending.isLive, isFalse);
      expect(pending.awaitingApproval, isTrue);
    });

    test('treats a chalet under review as still waiting', () {
      final OwnerChalet chalet = OwnerChalet.fromJson(<String, Object?>{
        'approvalStatus': 'UNDER_REVIEW',
      });
      expect(chalet.awaitingApproval, isTrue);
    });

    test('carries the rejection reason so an owner knows what to fix', () {
      final OwnerChalet chalet = OwnerChalet.fromJson(<String, Object?>{
        'approvalStatus': 'REJECTED',
        'rejectionReason': 'الصور غير واضحة',
      });
      expect(chalet.wasRejected, isTrue);
      expect(chalet.rejectionReason, 'الصور غير واضحة');
    });

    test('reads the floor separately from the base rate', () {
      final OwnerChalet chalet = OwnerChalet.fromJson(<String, Object?>{
        'baseHourlyRate': <String, Object?>{'amount': 12000, 'currency': 'ILS'},
        'minimumHourlyRate': <String, Object?>{'amount': 8000, 'currency': 'ILS'},
      });
      expect(chalet.baseHourlyRate.amount, 12000);
      expect(chalet.minimumHourlyRate.amount, 8000);
    });

    test('defaults the switches to off rather than crashing on a partial row', () {
      final OwnerChalet chalet = OwnerChalet.fromJson(<String, Object?>{'id': 'c1'});
      expect(chalet.smartPricingEnabled, isFalse);
      expect(chalet.gapFillerEnabled, isFalse);
      // Instant booking is on by default on the server, so it is here too.
      expect(chalet.instantBookingEnabled, isTrue);
    });
  });

  group('ChaletOccupancy', () {
    ChaletOccupancy build(List<int> minutesPerDay) => ChaletOccupancy.fromJson(<String, Object?>{
          'chaletId': 'c1',
          'fromDate': '2026-10-01',
          'toDate': '2026-10-30',
          'bookableMinutes': 27000,
          'bookedMinutes': minutesPerDay.fold<int>(0, (int a, int b) => a + b),
          'occupancyPercent': 40,
          'bookingCount': 6,
          'cancelledCount': 2,
          'revenue': <String, Object?>{'amount': 240000, 'currency': 'ILS'},
          'averageBookingDurationMinutes': 240,
          'averageHourlyRate': <String, Object?>{'amount': 10000, 'currency': 'ILS'},
          'byDayOfWeek': <Object?>[
            for (int day = 0; day < minutesPerDay.length; day++)
              <String, Object?>{
                'dayOfWeek': day,
                'bookedMinutes': minutesPerDay[day],
                'occupancyPercent': minutesPerDay[day] ~/ 10,
              },
          ],
          'byHourOfDay': <Object?>[
            for (int hour = 0; hour < 24; hour++)
              <String, Object?>{'hour': hour, 'bookedMinutes': hour == 12 ? 60 : 0},
          ],
        });

    test('reads the whole report', () {
      final ChaletOccupancy report = build(<int>[0, 120, 240, 60, 480, 300, 180]);
      expect(report.occupancyPercent, 40);
      expect(report.cancelledCount, 2);
      expect(report.byDayOfWeek, hasLength(7));
      expect(report.byHourOfDay, hasLength(24));
      expect(report.revenue.amount, 240000);
    });

    test('names the quietest day, which is what an owner would discount', () {
      final ChaletOccupancy report = build(<int>[0, 120, 240, 60, 480, 300, 180]);
      // Sunday sat empty.
      expect(report.quietestDay?.dayOfWeek, 0);
    });

    test('does not pretend to know a quietest day when there is no data', () {
      final ChaletOccupancy empty = ChaletOccupancy.fromJson(<String, Object?>{'chaletId': 'c1'});
      expect(empty.quietestDay, isNull);
      expect(empty.byDayOfWeek, isEmpty);
    });
  });

  group('OwnerBooking', () {
    test('tells a phone booking from one TAMAM brought', () {
      final OwnerBooking manual = OwnerBooking.fromJson(<String, Object?>{
        'source': 'OWNER_MANUAL',
        'guestName': 'أبو محمد',
      });
      expect(manual.isExternal, isTrue);

      final OwnerBooking viaTamam = OwnerBooking.fromJson(<String, Object?>{'source': 'TAMAM'});
      expect(viaTamam.isExternal, isFalse);
    });

    test('keeps blockedUntil separate from the booking’s own end', () {
      final OwnerBooking booking = OwnerBooking.fromJson(<String, Object?>{
        'startAt': '2026-10-01T09:00:00.000Z',
        'endAt': '2026-10-01T13:00:00.000Z',
        'blockedUntil': '2026-10-01T14:30:00.000Z',
        'cleaningDurationMinutes': 90,
      });
      // The slot is not free again until the cleaning is done.
      expect(booking.blockedUntil.difference(booking.endAt).inMinutes, 90);
    });
  });
}
