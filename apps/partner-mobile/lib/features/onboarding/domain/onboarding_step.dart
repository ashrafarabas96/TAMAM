import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';

/// The seven steps of the wizard, in order.
///
/// Two of them are conditional on the chosen roles:
///  * [skills] only for TECHNICIAN / SERVICE_PROVIDER;
///  * [vehicle] only for DRIVER / COURIER.
///
/// The step *numbers* stay stable regardless (so `onboardingStep` from the API
/// keeps its meaning); the wizard simply skips over the ones that do not apply.
enum OnboardingStep {
  personal(1),
  roles(2),
  skills(3),
  documents(4),
  vehicle(5),
  zones(6),
  review(7);

  const OnboardingStep(this.number);

  /// 1-based, matching `PartnerProfile.onboardingStep`.
  final int number;

  static OnboardingStep fromNumber(int number) {
    for (final OnboardingStep step in OnboardingStep.values) {
      if (step.number == number) return step;
    }
    return OnboardingStep.personal;
  }
}

/// Decides which steps apply and where a returning partner resumes.
abstract final class OnboardingFlow {
  static bool appliesTo(OnboardingStep step, List<PartnerRoleType> roles) {
    switch (step) {
      case OnboardingStep.skills:
        return roles.contains(PartnerRoleType.technician) || roles.contains(PartnerRoleType.serviceProvider);
      case OnboardingStep.vehicle:
        return roles.contains(PartnerRoleType.driver) || roles.contains(PartnerRoleType.courier);
      case OnboardingStep.personal:
      case OnboardingStep.roles:
      case OnboardingStep.documents:
      case OnboardingStep.zones:
      case OnboardingStep.review:
        return true;
    }
  }

  /// The steps actually shown for [roles].
  static List<OnboardingStep> stepsFor(List<PartnerRoleType> roles) =>
      OnboardingStep.values.where((OnboardingStep s) => appliesTo(s, roles)).toList(growable: false);

  /// The next applicable step after [current], or `null` at the end.
  static OnboardingStep? next(OnboardingStep current, List<PartnerRoleType> roles) {
    final List<OnboardingStep> steps = stepsFor(roles);
    final int index = steps.indexOf(current);
    if (index < 0 || index + 1 >= steps.length) return null;
    return steps[index + 1];
  }

  /// The previous applicable step, or `null` at the start.
  static OnboardingStep? previous(OnboardingStep current, List<PartnerRoleType> roles) {
    final List<OnboardingStep> steps = stepsFor(roles);
    final int index = steps.indexOf(current);
    if (index <= 0) return null;
    return steps[index - 1];
  }

  /// Where a returning partner lands: the first step they have not completed,
  /// clamped to the applicable list. A rejected file reopens at documents,
  /// because that is what a review team rejects in practice.
  static OnboardingStep resumeAt(PartnerProfile? profile) {
    if (profile == null) return OnboardingStep.personal;
    if (profile.isRejected) {
      return profile.rejectedDocuments.isEmpty ? OnboardingStep.review : OnboardingStep.documents;
    }
    final List<OnboardingStep> steps = stepsFor(profile.roles);
    final int completed = profile.onboardingStep;
    for (final OnboardingStep step in steps) {
      if (step.number > completed) return step;
    }
    return steps.isEmpty ? OnboardingStep.personal : steps.last;
  }

  /// The document types the partner must upload for [roles] and the categories
  /// they chose. ID is always required; the rest follow from the work.
  ///
  /// `ServiceCategory.requiredDocumentTypes` adds category-specific proof
  /// (e.g. a gas-fitting certificate) on top of these.
  static List<DocumentType> requiredDocuments(List<PartnerRoleType> roles) {
    final Set<DocumentType> types = <DocumentType>{DocumentType.id, DocumentType.profilePicture};
    if (roles.contains(PartnerRoleType.driver) || roles.contains(PartnerRoleType.courier)) {
      types
        ..add(DocumentType.drivingLicense)
        ..add(DocumentType.vehicleLicense)
        ..add(DocumentType.insurance);
    }
    if (roles.contains(PartnerRoleType.technician)) types.add(DocumentType.professionalCertificate);
    if (roles.contains(PartnerRoleType.serviceProvider)) types.add(DocumentType.businessDocument);
    return types.toList(growable: false);
  }

  /// Document types whose expiry date the server needs.
  static bool expiresFor(DocumentType type) =>
      type == DocumentType.drivingLicense ||
      type == DocumentType.vehicleLicense ||
      type == DocumentType.insurance ||
      type == DocumentType.id;

  /// Document types that carry a number (licence number, policy number…).
  static bool hasNumber(DocumentType type) => type != DocumentType.profilePicture;
}
