import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Turns an [AppFailure] into a sentence the partner can act on.
///
/// Codes are the contract; the server `message` is English and meant for logs,
/// so it is only used as a last resort for codes this app does not know yet.
String localizedFailure(AppLocalizations l10n, AppFailure failure) {
  switch (failure.code) {
    case AppFailure.offlineCode:
      return l10n.errorOffline;
    case AppFailure.networkCode:
      return l10n.errorNetwork;
    case ErrorCode.validationFailed:
      return failure.fieldErrors.isEmpty ? l10n.errorValidation : failure.fieldErrors.first.message;
    case ErrorCode.unauthenticated:
    case ErrorCode.tokenExpired:
    case ErrorCode.tokenRevoked:
      return l10n.errorSessionExpired;
    case ErrorCode.forbidden:
      return l10n.errorForbidden;
    case ErrorCode.notFound:
      return l10n.errorNotFound;
    case ErrorCode.rateLimited:
      return l10n.errorRateLimited;
    case ErrorCode.otpInvalid:
      return l10n.errorOtpInvalid;
    case ErrorCode.otpExpired:
      return l10n.errorOtpExpired;
    case ErrorCode.otpTooManyAttempts:
      return l10n.errorOtpTooManyAttempts;
    case ErrorCode.otpResendCooldown:
      return l10n.errorOtpCooldown;
    case ErrorCode.accountSuspended:
      return l10n.errorAccountSuspended;
    case ErrorCode.accountRestricted:
      return l10n.errorAccountRestricted;
    case ErrorCode.partnerNotApproved:
      // The server explains exactly which requirement is missing (expired
      // documents, no active vehicle); that detail beats a generic sentence.
      return failure.message.isEmpty ? l10n.errorPartnerNotApproved : failure.message;
    case ErrorCode.partnerNotAvailable:
      return l10n.errorPartnerNotAvailable;
    case ErrorCode.offerExpired:
      return l10n.errorOfferExpired;
    case ErrorCode.jobAlreadyAssigned:
      return l10n.errorOfferTaken;
    case ErrorCode.versionConflict:
      return l10n.errorVersionConflict;
    case ErrorCode.invalidStateTransition:
      return l10n.errorInvalidTransition;
    case ErrorCode.tripPinInvalid:
      return l10n.errorTripPinInvalid;
    case ErrorCode.pickupOtpInvalid:
      return l10n.errorPickupOtpInvalid;
    case ErrorCode.deliveryOtpInvalid:
      return l10n.errorDeliveryOtpInvalid;
    case ErrorCode.quoteNotApproved:
      return l10n.errorQuoteNotApproved;
    case ErrorCode.staleLocation:
      return l10n.errorStaleLocation;
    case ErrorCode.impossibleMovement:
      return l10n.errorImpossibleMovement;
    case ErrorCode.outsideServiceZone:
      return l10n.errorOutsideZone;
    case ErrorCode.outsideOperatingHours:
      return l10n.errorOutsideHours;
    case ErrorCode.uploadTooLarge:
      return l10n.errorUploadTooLarge;
    case ErrorCode.uploadInvalid:
      return l10n.errorUploadInvalid;
    case ErrorCode.featureDisabled:
      return l10n.errorFeatureDisabled;
    case ErrorCode.idempotencyKeyReused:
      return l10n.errorDuplicateRequest;
    case ErrorCode.insufficientWalletBalance:
      return l10n.errorInsufficientBalance;
    case ErrorCode.ratingNotAllowed:
      return l10n.errorRatingNotAllowed;
    case ErrorCode.internalError:
      return l10n.errorGeneric;
    default:
      return failure.message.isEmpty ? l10n.errorGeneric : failure.message;
  }
}

/// Converts any thrown object into an [AppFailure] so `AsyncValue.error`
/// handling is uniform across every screen.
AppFailure asFailure(Object error) =>
    error is AppFailure ? error : AppFailure.unexpected(error.toString());

/// The distance the server reported when it refused an arrival (`details`
/// carries `distanceMeters`), so the screen can say how far off the partner is.
int? geofenceDistanceMeters(AppFailure failure) {
  final Object? value = failure.details?['distanceMeters'];
  if (value is int) return value;
  if (value is double) return value.round();
  return null;
}

/// The document types the server says are expired, from a
/// `PARTNER_NOT_APPROVED` refusal to go online.
List<String> expiredDocumentTypes(AppFailure failure) {
  final Object? value = failure.details?['expiredDocumentTypes'];
  if (value is! List) return const <String>[];
  return value.whereType<String>().toList(growable: false);
}
