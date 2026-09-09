import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/models/localized_text.dart';
import 'package:tamam_partner/core/widgets/stat_tile.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/core/widgets/tamam_logo.dart';
import 'package:tamam_partner/features/banners/domain/banner.dart';
import 'package:tamam_partner/features/banners/presentation/widgets/hero_banner_carousel.dart';
import 'package:tamam_partner/features/chalet/domain/owner_chalet.dart';
import 'package:tamam_partner/features/chalet/presentation/widgets/occupancy_chart.dart';
import 'package:tamam_partner/features/home/presentation/widgets/availability_toggle.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/jobs/presentation/widgets/job_card.dart';
import 'package:tamam_partner/features/offers/domain/job_offer.dart';
import 'package:tamam_partner/features/offers/presentation/offer_sheet.dart';
import 'package:tamam_partner/features/offers/presentation/offers_controller.dart';
import 'package:visibility_detector/visibility_detector.dart';

import '../support/harness.dart';

/// Layout defects hide at the defaults. Every widget here is pumped across the
/// conditions a real phone actually presents — a small screen, large
/// accessibility text, both scripts, both themes — and the test fails on any
/// RenderFlex overflow or thrown exception. The partner app is used one-handed
/// in a moving car by people who often run large system text, so this matrix
/// matters more here than anywhere.
const List<Size> _sizes = <Size>[Size(320, 568), Size(390, 844)];
const List<double> _scales = <double>[1.0, 1.3];
const List<Locale> _locales = <Locale>[Locale('ar'), Locale('en')];
const List<Brightness> _themes = <Brightness>[
  Brightness.light,
  Brightness.dark
];

class _FakeOffersController extends OffersController {
  _FakeOffersController(this._initial);

  final OfferQueue _initial;

  @override
  OfferQueue build() => _initial;

  @override
  Future<bool> accept() async => true;

  @override
  Future<bool> decline() async => true;
}

JsonMap _jobJson({String type = 'RIDE', String urgency = 'URGENT'}) =>
    <String, Object?>{
      'id': 'job-1',
      'number': 'TM-26-000123',
      'type': type,
      'status': 'SEARCHING',
      'version': 1,
      'customerId': 'cus-1',
      'zoneId': 'zone-1',
      'currency': 'ILS',
      'paymentMethod': 'CASH',
      'urgency': urgency,
      'distanceMeters': 6200,
      'stops': <JsonMap>[
        <String, Object?>{
          'id': 'stop-1',
          'sequence': 0,
          'kind': type == 'HOME_SERVICE' ? 'SERVICE_LOCATION' : 'PICKUP',
          'address': <String, Object?>{
            'lat': 31.9,
            'lng': 35.2,
            'formatted':
                'رام الله، المصيون، شارع الإرسال، عمارة الشروق، الطابق الرابع',
          },
        },
        <String, Object?>{
          'id': 'stop-2',
          'sequence': 1,
          'kind': 'DROPOFF',
          'address': <String, Object?>{
            'lat': 31.8,
            'lng': 35.3,
            'formatted': 'البيرة، الشرفة، مقابل مجمع فلسطين الطبي',
          },
        },
      ],
    };

JobOffer _offer(DateTime now) => JobOffer.fromJson(
      <String, Object?>{
        'assignmentId': 'asg-1',
        'wave': 1,
        'expiresAt': now.add(const Duration(seconds: 18)).toIso8601String(),
        'distanceToPickupMeters': 1400,
        'etaToPickupSeconds': 300,
        'estimatedEarnings': <String, Object?>{
          'amount': 123550,
          'currency': 'ILS'
        },
        'job': _jobJson(),
      },
      receivedAt: now,
    );

PromoBanner _banner(String id) => PromoBanner(
      id: id,
      campaignId: 'campaign-1',
      placement: BannerPlacement.partnerHome,
      creative: BannerCreative(
        imageUrl: const LocalizedText(ar: '', en: ''),
        theme: 'gradientPurple',
        headline: const LocalizedText(
          ar: 'اكسب أكثر في ساعات الذروة مع مكافآت الأسبوع الجديدة',
          en: 'Earn more in peak hours with this week\'s new bonuses',
        ),
        subheadline: LocalizedText(
            ar: 'حتى نهاية الشهر $id', en: 'until the end of the month $id'),
        ctaLabel: LocalizedText(ar: 'اعرف المزيد $id', en: 'Learn more $id'),
        badge: LocalizedText(ar: 'جديد $id', en: 'New $id'),
      ),
      actionType: BannerActionType.none,
      priority: 10,
      trackingToken: 'token-$id-0123456789',
    );

List<ChaletDayStat> _week(List<int> minutes) => <ChaletDayStat>[
      for (int day = 0; day < minutes.length; day++)
        ChaletDayStat(
            dayOfWeek: day,
            bookedMinutes: minutes[day],
            occupancyPercent: minutes[day] ~/ 10),
    ];

/// One widget under test: how to build it and whether it may take the whole
/// body. Sheets size themselves with Expanded and cannot sit in a scroll view.
class _Subject {
  const _Subject(this.build, {this.scroll = true, this.overrides});

  final Widget Function() build;
  final bool scroll;
  final Future<List<Override>> Function()? overrides;
}

final Map<String, _Subject> _subjects = <String, _Subject>{
  'AvailabilityToggle (offline)': _Subject(
    () => AvailabilityToggle(online: false, busy: false, onTap: () {}),
  ),
  'AvailabilityToggle (on a job)': _Subject(
    () => AvailabilityToggle(
        online: true, busy: false, onJob: true, onTap: () {}),
  ),
  'OfferSheet': _Subject(
    () => const OfferSheet(),
    scroll: false,
    overrides: () async {
      final DateTime now = DateTime.now();
      return <Override>[
        ...await testOverrides(),
        offersControllerProvider.overrideWith(
          () => _FakeOffersController(
              OfferQueue(offers: <JobOffer>[_offer(now)])),
        ),
      ];
    },
  ),
  'JobCard (ride, urgent)': _Subject(
    () => JobCard(job: Job.fromJson(_jobJson()), onTap: () {}),
  ),
  'JobCard (home service)': _Subject(
    () => JobCard(
        job: Job.fromJson(_jobJson(type: 'HOME_SERVICE', urgency: 'STANDARD')),
        onTap: () {}),
  ),
  'StatTile row': _Subject(
    () => const Row(
      children: <Widget>[
        Expanded(
          child: StatTile(
              value: '98%',
              label: 'نسبة القبول الأسبوعية',
              icon: Icons.thumb_up_rounded),
        ),
        Expanded(
            child: StatTile(
                value: '4.9', label: 'التقييم', icon: Icons.star_rounded)),
        Expanded(
          child: StatTile(
              value: '1,240',
              label: 'المشاوير المكتملة',
              icon: Icons.route_rounded),
        ),
      ],
    ),
  ),
  'StatusPill wrap': _Subject(
    () => const Wrap(
      spacing: 8,
      runSpacing: 8,
      children: <Widget>[
        StatusPill(
            label: 'قيد التنفيذ',
            tone: PillTone.brand,
            icon: Icons.play_arrow_rounded),
        StatusPill(label: 'مكتمل', tone: PillTone.success),
        StatusPill(
            label: 'بانتظار الدفع النقدي من العميل', tone: PillTone.warning),
        StatusPill(label: 'ملغى', tone: PillTone.danger, dense: true),
        StatusPill(
            label: 'Information',
            tone: PillTone.info,
            icon: Icons.info_outline_rounded),
      ],
    ),
  ),
  'HeroBannerCarousel': _Subject(
    () => HeroBannerCarousel(
      banners: <PromoBanner>[_banner('a'), _banner('b')],
      placement: BannerPlacement.partnerHome,
      autoplay: Duration.zero,
    ),
  ),
  'WeekdayOccupancyChart': _Subject(
    () => WeekdayOccupancyChart(
        days: _week(<int>[0, 120, 240, 60, 480, 300, 180])),
  ),
  'TamamLogo variants': _Subject(
    () => const Column(
      children: <Widget>[
        TamamLogo(height: 48),
        TamamLogo(height: 48, onBrand: true),
        TamamLogo(height: 40, markOnly: true),
      ],
    ),
  ),
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  VisibilityDetectorController.instance.updateInterval = Duration.zero;

  for (final MapEntry<String, _Subject> subject in _subjects.entries) {
    group(subject.key, () {
      for (final Size size in _sizes) {
        for (final double scale in _scales) {
          for (final Locale locale in _locales) {
            for (final Brightness theme in _themes) {
              final String label =
                  '${size.width.toInt()}w · ${scale}x · ${locale.languageCode} · ${theme.name}';
              testWidgets(label, (WidgetTester tester) async {
                // Built inside the tree, after the theme has selected the
                // script, so the styles match the locale under test.
                final Widget built =
                    Builder(builder: (_) => subject.value.build());
                await pumpAppWidget(
                  tester,
                  subject.value.scroll
                      ? SingleChildScrollView(child: built)
                      : built,
                  overrides: await (subject.value.overrides?.call() ??
                      testOverrides()),
                  locale: locale,
                  surfaceSize: size,
                  textScale: scale,
                  brightness: theme,
                );
                await tester.pump(const Duration(milliseconds: 120));
                // Any overflow or build error surfaces here rather than as a
                // silent yellow-and-black stripe on a partner's phone.
                final Object? thrown = tester.takeException();
                if (thrown != null) {
                  fail('threw at $label:\n'
                      '${thrown is FlutterError ? thrown.toStringDeep() : thrown}');
                }
                // Replace the tree so countdown tickers and dwell timers are disposed.
                await tester.pumpWidget(const SizedBox.shrink());
              });
            }
          }
        }
      }
    });
  }
}
