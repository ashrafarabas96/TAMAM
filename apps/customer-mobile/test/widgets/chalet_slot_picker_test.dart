import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_customer/features/chalet/domain/chalet.dart';
import 'package:tamam_customer/features/chalet/domain/chalet_booking.dart';
import 'package:tamam_customer/features/chalet/presentation/widgets/chalet_slot_picker.dart';

import '../support/harness.dart';

const ChaletScheduling _scheduling = ChaletScheduling(
  openingTime: '08:00',
  closingTime: '23:00',
  bookingIntervalMinutes: 15,
  minimumBookingDurationMinutes: 120,
  maximumBookingDurationMinutes: 240,
  cleaningDurationMinutes: 90,
  holdDurationMinutes: 7,
);

ChaletAvailability _availability(List<String> starts) => ChaletAvailability(
      chaletId: 'c1',
      date: '2026-10-01',
      windows: const <ChaletWindow>[],
      startTimes: starts.map(DateTime.parse).toList(growable: false),
      bookingIntervalMinutes: 15,
      cleaningDurationMinutes: 90,
    );

void main() {
  group('ChaletSlotPicker', () {
    testWidgets('offers exactly the times the server said would work', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        ChaletSlotPicker(
          availability: _availability(<String>[
            '2026-10-01T06:00:00.000Z',
            '2026-10-01T06:15:00.000Z',
            '2026-10-01T06:30:00.000Z',
          ]),
          scheduling: _scheduling,
          selectedStart: null,
          onSelect: (_) {},
        ),
        overrides: await testOverrides(),
      );

      // Three chips, no more: the picker never invents a time of its own.
      expect(find.byType(InkWell), findsNWidgets(3));
    });

    testWidgets('reports the chosen time back', (WidgetTester tester) async {
      DateTime? chosen;
      await pumpAppWidget(
        tester,
        ChaletSlotPicker(
          availability: _availability(<String>['2026-10-01T06:00:00.000Z']),
          scheduling: _scheduling,
          selectedStart: null,
          onSelect: (DateTime at) => chosen = at,
        ),
        overrides: await testOverrides(),
      );

      await tester.tap(find.byType(InkWell).first);
      await tester.pump();
      expect(chosen, DateTime.parse('2026-10-01T06:00:00.000Z'));
    });

    testWidgets('tells the customer the cleaning time is not bookable', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        ChaletSlotPicker(
          availability: _availability(<String>['2026-10-01T06:00:00.000Z']),
          scheduling: _scheduling,
          selectedStart: null,
          onSelect: (_) {},
        ),
        overrides: await testOverrides(),
      );
      expect(find.textContaining('90'), findsOneWidget);
    });

    testWidgets('says nothing about cleaning when there is none', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        ChaletSlotPicker(
          availability: _availability(<String>['2026-10-01T06:00:00.000Z']),
          scheduling: const ChaletScheduling(
            openingTime: '08:00',
            closingTime: '23:00',
            bookingIntervalMinutes: 15,
            minimumBookingDurationMinutes: 120,
            maximumBookingDurationMinutes: 240,
            cleaningDurationMinutes: 0,
            holdDurationMinutes: 7,
          ),
          selectedStart: null,
          onSelect: (_) {},
        ),
        overrides: await testOverrides(),
      );
      expect(find.byIcon(Icons.cleaning_services_rounded), findsNothing);
    });

    testWidgets('explains an empty day rather than showing a blank space', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        ChaletSlotPicker(
          availability: _availability(const <String>[]),
          scheduling: _scheduling,
          selectedStart: null,
          onSelect: (_) {},
        ),
        overrides: await testOverrides(),
      );

      expect(find.byIcon(Icons.event_busy_rounded), findsOneWidget);
      expect(find.byType(InkWell), findsNothing);
    });
  });

  group('ChaletDurationPicker', () {
    testWidgets('offers the durations the chalet allows, and no others', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        SizedBox(
          width: 390,
          child: ChaletDurationPicker(
            scheduling: const ChaletScheduling(
              openingTime: '08:00',
              closingTime: '23:00',
              bookingIntervalMinutes: 60,
              minimumBookingDurationMinutes: 120,
              maximumBookingDurationMinutes: 240,
              cleaningDurationMinutes: 0,
              holdDurationMinutes: 7,
            ),
            selectedMinutes: 120,
            onSelect: (_) {},
          ),
        ),
        overrides: await testOverrides(),
      );

      // 120, 180, 240 — three options, nothing shorter or longer.
      expect(find.byType(InkWell), findsNWidgets(3));
    });

    testWidgets('reports the chosen length back', (WidgetTester tester) async {
      int? chosen;
      await pumpAppWidget(
        tester,
        SizedBox(
          width: 390,
          child: ChaletDurationPicker(
            scheduling: _scheduling,
            selectedMinutes: 120,
            onSelect: (int minutes) => chosen = minutes,
          ),
        ),
        overrides: await testOverrides(),
      );

      await tester.tap(find.byType(InkWell).at(1));
      await tester.pump();
      expect(chosen, 135);
    });
  });
}
