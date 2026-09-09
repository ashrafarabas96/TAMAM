import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/localized_text.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/widgets/status_pill.dart';
import 'package:tamam_customer/core/widgets/tamam_icon_tile.dart';
import 'package:tamam_customer/core/widgets/tamam_logo.dart';
import 'package:tamam_customer/features/banners/domain/banner.dart';
import 'package:tamam_customer/features/banners/presentation/widgets/hero_banner_carousel.dart';
import 'package:tamam_customer/features/chalet/domain/chalet.dart';
import 'package:tamam_customer/features/chalet/domain/chalet_booking.dart';
import 'package:tamam_customer/features/chalet/presentation/widgets/chalet_slot_picker.dart';
import 'package:tamam_customer/features/home/presentation/widgets/service_tile.dart';
import 'package:tamam_customer/features/service/presentation/widgets/service_timing_picker.dart';
import 'package:visibility_detector/visibility_detector.dart';

import '../support/harness.dart';

/// Layout defects hide at the defaults. Every widget here is pumped across the
/// conditions a real phone actually presents — a small screen, large
/// accessibility text, both scripts, both themes — and the test fails on any
/// RenderFlex overflow or thrown exception, which the framework reports as a
/// test error. A widget that fits a 390-wide light screen at 1.0x text and
/// nowhere else is not finished.
const List<Size> _sizes = <Size>[Size(320, 568), Size(390, 844)];
const List<double> _scales = <double>[1.0, 1.3];
const List<Locale> _locales = <Locale>[Locale('ar'), Locale('en')];
const List<Brightness> _themes = <Brightness>[
  Brightness.light,
  Brightness.dark
];

const ChaletScheduling _scheduling = ChaletScheduling(
  openingTime: '08:00',
  closingTime: '23:00',
  bookingIntervalMinutes: 15,
  minimumBookingDurationMinutes: 120,
  maximumBookingDurationMinutes: 240,
  cleaningDurationMinutes: 90,
  holdDurationMinutes: 7,
);

ChaletAvailability _availability() => ChaletAvailability(
      chaletId: 'c1',
      date: '2026-10-01',
      windows: const <ChaletWindow>[],
      startTimes: <String>[
        '2026-10-01T06:00:00.000Z',
        '2026-10-01T06:15:00.000Z',
        '2026-10-01T06:30:00.000Z',
        '2026-10-01T06:45:00.000Z',
        '2026-10-01T07:00:00.000Z',
        '2026-10-01T07:15:00.000Z',
      ].map(DateTime.parse).toList(growable: false),
      bookingIntervalMinutes: 15,
      cleaningDurationMinutes: 90,
    );

PromoBanner _banner(String id) => PromoBanner(
      id: id,
      campaignId: 'campaign-1',
      placement: BannerPlacement.homeHero,
      creative: BannerCreative(
        imageUrl: const LocalizedText(ar: '', en: ''),
        theme: 'gradientPurple',
        headline: const LocalizedText(
          ar: 'كل خدمات بيتك في مكان واحد مع فنيين معتمدين',
          en: 'Every home service in one place with vetted technicians',
        ),
        subheadline: LocalizedText(
            ar: 'على أول مشوار $id', en: 'on your first ride $id'),
        ctaLabel: LocalizedText(ar: 'اطلب الآن $id', en: 'Order now $id'),
        badge: LocalizedText(ar: 'جديد $id', en: 'New $id'),
      ),
      actionType: BannerActionType.promoCode,
      actionValue: 'TAMAM20',
      priority: 10,
      trackingToken: 'token-$id-0123456789',
    );

/// The widgets under test, built fresh per condition so state never leaks.
final Map<String, Widget Function()> _subjects = <String, Widget Function()>{
  'ServiceTile (long caption)': () => SizedBox(
        width: 160,
        child: ServiceTile(
          title: 'حجز الشاليهات',
          caption: 'لحظات أجمل مع من تحب — احجز بالساعة',
          service: TamamService.chalet,
          onTap: () {},
        ),
      ),
  'ServiceTile (urgent glyph)': () => SizedBox(
        width: 160,
        child: ServiceTile(
          title: 'عاجل',
          caption: 'خدمة فورية خلال دقائق',
          glyph: Icons.bolt_rounded,
          glyphTint: TamamServiceColors.urgent,
          onTap: () {},
        ),
      ),
  'ChaletSlotPicker': () => ChaletSlotPicker(
        availability: _availability(),
        scheduling: _scheduling,
        selectedStart: null,
        onSelect: (_) {},
      ),
  'HeroBannerCarousel': () => HeroBannerCarousel(
        banners: <PromoBanner>[_banner('a'), _banner('b')],
        placement: BannerPlacement.homeHero,
        autoplay: Duration.zero,
      ),
  'TamamIconTile row': () => const Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: <Widget>[
          TamamIconTile(service: TamamService.rides, size: 52),
          TamamIconTile(service: TamamService.delivery, size: 52),
          TamamIconTile(service: TamamService.homeServices, size: 52),
          TamamIconTile(service: TamamService.chalet, size: 52),
        ],
      ),
  'ServiceTimingPicker (scheduled)': () => ServiceTimingPicker(
        allowsInstant: true,
        allowsScheduled: true,
        preferredDate: '2026-10-01',
        preferredTimeSlot: 'AFTERNOON',
        onChanged: ({String? date, String? slot}) {},
      ),
  'ServiceTimingPicker (instant only)': () => ServiceTimingPicker(
        allowsInstant: true,
        allowsScheduled: false,
        preferredDate: null,
        preferredTimeSlot: null,
        onChanged: ({String? date, String? slot}) {},
      ),
  'StatusPill wrap': () => const Wrap(
        spacing: 8,
        runSpacing: 8,
        children: <Widget>[
          StatusPill(
              label: 'قيد التنفيذ',
              tone: PillTone.brand,
              icon: Icons.play_arrow_rounded),
          StatusPill(label: 'مكتمل', tone: PillTone.success),
          StatusPill(
              label: 'بانتظار تأكيد الدفع النقدي من الشريك',
              tone: PillTone.warning),
          StatusPill(label: 'ملغى', tone: PillTone.danger, dense: true),
          StatusPill(
              label: 'Information',
              tone: PillTone.info,
              icon: Icons.info_outline_rounded),
        ],
      ),
  'TamamLogo variants': () => const Column(
        children: <Widget>[
          TamamLogo(height: 48),
          TamamLogo(height: 48, onBrand: true),
          TamamLogo(height: 40, markOnly: true),
        ],
      ),
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  VisibilityDetectorController.instance.updateInterval = Duration.zero;

  for (final MapEntry<String, Widget Function()> subject in _subjects.entries) {
    group(subject.key, () {
      for (final Size size in _sizes) {
        for (final double scale in _scales) {
          for (final Locale locale in _locales) {
            for (final Brightness theme in _themes) {
              final String label =
                  '${size.width.toInt()}w · ${scale}x · ${locale.languageCode} · ${theme.name}';
              testWidgets(label, (WidgetTester tester) async {
                await pumpAppWidget(
                  tester,
                  // Built inside the tree, after the theme has selected the
                  // script, so the styles match the locale under test.
                  SingleChildScrollView(
                      child: Builder(builder: (_) => subject.value())),
                  overrides: await testOverrides(),
                  locale: locale,
                  surfaceSize: size,
                  textScale: scale,
                  brightness: theme,
                );
                await tester.pump(const Duration(milliseconds: 120));
                // Any overflow or build error surfaces here rather than as a
                // silent yellow-and-black stripe on a customer's phone.
                final Object? thrown = tester.takeException();
                if (thrown != null) {
                  fail('threw at $label:\n'
                      '${thrown is FlutterError ? thrown.toStringDeep() : thrown}');
                }
                // Replace the tree so dwell timers and tickers are disposed.
                await tester.pumpWidget(const SizedBox.shrink());
              });
            }
          }
        }
      }
    });
  }
}
