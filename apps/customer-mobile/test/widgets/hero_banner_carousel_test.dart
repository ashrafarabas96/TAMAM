import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/localized_text.dart';
import 'package:tamam_customer/features/banners/domain/banner.dart';
import 'package:tamam_customer/features/banners/presentation/banner_providers.dart';
import 'package:tamam_customer/features/banners/presentation/widgets/hero_banner_carousel.dart';
import 'package:visibility_detector/visibility_detector.dart';

import '../support/harness.dart';

/// A creative with no image URL, so the widget renders its theme fill and text
/// overlay without reaching for the network.
PromoBanner _banner(String id, {String headline = 'خصم ٢٠٪'}) => PromoBanner(
      id: id,
      campaignId: 'campaign-1',
      placement: BannerPlacement.homeHero,
      creative: BannerCreative(
        imageUrl: const LocalizedText(ar: '', en: ''),
        theme: 'gradientPurple',
        headline: LocalizedText(ar: headline, en: headline),
        subheadline: const LocalizedText(ar: 'على أول مشوار', en: 'on your first ride'),
        ctaLabel: const LocalizedText(ar: 'اطلب الآن', en: 'Order now'),
        badge: const LocalizedText(ar: 'جديد', en: 'New'),
      ),
      actionType: BannerActionType.promoCode,
      actionValue: 'TAMAM20',
      priority: 10,
      trackingToken: 'token-$id-0123456789',
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  // Visibility callbacks fire immediately instead of on a timer.
  VisibilityDetectorController.instance.updateInterval = Duration.zero;

  group('HeroBannerCarousel', () {
    testWidgets('renders the creative overlay of the first banner', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        HeroBannerCarousel(
          banners: <PromoBanner>[_banner('a'), _banner('b', headline: 'توصيل مجاني')],
          placement: BannerPlacement.homeHero,
          // Autoplay is disabled so the test leaves no periodic timer behind.
          autoplay: Duration.zero,
        ),
        overrides: await testOverrides(),
      );
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('خصم ٢٠٪'), findsOneWidget);
      expect(find.text('على أول مشوار'), findsOneWidget);
      expect(find.text('اطلب الآن'), findsOneWidget);
      expect(find.text('جديد'), findsOneWidget);
    });

    testWidgets('shows page dots only when there is more than one banner', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        HeroBannerCarousel(
          banners: <PromoBanner>[_banner('only')],
          placement: BannerPlacement.homeHero,
        ),
        overrides: await testOverrides(),
      );
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(PageView), findsOneWidget);
      // The page dots are AnimatedContainers; a single banner shows none.
      expect(
        find.descendant(
          of: find.byType(HeroBannerCarousel),
          matching: find.byType(AnimatedContainer),
        ),
        findsNothing,
      );
    });

    testWidgets('collapses to nothing when the feed is empty', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        const HeroBannerCarousel(
          banners: <PromoBanner>[],
          placement: BannerPlacement.homeHero,
        ),
        overrides: await testOverrides(),
      );

      expect(find.byType(PageView), findsNothing);
    });

    testWidgets('records one impression per visible banner', (WidgetTester tester) async {
      final ProviderContainer container = ProviderContainer(overrides: await testOverrides());
      addTearDown(container.dispose);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            locale: const Locale('ar'),
            supportedLocales: const <Locale>[Locale('ar'), Locale('en')],
            home: Scaffold(
              body: HeroBannerCarousel(
                banners: <PromoBanner>[_banner('a')],
                placement: BannerPlacement.homeHero,
              ),
            ),
          ),
        ),
      );

      // Impressions need ≥50 % visibility held for one second.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 1200));

      expect(container.read(bannerEventQueueProvider).pendingCount, 1);
    });

    testWidgets('swipes to the next banner', (WidgetTester tester) async {
      await pumpAppWidget(
        tester,
        HeroBannerCarousel(
          banners: <PromoBanner>[_banner('a'), _banner('b', headline: 'توصيل مجاني')],
          placement: BannerPlacement.homeHero,
          // Autoplay off, so the gesture is the only thing that moves the page.
          autoplay: Duration.zero,
        ),
        overrides: await testOverrides(),
      );
      await tester.pump(const Duration(milliseconds: 100));

      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();

      expect(find.text('توصيل مجاني'), findsOneWidget);
    });
  });
}
