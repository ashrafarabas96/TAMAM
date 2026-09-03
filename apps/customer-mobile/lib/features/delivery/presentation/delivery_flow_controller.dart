import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/features/banners/presentation/banner_providers.dart';
import 'package:tamam_customer/features/jobs/domain/fare.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/presentation/checkout_state.dart';
import 'package:tamam_customer/features/jobs/presentation/job_providers.dart';
import 'package:tamam_customer/features/media/data/media_repository.dart';
import 'package:tamam_customer/features/media/presentation/media_providers.dart';
import 'package:tamam_customer/features/places/presentation/place_providers.dart';
import 'package:uuid/uuid.dart';

/// A named phone contact on a delivery.
class Contact {
  const Contact({this.name = '', this.phone = ''});

  final String name;
  final String phone;

  bool get isComplete => name.trim().length >= 2 && phone.startsWith('+') && phone.length >= 8;

  Contact copyWith({String? name, String? phone}) =>
      Contact(name: name ?? this.name, phone: phone ?? this.phone);

  JsonMap toJson() => <String, Object?>{'name': name.trim(), 'phone': phone};
}

/// The delivery draft.
class DeliveryFlowState {
  const DeliveryFlowState({
    required this.idempotencyKey,
    this.pickup,
    this.destination,
    this.packageCategoryId,
    this.size = 'SMALL',
    this.weightKg,
    this.sender = const Contact(),
    this.recipient = const Contact(),
    this.urgency = JobUrgency.standard,
    this.description = '',
    this.deliveryNotes = '',
    this.attachments = const <Attachment>[],
    this.estimate,
    this.selectedOption = 0,
    this.checkout = const CheckoutSelection(),
    this.estimating = false,
    this.submitting = false,
    this.failure,
  });

  final String idempotencyKey;
  final Address? pickup;
  final Address? destination;
  final String? packageCategoryId;

  /// `SMALL` | `MEDIUM` | `LARGE` | `XL`.
  final String size;
  final double? weightKg;
  final Contact sender;
  final Contact recipient;
  final JobUrgency urgency;
  final String description;
  final String deliveryNotes;
  final List<Attachment> attachments;
  final FareEstimate? estimate;
  final int selectedOption;
  final CheckoutSelection checkout;
  final bool estimating;
  final bool submitting;
  final AppFailure? failure;

  bool get canEstimate => pickup != null && destination != null && packageCategoryId != null;

  bool get contactsComplete => sender.isComplete && recipient.isComplete;

  bool get canSubmit =>
      canEstimate && contactsComplete && estimate != null && !submitting && !estimating;

  FareOption? get option => estimate == null || estimate!.options.isEmpty
      ? null
      : estimate!.options[selectedOption.clamp(0, estimate!.options.length - 1)];

  List<String> get readyMediaIds =>
      attachments.where((Attachment a) => a.isReady).map((Attachment a) => a.mediaId!).toList(growable: false);

  DeliveryFlowState copyWith({
    Address? pickup,
    Address? destination,
    String? packageCategoryId,
    String? size,
    double? weightKg,
    Contact? sender,
    Contact? recipient,
    JobUrgency? urgency,
    String? description,
    String? deliveryNotes,
    List<Attachment>? attachments,
    FareEstimate? estimate,
    int? selectedOption,
    CheckoutSelection? checkout,
    bool? estimating,
    bool? submitting,
    AppFailure? failure,
    bool clearEstimate = false,
    bool clearFailure = false,
  }) =>
      DeliveryFlowState(
        idempotencyKey: idempotencyKey,
        pickup: pickup ?? this.pickup,
        destination: destination ?? this.destination,
        packageCategoryId: packageCategoryId ?? this.packageCategoryId,
        size: size ?? this.size,
        weightKg: weightKg ?? this.weightKg,
        sender: sender ?? this.sender,
        recipient: recipient ?? this.recipient,
        urgency: urgency ?? this.urgency,
        description: description ?? this.description,
        deliveryNotes: deliveryNotes ?? this.deliveryNotes,
        attachments: attachments ?? this.attachments,
        estimate: clearEstimate ? null : (estimate ?? this.estimate),
        selectedOption: selectedOption ?? this.selectedOption,
        checkout: checkout ?? this.checkout,
        estimating: estimating ?? this.estimating,
        submitting: submitting ?? this.submitting,
        failure: clearFailure ? null : (failure ?? this.failure),
      );
}

/// Drives the delivery flow.
class DeliveryFlowController extends AutoDisposeNotifier<DeliveryFlowState> {
  @override
  DeliveryFlowState build() {
    final String? myName = ref.read(sessionControllerProvider).user?.fullName;
    final String? myPhone = ref.read(sessionControllerProvider).user?.phone;
    return DeliveryFlowState(
      idempotencyKey: const Uuid().v4(),
      pickup: ref.read(currentAddressProvider),
      // The sender is almost always the customer, so it is prefilled.
      sender: Contact(name: myName ?? '', phone: myPhone ?? ''),
      checkout: CheckoutSelection(promoCode: ref.read(pendingPromoProvider)),
    );
  }

  void setPickup(Address address) => state = state.copyWith(pickup: address, clearEstimate: true);

  void setDestination(Address address) => state = state.copyWith(destination: address, clearEstimate: true);

  void setPackageCategory(String id) => state = state.copyWith(packageCategoryId: id, clearEstimate: true);

  void setSize(String size) => state = state.copyWith(size: size, clearEstimate: true);

  void setWeight(double? kg) => state = state.copyWith(weightKg: kg, clearEstimate: true);

  void setUrgency(JobUrgency urgency) => state = state.copyWith(urgency: urgency, clearEstimate: true);

  void setSender(Contact contact) => state = state.copyWith(sender: contact);

  void setRecipient(Contact contact) => state = state.copyWith(recipient: contact);

  void setDescription(String value) => state = state.copyWith(description: value);

  void setDeliveryNotes(String value) => state = state.copyWith(deliveryNotes: value);

  void selectOption(int index) => state = state.copyWith(selectedOption: index);

  void setPaymentMethod(PaymentMethod method) =>
      state = state.copyWith(checkout: state.checkout.copyWith(paymentMethod: method));

  void setSchedule(DateTime? when) => state = state.copyWith(
        checkout: when == null
            ? state.checkout.copyWith(clearSchedule: true)
            : state.checkout.copyWith(scheduledFor: when),
        clearEstimate: true,
      );

  /// Adds photos of the package and uploads them in the background.
  Future<void> addPhotos({required bool fromCamera}) async {
    final MediaRepository media = ref.read(mediaRepositoryProvider);
    final List<Attachment> picked = await media.pickImages(fromCamera: fromCamera, limit: 6);
    if (picked.isEmpty) return;

    state = state.copyWith(
      attachments: <Attachment>[
        ...state.attachments,
        ...picked.map((Attachment a) => a.copyWith(uploading: true)),
      ].take(6).toList(growable: false),
    );

    for (final Attachment attachment in picked) {
      try {
        final Attachment uploaded = await media.upload(attachment, purpose: MediaPurpose.jobAttachment);
        _replaceAttachment(attachment.localPath, uploaded);
      } on Object {
        _replaceAttachment(
          attachment.localPath,
          attachment.copyWith(uploading: false, failed: true),
        );
      }
    }
  }

  void removeAttachment(String localPath) => state = state.copyWith(
        attachments: state.attachments
            .where((Attachment a) => a.localPath != localPath)
            .toList(growable: false),
      );

  Future<void> estimate() async {
    if (!state.canEstimate) return;
    state = state.copyWith(estimating: true, clearFailure: true, clearEstimate: true);
    try {
      final FareEstimate result = await ref.read(pricingRepositoryProvider).deliveryEstimate(
            pickup: state.pickup!,
            destination: state.destination!,
            packageCategoryId: state.packageCategoryId!,
            approximateSize: state.size,
            urgency: state.urgency,
            approximateWeightKg: state.weightKg,
            scheduledFor: state.checkout.scheduledFor,
          );
      state = state.copyWith(estimate: result, estimating: false, selectedOption: 0);
      final String? pending = state.checkout.promoCode;
      if (pending != null && pending.isNotEmpty) await applyPromo(pending);
    } on Object catch (error) {
      state = state.copyWith(estimating: false, failure: asFailure(error));
    }
  }

  Future<void> applyPromo(String code) async {
    final FareEstimate? estimate = state.estimate;
    if (estimate == null || code.trim().isEmpty) return;
    state = state.copyWith(checkout: state.checkout.copyWith(promoBusy: true, clearPromoFailure: true));
    try {
      final PromoPreview preview = await ref.read(pricingRepositoryProvider).validatePromo(
            code: code,
            estimateId: estimate.estimateId,
            paymentMethod: state.checkout.paymentMethod,
          );
      state = state.copyWith(
        checkout: state.checkout.copyWith(promoBusy: false, promoCode: preview.code, promoPreview: preview),
      );
    } on Object catch (error) {
      state = state.copyWith(
        checkout: state.checkout.copyWith(promoBusy: false, promoFailure: asFailure(error)),
      );
    }
  }

  void clearPromo() => state = state.copyWith(checkout: state.checkout.copyWith(clearPromo: true));

  Future<Job?> submit() async {
    final FareEstimate? estimate = state.estimate;
    if (estimate == null || !state.canSubmit) return null;
    state = state.copyWith(submitting: true, clearFailure: true);
    try {
      final JsonMap body = <String, Object?>{
        'type': JobType.delivery.value,
        'estimateId': estimate.estimateId,
        'pickup': state.pickup!.toJson(),
        'destination': state.destination!.toJson(),
        'packageCategoryId': state.packageCategoryId,
        'approximateSize': state.size,
        if (state.weightKg != null) 'approximateWeightKg': state.weightKg,
        'sender': state.sender.toJson(),
        'recipient': state.recipient.toJson(),
        'urgency': state.urgency.value,
        'mediaIds': state.readyMediaIds,
        if (state.description.trim().isNotEmpty) 'description': state.description.trim(),
        if (state.deliveryNotes.trim().isNotEmpty) 'deliveryNotes': state.deliveryNotes.trim(),
        if (state.option?.vehicleTypeId != null) 'vehicleTypeId': state.option!.vehicleTypeId,
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

  void _replaceAttachment(String localPath, Attachment next) {
    state = state.copyWith(
      attachments: state.attachments
          .map((Attachment a) => a.localPath == localPath ? next : a)
          .toList(growable: false),
    );
  }
}

final AutoDisposeNotifierProvider<DeliveryFlowController, DeliveryFlowState> deliveryFlowProvider =
    NotifierProvider.autoDispose<DeliveryFlowController, DeliveryFlowState>(DeliveryFlowController.new);
