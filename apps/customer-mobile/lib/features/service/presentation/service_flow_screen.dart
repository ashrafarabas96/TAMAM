import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/core/widgets/skeleton_box.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/catalog/domain/catalog.dart';
import 'package:tamam_customer/features/catalog/presentation/widgets/dynamic_form.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/presentation/job_labels.dart';
import 'package:tamam_customer/features/jobs/presentation/widgets/checkout_panel.dart';
import 'package:tamam_customer/features/jobs/presentation/widgets/fare_option_card.dart';
import 'package:tamam_customer/features/media/presentation/widgets/attachment_picker.dart';
import 'package:tamam_customer/features/places/presentation/address_sheet.dart';
import 'package:tamam_customer/features/service/presentation/service_flow_controller.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// The home-service flow: location, subcategory, options, the problem
/// description with the category's dynamic questions, media, urgency, the
/// preferred slot, then the estimate and checkout.
class ServiceFlowScreen extends ConsumerStatefulWidget {
  const ServiceFlowScreen({required this.categoryId, super.key});

  final String categoryId;

  @override
  ConsumerState<ServiceFlowScreen> createState() => _ServiceFlowScreenState();
}

class _ServiceFlowScreenState extends ConsumerState<ServiceFlowScreen> {
  ServiceFlowController get _controller => ref.read(serviceFlowProvider(widget.categoryId).notifier);

  Future<void> _pickLocation() async {
    final Address? address = await AddressSheet.show(
      context,
      ref,
      title: context.l10n.serviceLocationTitle,
      applyToCurrent: false,
    );
    if (address == null) return;
    _controller.setLocation(address);
    unawaited(_controller.estimate());
  }

  Future<void> _submit() async {
    final Job? job = await _controller.submit();
    if (!mounted) return;
    final ServiceFlowState state = ref.read(serviceFlowProvider(widget.categoryId));
    if (job == null) {
      if (state.failure != null) AppFeedback.showFailure(context, state.failure!);
      return;
    }
    context.pushReplacement(Routes.job(job.id));
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final String language = ref.watch(localeControllerProvider).languageCode;
    final ServiceFlowState state = ref.watch(serviceFlowProvider(widget.categoryId));
    final ServiceCategory? category = state.category;

    return Scaffold(
      backgroundColor: context.colors.background,
      appBar: AppBar(
        title: Text(category?.name.resolve(language) ?? l10n.serviceHome),
      ),
      body: state.loadingCategory
          ? const Padding(
              padding: EdgeInsets.all(TamamSpacing.s4),
              child: SkeletonList(itemCount: 5, itemHeight: 92),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                TamamSpacing.s4,
                TamamSpacing.s4,
                TamamSpacing.s4,
                TamamSpacing.s10,
              ),
              children: <Widget>[
                _Block(
                  title: l10n.serviceLocationTitle,
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(Icons.place_rounded, color: context.colors.primary),
                    title: Text(
                      state.location?.formatted ?? l10n.serviceLocationEmpty,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: TextButton(
                      onPressed: () => unawaited(_pickLocation()),
                      child: Text(l10n.actionChange),
                    ),
                    onTap: () => unawaited(_pickLocation()),
                  ),
                ),
                if (category != null && category.subcategories.isNotEmpty)
                  _Block(
                    title: l10n.serviceSubcategory,
                    child: Wrap(
                      spacing: TamamSpacing.s2,
                      runSpacing: TamamSpacing.s2,
                      children: category.subcategories
                          .map(
                            (ServiceSubcategory sub) => ChoiceChip(
                              label: Text(sub.name.resolve(language)),
                              selected: state.subcategoryId == sub.id,
                              onSelected: (bool _) {
                                _controller.selectSubcategory(sub.id);
                                unawaited(_controller.estimate());
                              },
                            ),
                          )
                          .toList(growable: false),
                    ),
                  ),
                if (state.availableOptions.isNotEmpty)
                  _Block(
                    title: l10n.serviceOptions,
                    child: Column(
                      children: state.availableOptions
                          .map(
                            (ServiceOption option) => CheckboxListTile(
                              contentPadding: EdgeInsets.zero,
                              controlAffinity: ListTileControlAffinity.leading,
                              value: state.optionIds.contains(option.id),
                              title: Text(option.name.resolve(language)),
                              secondary: MoneyText(option.price, emphasis: MoneyEmphasis.subtle),
                              onChanged: (bool? _) {
                                _controller.toggleOption(option.id);
                                unawaited(_controller.estimate());
                              },
                            ),
                          )
                          .toList(growable: false),
                    ),
                  ),
                _Block(
                  title: l10n.serviceProblemTitle,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      TextField(
                        maxLines: 4,
                        decoration: InputDecoration(
                          hintText: l10n.serviceProblemHint,
                          errorText: state.description.isEmpty || state.descriptionValid
                              ? null
                              : l10n.serviceProblemTooShort,
                          alignLabelWithHint: true,
                        ),
                        onChanged: _controller.setDescription,
                      ),
                      if (category != null && category.requiredFields.isNotEmpty) ...<Widget>[
                        const SizedBox(height: TamamSpacing.s5),
                        DynamicFieldsForm(
                          fields: category.requiredFields,
                          values: state.dynamicValues,
                          errors: state.fieldErrors,
                          onChanged: _controller.setDynamicValue,
                        ),
                      ],
                      const SizedBox(height: TamamSpacing.s4),
                      AttachmentPicker(
                        attachments: state.attachments,
                        maxItems: category?.requiredMedia.maxImages ?? 6,
                        hint: state.minImages > 0
                            ? l10n.serviceMediaRequired(state.minImages)
                            : l10n.serviceMediaOptional,
                        onAdd: ({required bool fromCamera}) =>
                            unawaited(_controller.addPhotos(fromCamera: fromCamera)),
                        onRemove: _controller.removeAttachment,
                      ),
                      const SizedBox(height: TamamSpacing.s4),
                      TextField(
                        maxLines: 2,
                        decoration: InputDecoration(labelText: l10n.serviceInstructions),
                        onChanged: _controller.setAdditionalInstructions,
                      ),
                    ],
                  ),
                ),
                if (category != null && category.urgencyLevels.length > 1)
                  _Block(
                    title: l10n.serviceUrgencyTitle,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Wrap(
                          spacing: TamamSpacing.s2,
                          children: category.urgencyLevels
                              .map(
                                (JobUrgency urgency) => ChoiceChip(
                                  label: Text(JobLabels.urgency(l10n, urgency)),
                                  selected: state.urgency == urgency,
                                  onSelected: (bool _) {
                                    _controller.setUrgency(urgency);
                                    unawaited(_controller.estimate());
                                  },
                                ),
                              )
                              .toList(growable: false),
                        ),
                        if (state.urgency != JobUrgency.standard)
                          Padding(
                            padding: const EdgeInsets.only(top: TamamSpacing.s2),
                            child: Text(
                              l10n.serviceUrgencySurcharge,
                              style: TamamType.bodySm.toTextStyle(color: context.colors.warning),
                            ),
                          ),
                      ],
                    ),
                  ),
                if (category?.allowsScheduled ?? false)
                  _Block(
                    title: l10n.serviceWhenTitle,
                    child: _PreferredSlotPicker(
                      state: state,
                      onChanged: ({String? date, String? slot}) =>
                          _controller.setPreferredSlot(date: date, slot: slot),
                    ),
                  ),
                _ServiceEstimate(
                  categoryId: widget.categoryId,
                  onSubmit: () => unawaited(_submit()),
                ),
              ],
            ),
    );
  }
}

class _Block extends StatelessWidget {
  const _Block({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: TamamSpacing.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.only(bottom: TamamSpacing.s2),
              child: Semantics(
                header: true,
                child: Text(
                  title,
                  style: TamamType.headingSm.toTextStyle(color: context.colors.textPrimary),
                ),
              ),
            ),
            TamamCard(child: child),
          ],
        ),
      );
}

class _PreferredSlotPicker extends ConsumerWidget {
  const _PreferredSlotPicker({required this.state, required this.onChanged});

  final ServiceFlowState state;
  final void Function({String? date, String? slot}) onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            ChoiceChip(
              label: Text(l10n.serviceWhenNow),
              selected: state.preferredDate == null,
              onSelected: (bool _) => onChanged(),
            ),
            const SizedBox(width: TamamSpacing.s2),
            ChoiceChip(
              label: Text(
                state.preferredDate == null ? l10n.serviceWhenScheduled : state.preferredDate!,
              ),
              selected: state.preferredDate != null,
              onSelected: (bool _) => unawaited(_pickDate(context)),
            ),
          ],
        ),
        if (state.preferredDate != null) ...<Widget>[
          const SizedBox(height: TamamSpacing.s3),
          Wrap(
            spacing: TamamSpacing.s2,
            children: const <String>['MORNING', 'AFTERNOON', 'EVENING']
                .map(
                  (String slot) => ChoiceChip(
                    label: Text(JobLabels.timeSlot(l10n, slot)),
                    selected: state.preferredTimeSlot == slot,
                    onSelected: (bool _) => onChanged(date: state.preferredDate, slot: slot),
                  ),
                )
                .toList(growable: false),
          ),
        ],
      ],
    );
  }

  Future<void> _pickDate(BuildContext context) async {
    final DateTime now = DateTime.now();
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 60)),
    );
    if (picked == null) return;
    onChanged(date: picked.toIso8601String().substring(0, 10), slot: state.preferredTimeSlot ?? 'MORNING');
  }
}

class _ServiceEstimate extends ConsumerWidget {
  const _ServiceEstimate({required this.categoryId, required this.onSubmit});

  final String categoryId;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final ServiceFlowState state = ref.watch(serviceFlowProvider(categoryId));
    final ServiceFlowController controller = ref.read(serviceFlowProvider(categoryId).notifier);

    if (state.estimating) {
      return const TamamCard(child: SkeletonList(itemCount: 2, itemHeight: 56));
    }
    if (state.estimate == null) {
      return Column(
        children: <Widget>[
          if (state.failure != null)
            Padding(
              padding: const EdgeInsets.only(bottom: TamamSpacing.s3),
              child: Text(
                localizedFailure(l10n, state.failure!),
                style: TamamType.bodySm.toTextStyle(color: colors.danger),
              ),
            ),
          TamamButton(
            label: l10n.rideGetEstimate,
            onPressed: state.canEstimate ? () => unawaited(controller.estimate()) : null,
          ),
        ],
      );
    }

    return TamamCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (state.category?.needsInspection ?? false) ...<Widget>[
            Container(
              padding: const EdgeInsets.all(TamamSpacing.s3),
              decoration: BoxDecoration(
                color: colors.infoSoft,
                borderRadius: BorderRadius.circular(TamamRadius.md),
              ),
              child: Row(
                children: <Widget>[
                  Icon(Icons.info_outline_rounded, color: TamamSemantic.infoStrong),
                  const SizedBox(width: TamamSpacing.s2),
                  Expanded(
                    child: Text(
                      l10n.pricingInspectionExplainer,
                      style: TamamType.bodySm.toTextStyle(color: TamamSemantic.infoStrong),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: TamamSpacing.s4),
          ],
          CheckoutPanel(
            selection: state.checkout,
            allowScheduling: false,
            onPaymentChanged: controller.setPaymentMethod,
            onApplyPromo: (String code) => unawaited(controller.applyPromo(code)),
            onClearPromo: controller.clearPromo,
            onScheduleChanged: (DateTime? _) {},
          ),
          const SizedBox(height: TamamSpacing.s4),
          if (state.option != null)
            FareBreakdownList(
              lines: state.option!.breakdown,
              total: Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      state.category?.needsInspection ?? false
                          ? l10n.pricingDueNow
                          : l10n.checkoutTotal,
                      style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                    ),
                  ),
                  MoneyText(
                    state.checkout.hasPromo ? state.checkout.promoPreview!.total : state.option!.total,
                  ),
                ],
              ),
            ),
          const SizedBox(height: TamamSpacing.s4),
          if (!state.descriptionValid)
            Padding(
              padding: const EdgeInsets.only(bottom: TamamSpacing.s2),
              child: Text(
                l10n.serviceProblemRequired,
                style: TamamType.bodySm.toTextStyle(color: colors.warning),
              ),
            )
          else if (!state.hasEnoughMedia)
            Padding(
              padding: const EdgeInsets.only(bottom: TamamSpacing.s2),
              child: Text(
                l10n.serviceMediaRequired(state.minImages),
                style: TamamType.bodySm.toTextStyle(color: colors.warning),
              ),
            ),
          TamamButton(
            label: l10n.rideOrderCta,
            busy: state.submitting,
            onPressed: state.canSubmit ? onSubmit : null,
          ),
        ],
      ),
    );
  }
}
