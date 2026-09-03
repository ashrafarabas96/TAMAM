import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Turns an [AppFailure] into a sentence the customer can act on.
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
    case ErrorCode.outsideServiceZone:
      return l10n.errorOutsideZone;
    case ErrorCode.serviceUnavailableInZone:
      return l10n.errorServiceUnavailableInZone;
    case ErrorCode.outsideOperatingHours:
      return l10n.errorOutsideHours;
    case ErrorCode.partnerNotAvailable:
      return l10n.errorNoPartners;
    case ErrorCode.versionConflict:
    case ErrorCode.invalidStateTransition:
      return l10n.errorVersionConflict;
    case ErrorCode.jobAlreadyAssigned:
      return l10n.errorJobAlreadyAssigned;
    case ErrorCode.insufficientWalletBalance:
      return l10n.errorInsufficientBalance;
    case ErrorCode.paymentMethodDisabled:
      return l10n.errorPaymentMethodDisabled;
    case ErrorCode.paymentFailed:
      return l10n.errorPaymentFailed;
    case ErrorCode.promoInvalid:
      return l10n.errorPromoInvalid;
    case ErrorCode.promoExpired:
      return l10n.errorPromoExpired;
    case ErrorCode.promoUsageExceeded:
      return l10n.errorPromoUsageExceeded;
    case ErrorCode.promoMinOrderNotMet:
      return l10n.errorPromoMinOrder;
    case ErrorCode.promoNotEligible:
      return l10n.errorPromoNotEligible;
    case ErrorCode.ratingNotAllowed:
      return l10n.errorRatingNotAllowed;
    case ErrorCode.uploadTooLarge:
      return l10n.errorUploadTooLarge;
    case ErrorCode.uploadInvalid:
      return l10n.errorUploadInvalid;
    case ErrorCode.featureDisabled:
      return l10n.errorFeatureDisabled;
    case ErrorCode.idempotencyKeyReused:
      return l10n.errorDuplicateRequest;
    case ErrorCode.quoteNotApproved:
      return l10n.errorQuoteNotApproved;
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
