import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/features/banners/presentation/banner_providers.dart';
import 'package:tamam_customer/features/catalog/domain/catalog.dart';
import 'package:tamam_customer/features/catalog/domain/dynamic_field.dart';
import 'package:tamam_customer/features/catalog/presentation/catalog_providers.dart';
import 'package:tamam_customer/features/jobs/domain/fare.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/presentation/checkout_state.dart';
import 'package:tamam_customer/features/jobs/presentation/job_providers.dart';
import 'package:tamam_customer/features/media/data/media_repository.dart';
import 'package:tamam_customer/features/media/presentation/media_providers.dart';
import 'package:tamam_customer/features/places/presentation/place_providers.dart';
import 'package:uuid/uuid.dart';

/// The home-service draft for one category.
class ServiceFlowState {
  const ServiceFlowState({
    required this.idempotencyKey,
    required this.categoryId,
    this.category,
    this.location,
    this.subcategoryId,
    this.optionIds = const <String>{},
    this.description = '',
    this.additionalInstructions = '',
    this.dynamicValues = const <String, Object?>{},
    this.fieldErrors = const <String, DynamicFieldError>{},
    this.attachments = const <Attachment>[],
    this.urgency = JobUrgency.standard,
    this.preferredDate,
    this.preferredTimeSlot,
    this.estimate,
    this.checkout = const CheckoutSelection(),
    this.loadingCategory = true,
    this.estimating = false,
    this.submitting = false,
    this.failure,
  });

  final String idempotencyKey;
  final String categoryId;
  final ServiceCategory? category;
  final Address? location;
  final String? subcategoryId;
  final Set<String> optionIds;
  final String description;
  final String additionalInstructions;
  final Map<String, Object?> dynamicValues;
  final Map<String, DynamicFieldError> fieldErrors;
  final List<Attachment> attachments;
  final JobUrgency urgency;

  /// `yyyy-MM-dd` for a scheduled visit.
  final String? preferredDate;

  /// `MORNING` | `AFTERNOON` | `EVENING`.
  final String? preferredTimeSlot;
  final FareEstimate? estimate;
  final CheckoutSelection checkout;
  final bool loadingCategory;
  final bool estimating;
  final bool submitting;
  final AppFailure? failure;

  ServiceSubcategory? get subcategory {
    final ServiceCategory? category = this.category;
    if (category == null || subcategoryId == null) return null;
    for (final ServiceSubcategory sub in category.subcategories) {
      if (sub.id == subcategoryId) return sub;
    }
    return null;
  }

  List<ServiceOption> get availableOptions => subcategory?.options ?? const <ServiceOption>[];

  int get minImages => category?.requiredMedia.minImages ?? 0;

  bool get hasEnoughMedia => attachments.where((Attachment a) => a.isReady).length >= minImages;

  bool get canEstimate => location != null && !loadingCategory;

  bool get descriptionValid => description.trim().length >= 5;

  bool get canSubmit =>
      canEstimate &&
      descriptionValid &&
      hasEnoughMedia &&
      fieldErrors.isEmpty &&
      estimate != null &&
      !submitting &&
      !estimating;

  FareOption? get option =>
      estimate == null || estimate!.options.isEmpty ? null : estimate!.options.first;

  List<String> get readyMediaIds =>
      attachments.where((Attachment a) => a.isReady).map((Attachment a) => a.mediaId!).toList(growable: false);

  ServiceFlowState copyWith({
    ServiceCategory? category,
    Address? location,
    String? subcategoryId,
    Set<String>? optionIds,
    String? description,
    String? additionalInstructions,
    Map<String, Object?>? dynamicValues,
    Map<String, DynamicFieldError>? fieldErrors,
    List<Attachment>? attachments,
    JobUrgency? urgency,
    String? preferredDate,
    String? preferredTimeSlot,
    FareEstimate? estimate,
    CheckoutSelection? checkout,
    bool? loadingCategory,
    bool? estimating,
    bool? submitting,
    AppFailure? failure,
    bool clearEstimate = false,
    bool clearFailure = false,
    bool clearSubcategory = false,
    bool clearSchedule = false,
  }) =>
      ServiceFlowState(
        idempotencyKey: idempotencyKey,
        categoryId: categoryId,
        category: category ?? this.category,
        location: location ?? this.location,
        subcategoryId: clearSubcategory ? null : (subcategoryId ?? this.subcategoryId),
        optionIds: optionIds ?? this.optionIds,
        description: description ?? this.description,
        additionalInstructions: additionalInstructions ?? this.additionalInstructions,
        dynamicValues: dynamicValues ?? this.dynamicValues,
        fieldErrors: fieldErrors ?? this.fieldErrors,
        attachments: attachments ?? this.attachments,
        urgency: urgency ?? this.urgency,
        preferredDate: clearSchedule ? null : (preferredDate ?? this.preferredDate),
        preferredTimeSlot: clearSchedule ? null : (preferredTimeSlot ?? this.preferredTimeSlot),
        estimate: clearEstimate ? null : (estimate ?? this.estimate),
        checkout: checkout ?? this.checkout,
        loadingCategory: loadingCategory ?? this.loadingCategory,
        estimating: estimating ?? this.estimating,
        submitting: submitting ?? this.submitting,
        failure: clearFailure ? null : (failure ?? this.failure),
      );
}

/// Drives the home-service flow, including the category's dynamic questions.
class ServiceFlowController extends AutoDisposeFamilyNotifier<ServiceFlowState, String> {
  /// Stable for the life of this draft, so a manual retry after a timeout can
  /// never create a second job.
  final String _idempotencyKey = const Uuid().v4();

  @override
  ServiceFlowState build(String arg) {
    // The full category (subcategories, options, dynamic questions) arrives
    // asynchronously. `build` re-runs once when it lands, which is before the
    // form is interactive — the screen shows a skeleton until then.
    final AsyncValue<ServiceCategory> category = ref.watch(categoryProvider(arg));
    final ServiceCategory? loaded = category.valueOrNull;

    return ServiceFlowState(
      idempotencyKey: _idempotencyKey,
      categoryId: arg,
      category: loaded,
      loadingCategory: loaded == null,
      location: ref.read(currentAddressProvider),
      subcategoryId: loaded == null || loaded.subcategories.isEmpty ? null : loaded.subcategories.first.id,
      checkout: CheckoutSelection(promoCode: ref.read(pendingPromoProvider)),
      failure: category.hasError ? asFailure(category.error!) : null,
    );
  }

  void setLocation(Address address) => state = state.copyWith(location: address, clearEstimate: true);

  void selectSubcategory(String? id) => state = state.copyWith(
        subcategoryId: id,
        clearSubcategory: id == null,
        optionIds: <String>{},
        clearEstimate: true,
      );

  void toggleOption(String optionId) {
    final Set<String> next = <String>{...state.optionIds};
    if (!next.add(optionId)) next.remove(optionId);
    state = state.copyWith(optionIds: next, clearEstimate: true);
  }

  void setDescription(String value) => state = state.copyWith(description: value);

  void setAdditionalInstructions(String value) => state = state.copyWith(additionalInstructions: value);

  void setUrgency(JobUrgency urgency) => state = state.copyWith(urgency: urgency, clearEstimate: true);

  void setPreferredSlot({String? date, String? slot}) {
    if (date == null && slot == null) {
      state = state.copyWith(clearSchedule: true);
      return;
    }
    state = state.copyWith(preferredDate: date, preferredTimeSlot: slot);
  }

  /// Stores one dynamic answer and re-validates just that field.
  void setDynamicValue(String key, Object? value) {
    final Map<String, Object?> values = <String, Object?>{...state.dynamicValues, key: value};
    final List<DynamicField> fields = state.category?.requiredFields ?? const <DynamicField>[];
    state = state.copyWith(
      dynamicValues: values,
      fieldErrors: DynamicFieldValidator.validateAll(fields, values),
    );
  }

  void setPaymentMethod(PaymentMethod method) =>
      state = state.copyWith(checkout: state.checkout.copyWith(paymentMethod: method));

  Future<void> addPhotos({required bool fromCamera}) async {
    final MediaRepository media = ref.read(mediaRepositoryProvider);
    final int max = state.category?.requiredMedia.maxImages ?? 6;
    final List<Attachment> picked = await media.pickImages(fromCamera: fromCamera, limit: max);
    if (picked.isEmpty) return;

    state = state.copyWith(
      attachments: <Attachment>[
        ...state.attachments,
        ...picked.map((Attachment a) => a.copyWith(uploading: true)),
      ].take(max).toList(growable: false),
    );

    for (final Attachment attachment in picked) {
      try {
        final Attachment uploaded = await media.upload(attachment, purpose: MediaPurpose.jobAttachment);
        _replaceAttachment(attachment.localPath, uploaded);
      } on Object {
        _replaceAttachment(attachment.localPath, attachment.copyWith(uploading: false, failed: true));
      }
    }
  }

  void removeAttachment(String localPath) => state = state.copyWith(
        attachments:
            state.attachments.where((Attachment a) => a.localPath != localPath).toList(growable: false),
      );

  Future<void> estimate() async {
    if (!state.canEstimate) return;
    state = state.copyWith(estimating: true, clearFailure: true, clearEstimate: true);
    try {
      final FareEstimate result = await ref.read(pricingRepositoryProvider).serviceEstimate(
            location: state.location!,
            categoryId: state.categoryId,
            urgency: state.urgency,
            subcategoryId: state.subcategoryId,
            optionIds: state.optionIds.toList(growable: false),
            scheduledFor: state.checkout.scheduledFor,
          );
      state = state.copyWith(estimate: result, estimating: false);
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
    if (estimate == null) return null;

    // Re-validate everything before sending; the server checks again anyway.
    final Map<String, DynamicFieldError> errors = DynamicFieldValidator.validateAll(
      state.category?.requiredFields ?? const <DynamicField>[],
      state.dynamicValues,
    );
    if (errors.isNotEmpty) {
      state = state.copyWith(fieldErrors: errors);
      return null;
    }

    state = state.copyWith(submitting: true, clearFailure: true);
    try {
      final JsonMap body = <String, Object?>{
        'type': JobType.homeService.value,
        'estimateId': estimate.estimateId,
        'location': state.location!.toJson(),
        'categoryId': state.categoryId,
        if (state.subcategoryId != null) 'subcategoryId': state.subcategoryId,
        'optionIds': state.optionIds.toList(growable: false),
        'description': state.description.trim(),
        'mediaIds': state.readyMediaIds,
        'urgency': state.urgency.value,
        'dynamicFields': state.dynamicValues,
        if (state.preferredDate != null) 'preferredDate': state.preferredDate,
        if (state.preferredTimeSlot != null) 'preferredTimeSlot': state.preferredTimeSlot,
        if (state.additionalInstructions.trim().isNotEmpty)
          'additionalInstructions': state.additionalInstructions.trim(),
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
      attachments:
          state.attachments.map((Attachment a) => a.localPath == localPath ? next : a).toList(growable: false),
    );
  }
}

final AutoDisposeNotifierProviderFamily<ServiceFlowController, ServiceFlowState, String>
    serviceFlowProvider =
    NotifierProvider.autoDispose.family<ServiceFlowController, ServiceFlowState, String>(
  ServiceFlowController.new,
);
