import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_customer/features/service/presentation/widgets/service_timing_picker.dart';

import '../support/harness.dart';

/// "Now" or "book a time" is decided per category in the console; the picker
/// must show exactly what the operator allowed and report the choice back.
void main() {
  testWidgets('offers both choices, with "now" selected by default',
      (WidgetTester tester) async {
    String? gotDate = 'unset';
    await pumpAppWidget(
      tester,
      ServiceTimingPicker(
        allowsInstant: true,
        allowsScheduled: true,
        preferredDate: null,
        preferredTimeSlot: null,
        onChanged: ({String? date, String? slot}) => gotDate = date,
      ),
      overrides: await testOverrides(),
    );

    expect(find.text('فوري — الآن'), findsOneWidget);
    expect(find.text('حجز موعد'), findsOneWidget);
    // Neither restriction note appears when both are allowed.
    expect(find.textContaining('فقط'), findsNothing);

    await tester.tap(find.byKey(const Key('service-timing-instant')));
    expect(gotDate, isNull);
  });

  testWidgets('says so when a category is schedule-only and disables "now"',
      (WidgetTester tester) async {
    int calls = 0;
    await pumpAppWidget(
      tester,
      ServiceTimingPicker(
        allowsInstant: false,
        allowsScheduled: true,
        preferredDate: '2026-10-01',
        preferredTimeSlot: 'MORNING',
        onChanged: ({String? date, String? slot}) => calls++,
      ),
      overrides: await testOverrides(),
    );

    expect(find.text('هذه الخدمة تُحجز بموعد مسبق.'), findsOneWidget);
    expect(find.text('2026-10-01'), findsOneWidget);
    expect(find.text('صباحًا'), findsOneWidget);

    // A disabled choice swallows the tap instead of switching to "now".
    await tester.tap(find.byKey(const Key('service-timing-instant')));
    await tester.pump();
    expect(calls, 0);

    await tester.tap(find.text('مساءً'));
    expect(calls, 1);
  });

  testWidgets('says so when a category is instant-only',
      (WidgetTester tester) async {
    await pumpAppWidget(
      tester,
      ServiceTimingPicker(
        allowsInstant: true,
        allowsScheduled: false,
        preferredDate: null,
        preferredTimeSlot: null,
        onChanged: ({String? date, String? slot}) {},
      ),
      overrides: await testOverrides(),
    );
    expect(find.text('هذه الخدمة تُطلب فوراً فقط.'), findsOneWidget);
  });
}
