import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/features/active_job/domain/job_action.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';

Job _job(
  JobType type,
  JobStatus status, {
  bool tripPin = false,
  bool pickupOtp = false,
  bool withCustomer = false,
  bool withStops = true,
}) =>
    Job.fromJson(<String, Object?>{
      'id': 'job-1',
      'number': 'TM-26-000123',
      'type': type.value,
      'status': status.value,
      'version': 3,
      'customerId': 'cus-1',
      'zoneId': 'zone-1',
      'currency': 'ILS',
      'paymentMethod': 'CASH',
      'tripPinRequired': tripPin,
      'pickupOtpRequired': pickupOtp,
      if (withCustomer)
        'customer': <String, Object?>{
          'id': 'cus-1',
          'fullName': 'سارة',
          'rating': 4.8,
          'maskedPhone': '+970599000000',
        },
      if (withStops)
        'stops': <JsonMap>[
          <String, Object?>{
            'id': 'stop-1',
            'sequence': 0,
            'kind': type == JobType.homeService ? 'SERVICE_LOCATION' : 'PICKUP',
            'address': <String, Object?>{'lat': 31.9, 'lng': 35.2, 'formatted': 'رام الله'},
          },
          <String, Object?>{
            'id': 'stop-2',
            'sequence': 1,
            'kind': 'DROPOFF',
            'address': <String, Object?>{'lat': 31.8, 'lng': 35.3, 'formatted': 'البيرة'},
          },
        ],
    });

/// The active-job screen shows exactly one primary button, chosen from the
/// job's status and type. If this mapping drifts, the app either offers a
/// transition the server rejects or strands the partner with no way forward.
void main() {
  group('primaryFor — shared transitions', () {
    test('ASSIGNED asks the partner to head out', () {
      for (final JobType type in JobType.values) {
        expect(JobActions.primaryFor(_job(type, JobStatus.assigned)), PartnerJobAction.goEnRoute);
      }
    });

    test('PARTNER_EN_ROUTE asks for the geofenced arrival', () {
      for (final JobType type in JobType.values) {
        expect(JobActions.primaryFor(_job(type, JobStatus.partnerEnRoute)), PartnerJobAction.arrive);
      }
    });
  });

  group('primaryFor — at the pickup, the action depends on the job type', () {
    test('a ride starts the trip', () {
      expect(JobActions.primaryFor(_job(JobType.ride, JobStatus.partnerArrived)),
          PartnerJobAction.startRide);
    });

    test('a delivery and a food order pick the package up', () {
      expect(JobActions.primaryFor(_job(JobType.delivery, JobStatus.partnerArrived)),
          PartnerJobAction.pickUpPackage);
      expect(JobActions.primaryFor(_job(JobType.food, JobStatus.partnerArrived)),
          PartnerJobAction.pickUpPackage);
    });

    test('a home service starts an inspection', () {
      expect(JobActions.primaryFor(_job(JobType.homeService, JobStatus.partnerArrived)),
          PartnerJobAction.startInspection);
    });

    test('WAITING_CUSTOMER behaves exactly like PARTNER_ARRIVED', () {
      expect(JobActions.primaryFor(_job(JobType.ride, JobStatus.waitingCustomer)),
          PartnerJobAction.startRide);
      expect(JobActions.primaryFor(_job(JobType.homeService, JobStatus.waitingCustomer)),
          PartnerJobAction.startInspection);
    });
  });

  group('primaryFor — IN_PROGRESS', () {
    test('a ride is finished, a delivery is handed over', () {
      expect(JobActions.primaryFor(_job(JobType.ride, JobStatus.inProgress)),
          PartnerJobAction.completeRide);
      expect(JobActions.primaryFor(_job(JobType.delivery, JobStatus.inProgress)),
          PartnerJobAction.deliverPackage);
      expect(JobActions.primaryFor(_job(JobType.food, JobStatus.inProgress)),
          PartnerJobAction.deliverPackage);
    });
  });

  group('primaryFor — the home-service quote loop', () {
    test('inspection, quote-required and quote-rejected all lead to the builder', () {
      for (final JobStatus status in <JobStatus>[
        JobStatus.inspectionStarted,
        JobStatus.quoteRequired,
        JobStatus.quoteRejected,
      ]) {
        expect(JobActions.primaryFor(_job(JobType.homeService, status)), PartnerJobAction.submitQuote);
      }
    });

    test('a submitted quote leaves the decision to the customer', () {
      expect(JobActions.primaryFor(_job(JobType.homeService, JobStatus.quoteSubmitted)),
          PartnerJobAction.awaitQuoteDecision);
    });

    test('an approved quote unlocks the work, and the work runs to completion', () {
      expect(JobActions.primaryFor(_job(JobType.homeService, JobStatus.quoteApproved)),
          PartnerJobAction.startWork);
      expect(JobActions.primaryFor(_job(JobType.homeService, JobStatus.workStarted)),
          PartnerJobAction.completeWork);
      expect(JobActions.primaryFor(_job(JobType.homeService, JobStatus.waitingForParts)),
          PartnerJobAction.resumeWork);
      expect(JobActions.primaryFor(_job(JobType.homeService, JobStatus.workCompleted)),
          PartnerJobAction.awaitCustomerConfirmation);
    });
  });

  group('primaryFor — terminal states', () {
    test('a finished job invites a rating', () {
      expect(JobActions.primaryFor(_job(JobType.ride, JobStatus.completed)),
          PartnerJobAction.rateCustomer);
      expect(JobActions.primaryFor(_job(JobType.homeService, JobStatus.customerConfirmed)),
          PartnerJobAction.rateCustomer);
    });

    test('a job that is not ours offers nothing', () {
      for (final JobStatus status in <JobStatus>[
        JobStatus.draft,
        JobStatus.requested,
        JobStatus.searching,
        JobStatus.cancelled,
        JobStatus.noPartnerAvailable,
        JobStatus.disputed,
      ]) {
        expect(JobActions.primaryFor(_job(JobType.ride, status)), PartnerJobAction.none);
      }
    });
  });

  test('every status maps to an action for every job type', () {
    // The switch is exhaustive by construction; this guards against a future
    // status arriving without a decision about what the partner should press.
    for (final JobType type in JobType.values) {
      for (final JobStatus status in JobStatus.values) {
        expect(JobActions.primaryFor(_job(type, status)), isA<PartnerJobAction>());
      }
    }
  });

  group('needsLocation', () {
    test('every physical-presence transition carries a fresh fix', () {
      for (final PartnerJobAction action in <PartnerJobAction>[
        PartnerJobAction.arrive,
        PartnerJobAction.startRide,
        PartnerJobAction.pickUpPackage,
        PartnerJobAction.startInspection,
        PartnerJobAction.completeRide,
        PartnerJobAction.deliverPackage,
        PartnerJobAction.completeWork,
      ]) {
        expect(JobActions.needsLocation(action), isTrue, reason: '$action');
      }
    });

    test('paperwork and waiting states do not', () {
      for (final PartnerJobAction action in <PartnerJobAction>[
        PartnerJobAction.goEnRoute,
        PartnerJobAction.submitQuote,
        PartnerJobAction.awaitQuoteDecision,
        PartnerJobAction.startWork,
        PartnerJobAction.resumeWork,
        PartnerJobAction.rateCustomer,
        PartnerJobAction.none,
      ]) {
        expect(JobActions.needsLocation(action), isFalse, reason: '$action');
      }
    });
  });

  group('needsCode', () {
    test('asks for the trip PIN only when the ride requires one', () {
      expect(
        JobActions.needsCode(PartnerJobAction.startRide, _job(JobType.ride, JobStatus.partnerArrived)),
        isFalse,
      );
      expect(
        JobActions.needsCode(
          PartnerJobAction.startRide,
          _job(JobType.ride, JobStatus.partnerArrived, tripPin: true),
        ),
        isTrue,
      );
    });

    test('asks for the pickup OTP only when the delivery requires one', () {
      expect(
        JobActions.needsCode(
          PartnerJobAction.pickUpPackage,
          _job(JobType.delivery, JobStatus.partnerArrived, pickupOtp: true),
        ),
        isTrue,
      );
      expect(
        JobActions.needsCode(
          PartnerJobAction.pickUpPackage,
          _job(JobType.delivery, JobStatus.partnerArrived),
        ),
        isFalse,
      );
    });

    test('no other action ever asks for a code', () {
      final Job job = _job(JobType.ride, JobStatus.assigned, tripPin: true, pickupOtp: true);

      expect(JobActions.needsCode(PartnerJobAction.goEnRoute, job), isFalse);
      expect(JobActions.needsCode(PartnerJobAction.completeRide, job), isFalse);
    });
  });

  group('isPassive', () {
    test('the two waiting states and "none" show progress, not a button', () {
      expect(JobActions.isPassive(PartnerJobAction.awaitQuoteDecision), isTrue);
      expect(JobActions.isPassive(PartnerJobAction.awaitCustomerConfirmation), isTrue);
      expect(JobActions.isPassive(PartnerJobAction.none), isTrue);
    });

    test('anything actionable is not passive', () {
      expect(JobActions.isPassive(PartnerJobAction.goEnRoute), isFalse);
      expect(JobActions.isPassive(PartnerJobAction.completeWork), isFalse);
      expect(JobActions.isPassive(PartnerJobAction.rateCustomer), isFalse);
    });
  });

  group('secondaryFor', () {
    test('a job can be returned to dispatch only before it starts', () {
      expect(JobActions.secondaryFor(_job(JobType.ride, JobStatus.assigned)).canRelease, isTrue);
      expect(JobActions.secondaryFor(_job(JobType.ride, JobStatus.partnerArrived)).canRelease, isTrue);
      expect(JobActions.secondaryFor(_job(JobType.ride, JobStatus.inProgress)).canRelease, isFalse);
    });

    test('no-show unlocks only once the partner has arrived', () {
      expect(JobActions.secondaryFor(_job(JobType.ride, JobStatus.partnerEnRoute)).canReportNoShow, isFalse);
      expect(JobActions.secondaryFor(_job(JobType.ride, JobStatus.partnerArrived)).canReportNoShow, isTrue);
      expect(JobActions.secondaryFor(_job(JobType.ride, JobStatus.waitingCustomer)).canReportNoShow, isTrue);
    });

    test('pausing for parts belongs to work in progress only', () {
      expect(JobActions.secondaryFor(_job(JobType.homeService, JobStatus.workStarted)).canPauseForParts,
          isTrue);
      expect(JobActions.secondaryFor(_job(JobType.homeService, JobStatus.quoteApproved)).canPauseForParts,
          isFalse);
    });

    test('a change order is offered while working or while waiting for parts', () {
      expect(JobActions.secondaryFor(_job(JobType.homeService, JobStatus.workStarted)).canChangeOrder,
          isTrue);
      expect(JobActions.secondaryFor(_job(JobType.homeService, JobStatus.waitingForParts)).canChangeOrder,
          isTrue);
      expect(JobActions.secondaryFor(_job(JobType.homeService, JobStatus.quoteSubmitted)).canChangeOrder,
          isFalse);
    });

    test('cancelling is blocked once the work is done and on terminal jobs', () {
      expect(JobActions.secondaryFor(_job(JobType.homeService, JobStatus.workCompleted)).canCancel, isFalse);
      expect(JobActions.secondaryFor(_job(JobType.ride, JobStatus.completed)).canCancel, isFalse);
      expect(JobActions.secondaryFor(_job(JobType.ride, JobStatus.cancelled)).canCancel, isFalse);
      expect(JobActions.secondaryFor(_job(JobType.ride, JobStatus.inProgress)).canCancel, isTrue);
    });

    test('navigation needs a target and a job that is still running', () {
      expect(JobActions.secondaryFor(_job(JobType.ride, JobStatus.assigned)).canNavigate, isTrue);
      expect(
        JobActions.secondaryFor(_job(JobType.ride, JobStatus.assigned, withStops: false)).canNavigate,
        isFalse,
      );
      expect(JobActions.secondaryFor(_job(JobType.ride, JobStatus.completed)).canNavigate, isFalse);
      expect(
        JobActions.secondaryFor(_job(JobType.homeService, JobStatus.workCompleted)).canNavigate,
        isFalse,
      );
    });

    test('the customer can be contacted only while the job is live and a card exists', () {
      expect(
        JobActions.secondaryFor(_job(JobType.ride, JobStatus.inProgress, withCustomer: true))
            .canContactCustomer,
        isTrue,
      );
      expect(
        JobActions.secondaryFor(_job(JobType.ride, JobStatus.inProgress)).canContactCustomer,
        isFalse,
      );
      expect(
        JobActions.secondaryFor(_job(JobType.ride, JobStatus.cancelled, withCustomer: true))
            .canContactCustomer,
        isFalse,
      );
    });
  });
}
