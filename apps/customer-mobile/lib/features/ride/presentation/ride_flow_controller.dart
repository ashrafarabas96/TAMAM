import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/features/banners/presentation/banner_providers.dart';
import 'package:tamam_customer/features/jobs/domain/fare.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/presentation/checkout_state.dart';
import 'package:tamam_customer/features/jobs/presentation/job_providers.dart';
import 'package:tamam_customer/features/places/presentation/place_providers.dart';
import 'package:uuid/uuid.dart';

/// Everything the ride screen needs, in one immutable value.
class RideFlowState {
  const RideFlowState({
    required this.idempotencyKey,
    this.pickup,
    this.destination,
    this.estimate,
    this.selectedOption = 0,
    this.checkout = const CheckoutSelection(),
    this.estimating = false,
    this.submitting = false,
    this.failure,
  });

  /// Generated once per draft so a manual retry after a timeout cannot create a
  /// second ride (spec §14 — job creation is never auto-retried).
  final String idempotencyKey;
  final Address? pickup;
  final Address? destination;
  final FareEstimate? estimate;
  final int selectedOption;
  final CheckoutSelection checkout;
  final bool estimating;
  final bool submitting;
  final AppFailure? failure;

  bool get canEstimate => pickup != null && destination != null;

  bool get canSubmit =>
      canEstimate && estimate != null && estimate!.options.isNotEmpty && !submitting && !estimating;

  FareOption? get option =>
      estimate == null || estimate!.options.isEmpty ? null : estimate!.options[selectedOption.clamp(0, estimate!.options.length - 1)];

  RideFlowState copyWith({
    Address? pickup,
    Address? destination,
    FareEstimate? estimate,
    int? selectedOption,
    CheckoutSelection? checkout,
    bool? estimating,
    bool? submitting,
    AppFailure? failure,
    bool clearEstimate = false,
    bool clearFailure = false,
  }) =>
      RideFlowState(
        idempotencyKey: idempotencyKey,
        pickup: pickup ?? this.pickup,
        destination: destination ?? this.destination,
        estimate: clearEstimate ? null : (estimate ?? this.estimate),
        selectedOption: selectedOption ?? this.selectedOption,
        checkout: checkout ?? this.checkout,
        estimating: estimating ?? this.estimating,
        submitting: submitting ?? this.submitting,
        failure: clearFailure ? null : (failure ?? this.failure),
      );
}

/// Drives the ride flow: two addresses → estimate → option → checkout → job.
class RideFlowController extends AutoDisposeNotifier<RideFlowState> {
  @override
  RideFlowState build() => RideFlowState(
        idempotencyKey: const Uuid().v4(),
        pickup: ref.read(currentAddressProvider),
        checkout: CheckoutSelection(promoCode: ref.read(pendingPromoProvider)),
      );

  void setPickup(Address address) {
    state = state.copyWith(pickup: address, clearEstimate: true, clearFailure: true);
  }

  void setDestination(Address address) {
    state = state.copyWith(destination: address, clearEstimate: true, clearFailure: true);
  }

  void swapEnds() {
    final Address? pickup = state.pickup;
    final Address? destination = state.destination;
    if (pickup == null || destination == null) return;
    state = state.copyWith(pickup: destination, destination: pickup, clearEstimate: true);
  }

  void selectOption(int index) => state = state.copyWith(selectedOption: index);

  void setPaymentMethod(PaymentMethod method) =>
      state = state.copyWith(checkout: state.checkout.copyWith(paymentMethod: method));

  void setSchedule(DateTime? when) {
    state = state.copyWith(
      checkout: when == null
          ? state.checkout.copyWith(clearSchedule: true)
          : state.checkout.copyWith(scheduledFor: when),
      clearEstimate: true,
    );
  }

  /// Asks the server for a fresh estimate. Any previous promo preview is
  /// dropped because it was calculated against the old estimate.
  Future<void> estimate() async {
    if (!state.canEstimate) return;
    state = state.copyWith(estimating: true, clearFailure: true, clearEstimate: true);
    try {
      final FareEstimate result = await ref.read(pricingRepositoryProvider).rideEstimate(
            pickup: state.pickup!,
            destination: state.destination!,
            scheduledFor: state.checkout.scheduledFor,
          );
      state = state.copyWith(
        estimate: result,
        estimating: false,
        selectedOption: 0,
        checkout: state.checkout.copyWith(clearPromo: true, promoCode: state.checkout.promoCode),
      );
      final String? pending = state.checkout.promoCode;
      if (pending != null && pending.isNotEmpty) await applyPromo(pending);
    } on Object catch (error) {
      state = state.copyWith(estimating: false, failure: asFailure(error));
    }
  }

  Future<void> applyPromo(String code) async {
    final FareEstimate? estimate = state.estimate;
    if (estimate == null || code.trim().isEmpty) return;
    state = state.copyWith(
      checkout: state.checkout.copyWith(promoBusy: true, clearPromoFailure: true),
    );
    try {
      final PromoPreview preview = await ref.read(pricingRepositoryProvider).validatePromo(
            code: code,
            estimateId: estimate.estimateId,
            paymentMethod: state.checkout.paymentMethod,
          );
      state = state.copyWith(
        checkout: state.checkout.copyWith(
          promoBusy: false,
          promoCode: preview.code,
          promoPreview: preview,
        ),
      );
    } on Object catch (error) {
      state = state.copyWith(
        checkout: state.checkout.copyWith(promoBusy: false, promoFailure: asFailure(error)),
      );
    }
  }

  void clearPromo() => state = state.copyWith(checkout: state.checkout.copyWith(clearPromo: true));

  /// Creates the ride. Returns the job on success, `null` on failure — the
  /// failure is in [RideFlowState.failure] for the screen to render.
  Future<Job?> submit() async {
    final FareOption? option = state.option;
    final FareEstimate? estimate = state.estimate;
    if (option == null || estimate == null || option.vehicleTypeId == null) return null;

    state = state.copyWith(submitting: true, clearFailure: true);
    try {
      final JsonMap body = <String, Object?>{
        'type': JobType.ride.value,
        'estimateId': estimate.estimateId,
        'vehicleTypeId': option.vehicleTypeId,
        'pickup': state.pickup!.toJson(),
        'destination': state.destination!.toJson(),
        ...state.checkout.toRequestFields(),
      };
      final Job job = await ref.read(jobsRepositoryProvider).create(
            body,
            idempotencyKey: state.idempotencyKey,
          );
      if (state.checkout.hasPromo) await ref.read(pendingPromoProvider.notifier).clear();
      ref.invalidate(activeJobsProvider);
      state = state.copyWith(submitting: false);
      return job;
    } on Object catch (error) {
      state = state.copyWith(submitting: false, failure: asFailure(error));
      return null;
    }
  }
}

final AutoDisposeNotifierProvider<RideFlowController, RideFlowState> rideFlowProvider =
    NotifierProvider.autoDispose<RideFlowController, RideFlowState>(RideFlowController.new);
