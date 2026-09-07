import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_customer/core/widgets/tamam_icon_tile.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/features/home/presentation/widgets/service_tile.dart';

import '../support/harness.dart';

/// Every non-empty label in the semantics tree the platform would publish.
List<String> semanticLabels(WidgetTester tester) {
  final List<String> labels = <String>[];
  void walk(SemanticsNode node) {
    if (node.label.isNotEmpty) labels.add(node.label);
    node.visitChildren((SemanticsNode child) {
      walk(child);
      return true;
    });
  }

  walk(tester.binding.pipelineOwner.semanticsOwner!.rootSemanticsNode!);
  return labels;
}

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
            service: TamamService.rides,
            onTap: () {},
          ),
        ),
      );

      expect(find.text('مشوار'), findsOneWidget);
      expect(find.text('سيارة خلال دقائق'), findsOneWidget);
      // The service artwork is the brand's own illustration, not a font glyph.
      expect(find.byType(Image), findsOneWidget);
    });

    testWidgets('calls onTap when enabled', (WidgetTester tester) async {
      int taps = 0;
      await pumpAppWidget(
        tester,
        SizedBox(
          width: 180,
          child: ServiceTile(
            title: 'توصيل',
            service: TamamService.delivery,
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
            glyph: Icons.bolt_rounded,
            glyphTint: TamamServiceColors.urgent,
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
            service: TamamService.homeServices,
            badge: 'جديد',
            onTap: () {},
          ),
        ),
      );

      expect(find.text('جديد'), findsOneWidget);
    });

    testWidgets('exposes a semantic label that includes the caption', (WidgetTester tester) async {
      // Without a live SemanticsHandle the semantics tree is never built and
      // find.bySemanticsLabel matches nothing at all.
      final SemanticsHandle semantics = tester.ensureSemantics();

      await pumpAppWidget(
        tester,
        SizedBox(
          width: 180,
          child: ServiceTile(
            title: 'مشوار',
            caption: 'سيارة خلال دقائق',
            service: TamamService.rides,
            onTap: () {},
          ),
        ),
      );

      // Read the published semantics tree directly. find.bySemanticsLabel inspects
      // RenderObject.debugSemantics and tester.getSemantics walks upwards from the finder;
      // neither reaches an annotation that sits below the widget being searched for.
      // One announcement carrying both lines — the card merges its text into a single
      // node, so it must not also carry a label repeating them.
      expect(semanticLabels(tester), hasLength(1));
      expect(semanticLabels(tester).single, contains('مشوار'));
      expect(semanticLabels(tester).single, contains('سيارة خلال دقائق'));

      // Disposed inside the body: flutter_test checks for live handles before tearDowns run.
      semantics.dispose();
    });
  });
}
