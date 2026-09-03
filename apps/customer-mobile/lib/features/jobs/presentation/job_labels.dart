import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/features/jobs/data/jobs_repository.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Localised wording for every server enum the customer sees.
///
/// Enum values are contract, not copy — this is the one place that turns them
/// into Arabic/English sentences, so no widget ever hard-codes a status name.
abstract final class JobLabels {
  static String status(AppLocalizations l10n, JobStatus status) {
    switch (status) {
      case JobStatus.draft:
        return l10n.jobStatusDraft;
      case JobStatus.requested:
        return l10n.jobStatusRequested;
      case JobStatus.searching:
        return l10n.jobStatusSearching;
      case JobStatus.assigned:
        return l10n.jobStatusAssigned;
      case JobStatus.partnerEnRoute:
        return l10n.jobStatusEnRoute;
      case JobStatus.partnerArrived:
        return l10n.jobStatusArrived;
      case JobStatus.waitingCustomer:
        return l10n.jobStatusWaitingCustomer;
      case JobStatus.inProgress:
        return l10n.jobStatusInProgress;
      case JobStatus.inspectionStarted:
        return l10n.jobStatusInspection;
      case JobStatus.quoteRequired:
        return l10n.jobStatusQuoteRequired;
      case JobStatus.quoteSubmitted:
        return l10n.jobStatusQuoteSubmitted;
      case JobStatus.quoteApproved:
        return l10n.jobStatusQuoteApproved;
      case JobStatus.quoteRejected:
        return l10n.jobStatusQuoteRejected;
      case JobStatus.workStarted:
        return l10n.jobStatusWorkStarted;
      case JobStatus.waitingForParts:
        return l10n.jobStatusWaitingForParts;
      case JobStatus.workCompleted:
        return l10n.jobStatusWorkCompleted;
      case JobStatus.customerConfirmed:
        return l10n.jobStatusCustomerConfirmed;
      case JobStatus.completed:
        return l10n.jobStatusCompleted;
      case JobStatus.cancelled:
        return l10n.jobStatusCancelled;
      case JobStatus.noPartnerAvailable:
        return l10n.jobStatusNoPartner;
      case JobStatus.disputed:
        return l10n.jobStatusDisputed;
    }
  }

  static String jobType(AppLocalizations l10n, JobType type) {
    switch (type) {
      case JobType.ride:
        return l10n.serviceRide;
      case JobType.delivery:
        return l10n.serviceDelivery;
      case JobType.homeService:
        return l10n.serviceHome;
      case JobType.food:
      case JobType.grocery:
      case JobType.pharmacy:
      case JobType.shopping:
      case JobType.moving:
      case JobType.roadAssistance:
        return l10n.serviceOther;
    }
  }

  static String urgency(AppLocalizations l10n, JobUrgency urgency) {
    switch (urgency) {
      case JobUrgency.standard:
        return l10n.urgencyStandard;
      case JobUrgency.urgent:
        return l10n.urgencyUrgent;
      case JobUrgency.emergency:
        return l10n.urgencyEmergency;
    }
  }

  static String paymentMethod(AppLocalizations l10n, PaymentMethod method) {
    switch (method) {
      case PaymentMethod.cash:
        return l10n.paymentCash;
      case PaymentMethod.wallet:
        return l10n.paymentWallet;
      case PaymentMethod.card:
        return l10n.paymentCard;
      case PaymentMethod.bank:
      case PaymentMethod.externalGateway:
        return l10n.paymentOnline;
    }
  }

  static String cancelReason(AppLocalizations l10n, CancelReason reason) {
    switch (reason) {
      case CancelReason.changedMind:
        return l10n.cancelReasonChangedMind;
      case CancelReason.waitTooLong:
        return l10n.cancelReasonWaitTooLong;
      case CancelReason.wrongAddress:
        return l10n.cancelReasonWrongAddress;
      case CancelReason.priceTooHigh:
        return l10n.cancelReasonPriceTooHigh;
      case CancelReason.partnerNotMoving:
        return l10n.cancelReasonPartnerNotMoving;
      case CancelReason.safetyConcern:
        return l10n.cancelReasonSafety;
      case CancelReason.duplicate:
        return l10n.cancelReasonDuplicate;
      case CancelReason.other:
        return l10n.cancelReasonOther;
    }
  }

  static String packageSize(AppLocalizations l10n, String size) {
    switch (size) {
      case 'SMALL':
        return l10n.packageSizeSmall;
      case 'MEDIUM':
        return l10n.packageSizeMedium;
      case 'LARGE':
        return l10n.packageSizeLarge;
      default:
        return l10n.packageSizeXl;
    }
  }

  static String timeSlot(AppLocalizations l10n, String slot) {
    switch (slot) {
      case 'MORNING':
        return l10n.timeSlotMorning;
      case 'AFTERNOON':
        return l10n.timeSlotAfternoon;
      default:
        return l10n.timeSlotEvening;
    }
  }

  /// The ordered milestones drawn by the tracking stepper. Home-service jobs
  /// have a different spine (inspection → quote → work) than mobility jobs.
  static List<JobStatus> stepperFor(JobType type) {
    if (type == JobType.homeService) {
      return const <JobStatus>[
        JobStatus.requested,
        JobStatus.searching,
        JobStatus.assigned,
        JobStatus.partnerEnRoute,
        JobStatus.partnerArrived,
        JobStatus.inspectionStarted,
        JobStatus.quoteSubmitted,
        JobStatus.workStarted,
        JobStatus.workCompleted,
        JobStatus.completed,
      ];
    }
    return const <JobStatus>[
      JobStatus.requested,
      JobStatus.searching,
      JobStatus.assigned,
      JobStatus.partnerEnRoute,
      JobStatus.partnerArrived,
      JobStatus.inProgress,
      JobStatus.completed,
    ];
  }

  /// How far along the stepper a status sits; `-1` when it is off the spine
  /// (cancelled, disputed, waiting for parts).
  static int stepIndex(JobType type, JobStatus status) {
    final List<JobStatus> steps = stepperFor(type);
    final int direct = steps.indexOf(status);
    if (direct >= 0) return direct;
    switch (status) {
      case JobStatus.waitingCustomer:
        return steps.indexOf(JobStatus.partnerArrived);
      case JobStatus.quoteRequired:
        return steps.indexOf(JobStatus.inspectionStarted);
      case JobStatus.quoteApproved:
      case JobStatus.waitingForParts:
        return steps.indexOf(JobStatus.workStarted);
      case JobStatus.customerConfirmed:
        return steps.indexOf(JobStatus.completed);
      default:
        return -1;
    }
  }
}
