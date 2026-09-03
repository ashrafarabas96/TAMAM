import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/features/jobs/domain/fare.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';

/// A ride mid-trip, shaped exactly like `JobDto`.
JsonMap _rideJson() => <String, Object?>{
      'id': 'job-1',
      'number': 'TM-26-000123',
      'type': 'RIDE',
      'status': 'PARTNER_EN_ROUTE',
      'version': 4,
      'customerId': 'cust-1',
      'partnerId': 'partner-1',
      'zoneId': 'zone-1',
      'scheduling': 'NOW',
      'urgency': 'STANDARD',
      'currency': 'ILS',
      'paymentMethod': 'CASH',
      'stops': <Object?>[
        <String, Object?>{
          'id': 'stop-2',
          'sequence': 2,
          'kind': 'DROPOFF',
          'address': <String, Object?>{'lat': 31.9, 'lng': 35.2, 'formatted': 'رام الله - المنارة'},
        },
        <String, Object?>{
          'id': 'stop-1',
          'sequence': 1,
          'kind': 'PICKUP',
          'address': <String, Object?>{'lat': 31.89, 'lng': 35.19, 'formatted': 'البيرة'},
        },
      ],
      'estimatedTotal': <String, Object?>{'amount': 2500, 'currency': 'ILS'},
      'finalTotal': null,
      'breakdown': <Object?>[
        <String, Object?>{
          'code': 'BASE_FARE',
          'label': <String, Object?>{'ar': 'الأجرة الأساسية', 'en': 'Base fare'},
          'amount': <String, Object?>{'amount': 1500, 'currency': 'ILS'},
        },
        <String, Object?>{
          'code': 'PROMO',
          'label': <String, Object?>{'ar': 'خصم', 'en': 'Promo'},
          'amount': <String, Object?>{'amount': -500, 'currency': 'ILS'},
        },
      ],
      'dynamicFields': <String, Object?>{},
      'mediaUrls': <Object?>[],
      'tripPinRequired': true,
      'tripPin': '4821',
      'pickupOtpRequired': false,
      'deliveryOtpRequired': false,
      'etaToPickupSeconds': 420,
      'partner': <String, Object?>{
        'id': 'partner-1',
        'fullName': 'سامي خالد',
        'rating': 4.8,
        'ratingCount': 132,
        'maskedPhone': '+970599000000',
        'vehicle': <String, Object?>{
          'brand': 'Skoda',
          'model': 'Octavia',
          'color': 'أبيض',
          'plate': '12-345-67',
          'typeName': <String, Object?>{'ar': 'اقتصادي', 'en': 'Economy'},
        },
        'location': <String, Object?>{'lat': 31.895, 'lng': 35.195},
      },
      'createdAt': '2026-03-01T10:00:00.000Z',
      'updatedAt': '2026-03-01T10:05:00.000Z',
    };

void main() {
  group('Job.fromJson', () {
    test('maps the mobility fields and enums', () {
      final Job job = Job.fromJson(_rideJson());
      expect(job.id, 'job-1');
      expect(job.number, 'TM-26-000123');
      expect(job.type, JobType.ride);
      expect(job.status, JobStatus.partnerEnRoute);
      expect(job.version, 4);
      expect(job.paymentMethod, PaymentMethod.cash);
      expect(job.tripPin, '4821');
    });

    test('sorts stops by sequence so pickup comes first', () {
      final Job job = Job.fromJson(_rideJson());
      expect(job.stops.first.kind, JobStopKind.pickup);
      expect(job.pickup?.address.formatted, 'البيرة');
      expect(job.destination?.address.formatted, 'رام الله - المنارة');
    });

    test('derives lifecycle flags from the status', () {
      final Job job = Job.fromJson(_rideJson());
      expect(job.isActive, isTrue);
      expect(job.isLive, isTrue);
      expect(job.isTerminal, isFalse);
      expect(job.canCancel, isTrue);
      expect(job.canRate, isFalse);
    });

    test('prefers the final total once the server sets one', () {
      final Job estimated = Job.fromJson(_rideJson());
      expect(estimated.displayTotal?.amount, 2500);

      final JsonMap settled = _rideJson()
        ..['finalTotal'] = <String, Object?>{'amount': 2700, 'currency': 'ILS'}
        ..['status'] = 'COMPLETED';
      final Job completed = Job.fromJson(settled);
      expect(completed.displayTotal?.amount, 2700);
      expect(completed.canRate, isTrue);
      expect(completed.isTerminal, isTrue);
    });

    test('marks negative breakdown lines as credits', () {
      final Job job = Job.fromJson(_rideJson());
      expect(job.breakdown, hasLength(2));
      expect(job.breakdown.first.isCredit, isFalse);
      expect(job.breakdown.last.isCredit, isTrue);
      expect(job.breakdown.last.label.resolve('ar'), 'خصم');
    });

    test('reads the partner card, including the vehicle plate', () {
      final Job job = Job.fromJson(_rideJson());
      expect(job.partner?.fullName, 'سامي خالد');
      expect(job.partner?.canCall, isTrue);
      expect(job.partner?.vehicle?.title, 'Skoda Octavia');
    });

    test('survives an empty payload without throwing', () {
      final Job job = Job.fromJson(const <String, Object?>{});
      expect(job.id, isEmpty);
      expect(job.status, JobStatus.requested);
      expect(job.stops, isEmpty);
      expect(job.breakdown, isEmpty);
    });

    test('recognises a home-service job awaiting a quote decision', () {
      final JsonMap json = _rideJson()
        ..['type'] = 'HOME_SERVICE'
        ..['status'] = 'QUOTE_SUBMITTED'
        ..['activeQuote'] = <String, Object?>{
          'id': 'quote-1',
          'jobId': 'job-1',
          'kind': 'INITIAL',
          'revision': 1,
          'status': 'SUBMITTED',
          'total': <String, Object?>{'amount': 18000, 'currency': 'ILS'},
          'items': <Object?>[],
        };
      final Job job = Job.fromJson(json);
      expect(job.isHomeService, isTrue);
      expect(job.awaitsQuoteDecision, isTrue);
      expect(job.activeQuote?.total.amount, 18000);
    });
  });

  group('FareEstimate.fromJson', () {
    test('maps options and their breakdowns', () {
      final FareEstimate estimate = FareEstimate.fromJson(<String, Object?>{
        'estimateId': 'est-1',
        'jobType': 'RIDE',
        'currency': 'ILS',
        'distanceMeters': 5400,
        'durationSeconds': 780,
        'expiresAt': DateTime.now().add(const Duration(minutes: 3)).toIso8601String(),
        'routePolyline': '_p~iF~ps|U',
        'options': <Object?>[
          <String, Object?>{
            'vehicleTypeId': 'veh-1',
            'name': <String, Object?>{'ar': 'اقتصادي', 'en': 'Economy'},
            'seats': 4,
            'etaToPickupSeconds': 300,
            'surgeMultiplier': 1.2,
            'pricingSnapshotId': 'snap-1',
            'total': <String, Object?>{'amount': 2500, 'currency': 'ILS'},
            'breakdown': <Object?>[],
          },
        ],
      });

      expect(estimate.estimateId, 'est-1');
      expect(estimate.options, hasLength(1));
      expect(estimate.options.first.hasSurge, isTrue);
      expect(estimate.options.first.name.resolve('en'), 'Economy');
      expect(estimate.isExpired, isFalse);
    });

    test('treats a past expiry as expired', () {
      final FareEstimate estimate = FareEstimate.fromJson(<String, Object?>{
        'estimateId': 'est-2',
        'expiresAt': DateTime.now().subtract(const Duration(minutes: 1)).toIso8601String(),
        'options': <Object?>[],
      });
      expect(estimate.isExpired, isTrue);
      expect(estimate.timeToExpiry, Duration.zero);
    });
  });

  group('JobLiveState', () {
    test('merges partial socket updates onto the current state', () {
      const JobLiveState base = JobLiveState(
        jobId: 'job-1',
        etaToPickupSeconds: 400,
      );
      final JobLiveState merged = base.merge(
        JobLiveState.fromLocationEvent(<String, Object?>{
          'jobId': 'job-1',
          'lat': 31.9,
          'lng': 35.2,
          'heading': 90.0,
        }),
      );
      expect(merged.location?.lat, 31.9);
      expect(merged.heading, 90.0);
      // The ETA was not part of the location event and must survive.
      expect(merged.etaToPickupSeconds, 400);
    });
  });
}
