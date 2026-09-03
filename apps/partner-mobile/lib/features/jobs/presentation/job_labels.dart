import 'package:flutter/material.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/features/jobs/data/jobs_repository.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Every enum → sentence mapping for jobs lives here so lists, cards and the
/// active-job screen never disagree on wording.
abstract final class JobLabels {
  static String status(AppLocalizations l10n, JobStatus status) {
    switch (status) {
      case JobStatus.draft:
        return l10n.jobStatusDraft;
      case JobStatus.requested:
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

  static String type(AppLocalizations l10n, JobType type) {
    switch (type) {
      case JobType.ride:
        return l10n.jobTypeRide;
      case JobType.delivery:
        return l10n.jobTypeDelivery;
      case JobType.homeService:
        return l10n.jobTypeHomeService;
      case JobType.food:
        return l10n.jobTypeFood;
    }
  }

  static IconData typeIcon(JobType type) {
    switch (type) {
      case JobType.ride:
        return Icons.local_taxi_rounded;
      case JobType.delivery:
        return Icons.inventory_2_rounded;
      case JobType.homeService:
        return Icons.handyman_rounded;
      case JobType.food:
        return Icons.restaurant_rounded;
    }
  }

  static Color typeColor(JobType type) {
    switch (type) {
      case JobType.ride:
        return TamamServiceColors.ride;
      case JobType.delivery:
        return TamamServiceColors.delivery;
      case JobType.homeService:
        return TamamServiceColors.homeService;
      case JobType.food:
        return TamamServiceColors.delivery;
    }
  }

  static String payment(AppLocalizations l10n, PaymentMethod method) {
    switch (method) {
      case PaymentMethod.cash:
        return l10n.paymentCash;
      case PaymentMethod.wallet:
        return l10n.paymentWallet;
      case PaymentMethod.card:
        return l10n.paymentCard;
      case PaymentMethod.bank:
        return l10n.paymentBank;
      case PaymentMethod.externalGateway:
        return l10n.paymentOnline;
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

  static String cancelReason(AppLocalizations l10n, PartnerCancelReason reason) {
    switch (reason) {
      case PartnerCancelReason.customerNoShow:
        return l10n.cancelReasonNoShow;
      case PartnerCancelReason.customerUnreachable:
        return l10n.cancelReasonUnreachable;
      case PartnerCancelReason.wrongAddress:
        return l10n.cancelReasonWrongAddress;
      case PartnerCancelReason.vehicleIssue:
        return l10n.cancelReasonVehicleIssue;
      case PartnerCancelReason.safetyConcern:
        return l10n.cancelReasonSafety;
      case PartnerCancelReason.other:
        return l10n.cancelReasonOther;
    }
  }

  static String role(AppLocalizations l10n, PartnerRoleType role) {
    switch (role) {
      case PartnerRoleType.driver:
        return l10n.roleDriver;
      case PartnerRoleType.courier:
        return l10n.roleCourier;
      case PartnerRoleType.technician:
        return l10n.roleTechnician;
      case PartnerRoleType.serviceProvider:
        return l10n.roleServiceProvider;
    }
  }

  static IconData roleIcon(PartnerRoleType role) {
    switch (role) {
      case PartnerRoleType.driver:
        return Icons.local_taxi_rounded;
      case PartnerRoleType.courier:
        return Icons.delivery_dining_rounded;
      case PartnerRoleType.technician:
        return Icons.build_rounded;
      case PartnerRoleType.serviceProvider:
        return Icons.cleaning_services_rounded;
    }
  }

  static String documentType(AppLocalizations l10n, DocumentType type) {
    switch (type) {
      case DocumentType.id:
        return l10n.documentId;
      case DocumentType.drivingLicense:
        return l10n.documentDrivingLicense;
      case DocumentType.vehicleLicense:
        return l10n.documentVehicleLicense;
      case DocumentType.insurance:
        return l10n.documentInsurance;
      case DocumentType.professionalCertificate:
        return l10n.documentProfessionalCertificate;
      case DocumentType.businessDocument:
        return l10n.documentBusiness;
      case DocumentType.profilePicture:
        return l10n.documentProfilePicture;
    }
  }

  /// Resolves a raw document-type code from an API error payload.
  static String documentTypeCode(AppLocalizations l10n, String code) {
    final DocumentType? type = DocumentType.fromValue(code);
    return type == null ? code : documentType(l10n, type);
  }
}
