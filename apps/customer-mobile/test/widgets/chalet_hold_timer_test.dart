import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_customer/features/chalet/presentation/widgets/chalet_hold_timer.dart';

import '../support/harness.dart';

/// A clock the test moves by hand, so the countdown can be driven without
/// waiting in real time.
class _TestClock {
  _TestClock(this._now);

  DateTime _now;

  DateTime call() => _now;

  void advance(Duration by) => _now = _now.add(by);
}

void main() {
  group('formatRemaining', () {
    test('reads as a countdown, with the seconds padded', () {
      expect(formatRemaining(const Duration(minutes: 6, seconds: 5)), '6:05');
      expect(formatRemaining(const Duration(minutes: 0, seconds: 9)), '0:09');
      expect(formatRemaining(Duration.zero), '0:00');
    });
  });

  group('ChaletHoldTimer', () {
    testWidgets('counts down while the hold is live', (WidgetTester tester) async {
      final DateTime start = DateTime(2026, 10, 1, 12);
      final _TestClock clock = _TestClock(start);

      await pumpAppWidget(
        tester,
        ChaletHoldTimer(expiresAt: start.add(const Duration(minutes: 7)), now: clock),
        overrides: await testOverrides(),
      );
      expect(find.textContaining('7:00'), findsOneWidget);

      clock.advance(const Duration(seconds: 65));
      await tester.pump(const Duration(seconds: 1));
      expect(find.textContaining('5:55'), findsOneWidget);
    });

    testWidgets('says so when the hold runs out, and reports it once', (WidgetTester tester) async {
      final DateTime start = DateTime(2026, 10, 1, 12);
      final _TestClock clock = _TestClock(start);
      int expiredCalls = 0;

      await pumpAppWidget(
        tester,
        ChaletHoldTimer(
          expiresAt: start.add(const Duration(seconds: 2)),
          onExpired: () => expiredCalls += 1,
          now: clock,
        ),
        overrides: await testOverrides(),
      );

      clock.advance(const Duration(seconds: 3));
      await tester.pump(const Duration(seconds: 1));
      expect(expiredCalls, 1);

      // The ticker cancels itself, so waiting longer must not report again.
      clock.advance(const Duration(seconds: 30));
      await tester.pump(const Duration(seconds: 5));
      expect(expiredCalls, 1);
    });

    testWidgets('shows a hold that had already lapsed as expired', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        ChaletHoldTimer(
          expiresAt: DateTime(2026, 10, 1, 12),
          now: _TestClock(DateTime(2026, 10, 1, 12, 1)),
        ),
        overrides: await testOverrides(),
      );
      // No countdown is shown once there is nothing to count.
      expect(find.textContaining(':'), findsNothing);
    });

    testWidgets('stops ticking when it leaves the tree', (WidgetTester tester) async {
      // A timer left running past dispose is what makes a test suite fail with
      // "a Timer is still pending" — and, in the app, keeps a disposed widget
      // rebuilding for the rest of the session.
      await pumpAppWidget(
        tester,
        ChaletHoldTimer(expiresAt: DateTime.now().add(const Duration(minutes: 5))),
        overrides: await testOverrides(),
      );
      await pumpAppWidget(tester, const SizedBox.shrink(), overrides: await testOverrides());
      await tester.pump(const Duration(seconds: 2));
    });
  });
}
