import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_partner/features/offers/domain/offer_countdown.dart';

/// The partner has seconds to decide on an offer, so the ring must never
/// promise time that is not there, and never read "0" while the offer can still
/// be accepted.
void main() {
  final DateTime received = DateTime.utc(2026, 3, 12, 18, 40, 0);
  final DateTime expires = received.add(const Duration(seconds: 20));
  final OfferCountdown countdown = OfferCountdown(receivedAt: received, expiresAt: expires);

  group('total', () {
    test('is the window this device actually had', () {
      expect(countdown.total, const Duration(seconds: 20));
    });

    test('is shortened when the offer reached the phone late', () {
      // Server TTL was 20 s but the push arrived 15 s in: the ring represents
      // the 5 s the partner really has, not the 20 s the server intended.
      final OfferCountdown late = OfferCountdown(
        receivedAt: received.add(const Duration(seconds: 15)),
        expiresAt: expires,
      );

      expect(late.total, const Duration(seconds: 5));
    });

    test('never goes negative for an offer that arrived after expiry', () {
      final OfferCountdown stale = OfferCountdown(
        receivedAt: expires.add(const Duration(seconds: 3)),
        expiresAt: expires,
      );

      expect(stale.total, Duration.zero);
      expect(stale.progress(expires), 0);
    });
  });

  group('remaining', () {
    test('counts down and clamps at zero', () {
      expect(countdown.remaining(received), const Duration(seconds: 20));
      expect(countdown.remaining(received.add(const Duration(seconds: 8))), const Duration(seconds: 12));
      expect(countdown.remaining(expires), Duration.zero);
      expect(countdown.remaining(expires.add(const Duration(minutes: 5))), Duration.zero);
    });

    test('isExpired flips exactly at the deadline', () {
      expect(countdown.isExpired(expires.subtract(const Duration(milliseconds: 1))), isFalse);
      expect(countdown.isExpired(expires), isTrue);
    });
  });

  group('progress', () {
    test('runs from 1.0 to 0.0 across the window', () {
      expect(countdown.progress(received), 1.0);
      expect(countdown.progress(received.add(const Duration(seconds: 10))), closeTo(0.5, 1e-9));
      expect(countdown.progress(expires), 0.0);
    });

    test('stays within bounds outside the window', () {
      expect(countdown.progress(received.subtract(const Duration(seconds: 5))), 1.0);
      expect(countdown.progress(expires.add(const Duration(seconds: 5))), 0.0);
    });
  });

  group('secondsLabel', () {
    test('rounds up so the last second reads 1, never a premature 0', () {
      expect(countdown.secondsLabel(expires.subtract(const Duration(milliseconds: 1))), 1);
      expect(countdown.secondsLabel(expires.subtract(const Duration(milliseconds: 999))), 1);
      expect(countdown.secondsLabel(expires.subtract(const Duration(milliseconds: 1001))), 2);
    });

    test('is 0 only once the offer is truly gone', () {
      expect(countdown.secondsLabel(expires), 0);
      expect(countdown.secondsLabel(expires.add(const Duration(seconds: 1))), 0);
    });

    test('shows the whole window at the moment of arrival', () {
      expect(countdown.secondsLabel(received), 20);
    });
  });

  group('isUrgent', () {
    test('turns on inside the last five seconds', () {
      expect(countdown.isUrgent(received), isFalse);
      expect(countdown.isUrgent(expires.subtract(const Duration(seconds: 6))), isFalse);
      expect(countdown.isUrgent(expires.subtract(const Duration(seconds: 5))), isTrue);
      expect(countdown.isUrgent(expires.subtract(const Duration(seconds: 1))), isTrue);
    });

    test('is off once expired — an expired offer is not urgent, it is gone', () {
      expect(countdown.isUrgent(expires), isFalse);
    });

    test('honours a custom urgent window', () {
      expect(
        countdown.isUrgent(expires.subtract(const Duration(seconds: 9)),
            urgentWindow: const Duration(seconds: 10)),
        isTrue,
      );
    });
  });
}
