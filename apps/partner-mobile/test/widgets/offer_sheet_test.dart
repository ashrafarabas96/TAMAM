import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/models/money.dart';
import 'package:tamam_partner/features/offers/domain/job_offer.dart';
import 'package:tamam_partner/features/offers/presentation/offer_sheet.dart';
import 'package:tamam_partner/features/offers/presentation/offers_controller.dart';
import 'package:tamam_partner/l10n/l10n.dart';

import '../support/harness.dart';

/// Replaces the real controller so the sheet renders a fixed queue and no
/// accept/decline ever reaches the network.
class _FakeOffersController extends OffersController {
  _FakeOffersController(this._initial);

  final OfferQueue _initial;

  int accepts = 0;
  int declines = 0;

  @override
  OfferQueue build() => _initial;

  @override
  Future<bool> accept() async {
    accepts++;
    return true;
  }

  @override
  Future<bool> decline() async {
    declines++;
    return true;
  }
}

JobOffer _offer({
  required DateTime now,
  String jobType = 'RIDE',
  int earningsMinor = 3550,
  int distanceToPickupMeters = 1400,
  int etaToPickupSeconds = 300,
  int? tripDistanceMeters = 6200,
  String urgency = 'STANDARD',
}) =>
    JobOffer.fromJson(
      <String, Object?>{
        'assignmentId': 'asg-1',
        'wave': 1,
        'expiresAt': now.add(const Duration(seconds: 18)).toIso8601String(),
        'distanceToPickupMeters': distanceToPickupMeters,
        'etaToPickupSeconds': etaToPickupSeconds,
        'estimatedEarnings': <String, Object?>{'amount': earningsMinor, 'currency': 'ILS'},
        'job': <String, Object?>{
          'id': 'job-1',
          'number': 'TM-26-000123',
          'type': jobType,
          'status': 'SEARCHING',
          'version': 1,
          'customerId': 'cus-1',
          'zoneId': 'zone-1',
          'currency': 'ILS',
          'paymentMethod': 'CASH',
          'urgency': urgency,
          if (tripDistanceMeters != null) 'distanceMeters': tripDistanceMeters,
          'stops': <JsonMap>[
            <String, Object?>{
              'id': 'stop-1',
              'sequence': 0,
              'kind': jobType == 'HOME_SERVICE' ? 'SERVICE_LOCATION' : 'PICKUP',
              'address': <String, Object?>{'lat': 31.9, 'lng': 35.2, 'formatted': 'رام الله، المصيون'},
            },
            <String, Object?>{
              'id': 'stop-2',
              'sequence': 1,
              'kind': 'DROPOFF',
              'address': <String, Object?>{'lat': 31.8, 'lng': 35.3, 'formatted': 'البيرة، الشرفة'},
            },
          ],
        },
      },
      receivedAt: now,
    );

/// The offer sheet is the app's highest-stakes screen: a handful of seconds, a
/// number to decide on, and no way to dismiss it by accident.
void main() {
  late List<Override> base;
  late AppLocalizations ar;
  final DateTime now = DateTime.now();

  setUp(() async {
    base = await testOverrides();
    ar = await loadL10n();
  });

  Future<_FakeOffersController> pumpSheet(WidgetTester tester, OfferQueue queue) async {
    final _FakeOffersController fake = _FakeOffersController(queue);
    await pumpAppWidget(
      tester,
      const OfferSheet(),
      overrides: <Override>[...base, offersControllerProvider.overrideWith(() => fake)],
    );
    return fake;
  }

  testWidgets('shows the job type, the earnings and both decisions', (WidgetTester tester) async {
    await pumpSheet(tester, OfferQueue(offers: <JobOffer>[_offer(now: now)]));

    expect(find.text(ar.offerTitle), findsOneWidget);
    expect(find.text(ar.jobTypeRide), findsOneWidget);
    expect(find.text(ar.offerEstimatedEarnings), findsOneWidget);
    expect(find.byKey(const Key('offer-accept')), findsOneWidget);
    expect(find.byKey(const Key('offer-decline')), findsOneWidget);
  });

  testWidgets('labels the first stop "service location" for a home service', (WidgetTester tester) async {
    await pumpSheet(
      tester,
      OfferQueue(offers: <JobOffer>[_offer(now: now, jobType: 'HOME_SERVICE')]),
    );

    expect(find.text(ar.offerServiceLocation), findsOneWidget);
    expect(find.text(ar.offerPickup), findsNothing);
    expect(find.text(ar.jobTypeHomeService), findsOneWidget);
  });

  testWidgets('labels the first stop "pickup" for a ride', (WidgetTester tester) async {
    await pumpSheet(tester, OfferQueue(offers: <JobOffer>[_offer(now: now)]));

    expect(find.text(ar.offerPickup), findsOneWidget);
    expect(find.text(ar.offerServiceLocation), findsNothing);
  });

  testWidgets('renders distances in the unit the magnitude deserves', (WidgetTester tester) async {
    final UnitFormatter units = UnitFormatter('ar');
    await pumpSheet(
      tester,
      OfferQueue(offers: <JobOffer>[_offer(now: now, distanceToPickupMeters: 640)]),
    );

    // 640 m stays in metres; the 6.2 km trip switches to kilometres.
    expect(find.text(ar.distanceM(units.distanceValue(640))), findsOneWidget);
    expect(find.text(ar.distanceKm(units.distanceValue(6200))), findsOneWidget);
    expect(find.text(ar.offerToPickup), findsOneWidget);
    expect(find.text(ar.offerTripDistance), findsOneWidget);
  });

  testWidgets('hides the trip distance when the job has none', (WidgetTester tester) async {
    await pumpSheet(
      tester,
      OfferQueue(offers: <JobOffer>[_offer(now: now, tripDistanceMeters: null)]),
    );

    expect(find.text(ar.offerTripDistance), findsNothing);
    expect(find.text(ar.offerToPickup), findsOneWidget);
  });

  testWidgets('flags an urgent job', (WidgetTester tester) async {
    await pumpSheet(
      tester,
      OfferQueue(offers: <JobOffer>[_offer(now: now, urgency: 'EMERGENCY')]),
    );

    expect(find.text(ar.urgencyEmergency), findsOneWidget);
  });

  testWidgets('announces the rest of the queue only when more than one offer waits',
      (WidgetTester tester) async {
    await pumpSheet(tester, OfferQueue(offers: <JobOffer>[_offer(now: now)]));
    expect(find.text(ar.offerQueuePosition(1)), findsNothing);

    // Tear the tree down first: pumping a second ProviderScope with different overrides
    // over the top of the first one keeps the original container, so the sheet would
    // still be reading the single-offer queue.
    await tester.pumpWidget(const SizedBox.shrink());

    await pumpSheet(
      tester,
      OfferQueue(offers: <JobOffer>[_offer(now: now), _offer(now: now)]),
    );
    expect(find.text(ar.offerQueuePosition(2)), findsOneWidget);
  });

  testWidgets('accepting answers the offer exactly once', (WidgetTester tester) async {
    final _FakeOffersController fake =
        await pumpSheet(tester, OfferQueue(offers: <JobOffer>[_offer(now: now)]));

    await tester.tap(find.byKey(const Key('offer-accept')));
    await tester.pump();

    expect(fake.accepts, 1);
    expect(fake.declines, 0);
  });

  testWidgets('declining answers the offer exactly once', (WidgetTester tester) async {
    final _FakeOffersController fake =
        await pumpSheet(tester, OfferQueue(offers: <JobOffer>[_offer(now: now)]));

    await tester.tap(find.byKey(const Key('offer-decline')));
    await tester.pump();

    expect(fake.declines, 1);
    expect(fake.accepts, 0);
  });

  testWidgets('locks both buttons while an answer is in flight', (WidgetTester tester) async {
    final _FakeOffersController fake = await pumpSheet(
      tester,
      OfferQueue(offers: <JobOffer>[_offer(now: now)], responding: true),
    );

    await tester.tap(find.byKey(const Key('offer-decline')));
    await tester.pump();

    expect(fake.declines, 0);
    expect(tester.widget<TextButton>(find.byKey(const Key('offer-decline'))).onPressed, isNull);
  });

  testWidgets('cannot be dismissed by a system back gesture', (WidgetTester tester) async {
    await pumpSheet(tester, OfferQueue(offers: <JobOffer>[_offer(now: now)]));

    // The only exits are the two buttons or the deadline: an accidental swipe
    // or back press must never cost the partner a job.
    // Matched by predicate rather than by type so the assertion does not depend
    // on PopScope's generic arity, which differs across Flutter versions.
    expect(
      find.byWidgetPredicate((Widget widget) => widget is PopScope && !widget.canPop),
      findsOneWidget,
    );
  });

  testWidgets('renders an empty shell rather than crashing when the queue drains',
      (WidgetTester tester) async {
    await pumpSheet(tester, const OfferQueue());

    expect(find.text(ar.offerTitle), findsNothing);
    expect(find.byKey(const Key('offer-accept')), findsNothing);
  });

  testWidgets('shows the earnings in the job currency', (WidgetTester tester) async {
    await pumpSheet(
      tester,
      OfferQueue(offers: <JobOffer>[_offer(now: now, earningsMinor: 3550)]),
    );

    expect(_offer(now: now).estimatedEarnings, const Money(amount: 3550, currency: 'ILS'));
    expect(find.textContaining('₪'), findsWidgets);
  });
}
