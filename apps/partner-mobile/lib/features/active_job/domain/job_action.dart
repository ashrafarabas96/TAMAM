import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';

/// The one primary thing the partner can do next on a job.
///
/// The active-job screen is status-driven: it never shows two competing
/// primary buttons, and it never invents a transition the server would reject.
/// This mapping is the contract between `JobStatus` × `JobType` and the big
/// yellow button, and it is unit-tested.
enum PartnerJobAction {
  /// ASSIGNED → `POST /jobs/:id/en-route`.
  goEnRoute,

  /// PARTNER_EN_ROUTE → `POST /jobs/:id/arrive` (geofenced).
  arrive,

  /// RIDE at pickup → `POST /jobs/:id/start` with the trip PIN.
  startRide,

  /// DELIVERY at pickup → `POST /jobs/:id/start` with the pickup OTP.
  pickUpPackage,

  /// HOME_SERVICE at the door → `POST /jobs/:id/start` (inspection).
  startInspection,

  /// RIDE in progress → `POST /jobs/:id/complete`.
  completeRide,

  /// DELIVERY in progress → `POST /jobs/:id/complete` with proof of delivery.
  deliverPackage,

  /// INSPECTION_STARTED / QUOTE_REQUIRED / QUOTE_REJECTED → quote builder.
  submitQuote,

  /// QUOTE_SUBMITTED → nothing to press; the customer decides.
  awaitQuoteDecision,

  /// QUOTE_APPROVED → `POST /jobs/:id/work/start`.
  startWork,

  /// WORK_STARTED → `POST /jobs/:id/work/complete` (with photos).
  completeWork,

  /// WAITING_FOR_PARTS → `POST /jobs/:id/work/resume`.
  resumeWork,

  /// WORK_COMPLETED → the customer confirms; nothing to press.
  awaitCustomerConfirmation,

  /// COMPLETED (or customer confirmed) → rate the customer.
  rateCustomer,

  /// Terminal, cancelled or not ours: no primary action.
  none,
}

/// Secondary things that may sit next to the primary button.
class JobSecondaryActions {
  const JobSecondaryActions({
    required this.canRelease,
    required this.canCancel,
    required this.canReportNoShow,
    required this.canPauseForParts,
    required this.canChangeOrder,
    required this.canNavigate,
    required this.canContactCustomer,
  });

  final bool canRelease;
  final bool canCancel;

  /// A no-show is a cancel with a reason the server only accepts after the
  /// waiting timeout; the sheet enables the option only once arrived.
  final bool canReportNoShow;
  final bool canPauseForParts;
  final bool canChangeOrder;
  final bool canNavigate;
  final bool canContactCustomer;
}

abstract final class JobActions {
  static PartnerJobAction primaryFor(Job job) {
    switch (job.status) {
      case JobStatus.assigned:
        return PartnerJobAction.goEnRoute;
      case JobStatus.partnerEnRoute:
        return PartnerJobAction.arrive;
      case JobStatus.partnerArrived:
      case JobStatus.waitingCustomer:
        return switch (job.type) {
          JobType.ride => PartnerJobAction.startRide,
          JobType.delivery || JobType.food => PartnerJobAction.pickUpPackage,
          JobType.homeService => PartnerJobAction.startInspection,
        };
      case JobStatus.inProgress:
        return job.isRide ? PartnerJobAction.completeRide : PartnerJobAction.deliverPackage;
      case JobStatus.inspectionStarted:
      case JobStatus.quoteRequired:
      case JobStatus.quoteRejected:
        return PartnerJobAction.submitQuote;
      case JobStatus.quoteSubmitted:
        return PartnerJobAction.awaitQuoteDecision;
      case JobStatus.quoteApproved:
        return PartnerJobAction.startWork;
      case JobStatus.workStarted:
        return PartnerJobAction.completeWork;
      case JobStatus.waitingForParts:
        return PartnerJobAction.resumeWork;
      case JobStatus.workCompleted:
        return PartnerJobAction.awaitCustomerConfirmation;
      case JobStatus.customerConfirmed:
      case JobStatus.completed:
        return PartnerJobAction.rateCustomer;
      case JobStatus.draft:
      case JobStatus.requested:
      case JobStatus.searching:
      case JobStatus.cancelled:
      case JobStatus.noPartnerAvailable:
      case JobStatus.disputed:
        return PartnerJobAction.none;
    }
  }

  static JobSecondaryActions secondaryFor(Job job) {
    final bool arrived = job.status == JobStatus.partnerArrived || job.status == JobStatus.waitingCustomer;
    final bool working = job.status == JobStatus.workStarted;
    return JobSecondaryActions(
      canRelease: job.canRelease,
      canCancel: job.canCancel && !job.isTerminal,
      canReportNoShow: arrived,
      canPauseForParts: working,
      canChangeOrder: working || job.status == JobStatus.waitingForParts,
      canNavigate: !job.isTerminal && job.currentTarget != null && job.status != JobStatus.workCompleted,
      canContactCustomer: !job.isTerminal && job.customer != null,
    );
  }

  /// Whether [action] needs a fresh GPS sample in its request body.
  static bool needsLocation(PartnerJobAction action) => switch (action) {
        PartnerJobAction.arrive ||
        PartnerJobAction.startRide ||
        PartnerJobAction.pickUpPackage ||
        PartnerJobAction.startInspection ||
        PartnerJobAction.completeRide ||
        PartnerJobAction.deliverPackage ||
        PartnerJobAction.completeWork =>
          true,
        _ => false,
      };

  /// Whether [action] asks the partner to type a code from the customer.
  static bool needsCode(PartnerJobAction action, Job job) => switch (action) {
        PartnerJobAction.startRide => job.tripPinRequired,
        PartnerJobAction.pickUpPackage => job.pickupOtpRequired,
        _ => false,
      };

  /// The action is a waiting state: the screen shows progress, not a button.
  static bool isPassive(PartnerJobAction action) =>
      action == PartnerJobAction.awaitQuoteDecision ||
      action == PartnerJobAction.awaitCustomerConfirmation ||
      action == PartnerJobAction.none;
}
