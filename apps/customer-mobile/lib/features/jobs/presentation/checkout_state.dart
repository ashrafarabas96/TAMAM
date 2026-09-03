import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/features/jobs/domain/fare.dart';

/// The choices that are identical across ride, delivery and service checkout:
/// payment method, promo code and scheduling.
///
/// Sharing this keeps the three flows behaving the same way without forcing
/// them into one over-general controller.
class CheckoutSelection {
  const CheckoutSelection({
    this.paymentMethod = PaymentMethod.cash,
    this.promoCode,
    this.promoPreview,
    this.promoFailure,
    this.promoBusy = false,
    this.scheduledFor,
  });

  final PaymentMethod paymentMethod;
  final String? promoCode;

  /// The server's answer to "what would this code save me?".
  final PromoPreview? promoPreview;
  final AppFailure? promoFailure;
  final bool promoBusy;

  /// `null` means "now"; a value switches the job to SCHEDULED.
  final DateTime? scheduledFor;

  bool get isScheduled => scheduledFor != null;

  bool get hasPromo => promoPreview != null && promoPreview!.savesMoney;

  CheckoutSelection copyWith({
    PaymentMethod? paymentMethod,
    String? promoCode,
    PromoPreview? promoPreview,
    AppFailure? promoFailure,
    bool? promoBusy,
    DateTime? scheduledFor,
    bool clearPromo = false,
    bool clearSchedule = false,
    bool clearPromoFailure = false,
  }) =>
      CheckoutSelection(
        paymentMethod: paymentMethod ?? this.paymentMethod,
        promoCode: clearPromo ? null : (promoCode ?? this.promoCode),
        promoPreview: clearPromo ? null : (promoPreview ?? this.promoPreview),
        promoFailure: clearPromo || clearPromoFailure ? null : (promoFailure ?? this.promoFailure),
        promoBusy: promoBusy ?? this.promoBusy,
        scheduledFor: clearSchedule ? null : (scheduledFor ?? this.scheduledFor),
      );

  /// The fields every `POST /jobs` body shares.
  Map<String, Object?> toRequestFields() => <String, Object?>{
        'paymentMethod': paymentMethod.value,
        'scheduling': isScheduled ? SchedulingMode.scheduled.value : SchedulingMode.now.value,
        if (isScheduled) 'scheduledFor': scheduledFor!.toUtc().toIso8601String(),
        if (promoCode != null && promoCode!.isNotEmpty) 'promoCode': promoCode,
      };
}
