import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_partner/features/chalet/domain/owner_chalet.dart';
import 'package:tamam_partner/features/chalet/presentation/widgets/occupancy_chart.dart';

import '../support/harness.dart';

List<ChaletDayStat> _week(List<int> minutes) => <ChaletDayStat>[
      for (int day = 0; day < minutes.length; day++)
        ChaletDayStat(
          dayOfWeek: day,
          bookedMinutes: minutes[day],
          occupancyPercent: minutes[day] ~/ 10,
        ),
    ];

void main() {
  group('WeekdayOccupancyChart', () {
    testWidgets('draws one bar per weekday', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        WeekdayOccupancyChart(days: _week(<int>[0, 120, 240, 60, 480, 300, 180])),
        overrides: await testOverrides(),
      );
      expect(find.byType(FractionallySizedBox), findsNWidgets(7));
    });

    testWidgets('survives a week with nothing booked', (WidgetTester tester) async {
      // Dividing by the busiest day would be a division by zero here.
      await pumpAppWidget(
        tester,
        WeekdayOccupancyChart(days: _week(<int>[0, 0, 0, 0, 0, 0, 0])),
        overrides: await testOverrides(),
      );
      expect(find.byType(FractionallySizedBox), findsNWidgets(7));
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders nothing at all when there is no report', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        const WeekdayOccupancyChart(days: <ChaletDayStat>[]),
        overrides: await testOverrides(),
      );
      expect(find.byType(FractionallySizedBox), findsNothing);
    });

    testWidgets('publishes each day and its percentage to the screen reader',
        (WidgetTester tester) async {
      final SemanticsHandle handle = tester.ensureSemantics();
      await pumpAppWidget(
        tester,
        WeekdayOccupancyChart(days: _week(<int>[0, 120, 240, 60, 480, 300, 180])),
        overrides: await testOverrides(),
      );

      // A bar chart is unreadable without this: the numbers exist only as
      // heights otherwise.
      expect(find.bySemanticsLabel(RegExp(r'48%$')), findsOneWidget);
      handle.dispose();
    });
  });

  group('HourOccupancyChart', () {
    testWidgets('draws one bar per hour of the day', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        HourOccupancyChart(
          hours: <ChaletHourStat>[
            for (int hour = 0; hour < 24; hour++)
              ChaletHourStat(hour: hour, bookedMinutes: hour == 12 ? 60 : 0),
          ],
        ),
        overrides: await testOverrides(),
      );
      expect(find.byType(FractionallySizedBox), findsNWidgets(24));
    });

    testWidgets('labels only some hours, so the axis stays readable',
        (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        HourOccupancyChart(
          hours: <ChaletHourStat>[
            for (int hour = 0; hour < 24; hour++)
              ChaletHourStat(hour: hour, bookedMinutes: 30),
          ],
        ),
        overrides: await testOverrides(),
      );
      // 0, 6, 12, 18 — four labels rather than twenty-four.
      expect(find.text('0'), findsOneWidget);
      expect(find.text('6'), findsOneWidget);
      expect(find.text('13'), findsNothing);
    });

    testWidgets('renders nothing when there is no report', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        const HourOccupancyChart(hours: <ChaletHourStat>[]),
        overrides: await testOverrides(),
      );
      expect(find.byType(FractionallySizedBox), findsNothing);
    });
  });
}
