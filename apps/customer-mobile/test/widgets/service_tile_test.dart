import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/features/home/presentation/widgets/service_tile.dart';

import '../support/harness.dart';

void main() {
  group('ServiceTile', () {
    testWidgets('shows the title, caption and icon', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        SizedBox(
          width: 180,
          child: ServiceTile(
            title: 'مشوار',
            caption: 'سيارة خلال دقائق',
            icon: Icons.local_taxi_rounded,
            color: TamamServiceColors.ride,
            onTap: () {},
          ),
        ),
      );

      expect(find.text('مشوار'), findsOneWidget);
      expect(find.text('سيارة خلال دقائق'), findsOneWidget);
      expect(find.byIcon(Icons.local_taxi_rounded), findsOneWidget);
    });

    testWidgets('calls onTap when enabled', (WidgetTester tester) async {
      int taps = 0;
      await pumpAppWidget(
        tester,
        SizedBox(
          width: 180,
          child: ServiceTile(
            title: 'توصيل',
            icon: Icons.inventory_2_rounded,
            color: TamamServiceColors.delivery,
            onTap: () => taps++,
          ),
        ),
      );

      await tester.tap(find.text('توصيل'));
      await tester.pumpAndSettle();

      expect(taps, 1);
    });

    testWidgets('does not react to taps when disabled', (WidgetTester tester) async {
      int taps = 0;
      await pumpAppWidget(
        tester,
        SizedBox(
          width: 180,
          child: ServiceTile(
            title: 'خدمة عاجلة',
            icon: Icons.bolt_rounded,
            color: TamamServiceColors.urgent,
            enabled: false,
            onTap: () => taps++,
          ),
        ),
      );

      await tester.tap(find.text('خدمة عاجلة'));
      await tester.pumpAndSettle();

      expect(taps, 0);
    });

    testWidgets('renders the badge only when one is given', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        SizedBox(
          width: 180,
          child: ServiceTile(
            title: 'خدمات منزلية',
            icon: Icons.handyman_rounded,
            color: TamamServiceColors.homeService,
            badge: 'جديد',
            onTap: () {},
          ),
        ),
      );

      expect(find.text('جديد'), findsOneWidget);
    });

    testWidgets('exposes a semantic label that includes the caption', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        SizedBox(
          width: 180,
          child: ServiceTile(
            title: 'مشوار',
            caption: 'سيارة خلال دقائق',
            icon: Icons.local_taxi_rounded,
            color: TamamServiceColors.ride,
            onTap: () {},
          ),
        ),
      );

      expect(
        find.bySemanticsLabel('مشوار. سيارة خلال دقائق'),
        findsOneWidget,
      );
    });
  });
}
