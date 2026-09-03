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
import 'package:tamam_customer/core/widgets/phone_field.dart';
import 'package:tamam_customer/core/widgets/skeleton_box.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/catalog/domain/catalog.dart';
import 'package:tamam_customer/features/catalog/presentation/catalog_providers.dart';
import 'package:tamam_customer/features/delivery/presentation/delivery_flow_controller.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/presentation/job_labels.dart';
import 'package:tamam_customer/features/jobs/presentation/widgets/checkout_panel.dart';
import 'package:tamam_customer/features/jobs/presentation/widgets/fare_option_card.dart';
import 'package:tamam_customer/features/media/presentation/widgets/attachment_picker.dart';
import 'package:tamam_customer/features/places/presentation/address_sheet.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// The delivery flow, as one scrollable form: route, package, contacts,
/// attachments, urgency, then the estimate and checkout.
class DeliveryFlowScreen extends ConsumerStatefulWidget {
  const DeliveryFlowScreen({super.key});

  @override
  ConsumerState<DeliveryFlowScreen> createState() => _DeliveryFlowScreenState();
}

class _DeliveryFlowScreenState extends ConsumerState<DeliveryFlowScreen> {
  Future<void> _pickAddress({required bool isPickup}) async {
    final AppLocalizations l10n = context.l10n;
    final Address? address = await AddressSheet.show(
      context,
      ref,
      title: isPickup ? l10n.deliveryPickupTitle : l10n.deliveryDropoffTitle,
      applyToCurrent: false,
    );
    if (address == null) return;
    final DeliveryFlowController controller = ref.read(deliveryFlowProvider.notifier);
    if (isPickup) {
      controller.setPickup(address);
    } else {
      controller.setDestination(address);
    }
    unawaited(controller.estimate());
  }

  Future<void> _submit() async {
    final Job? job = await ref.read(deliveryFlowProvider.notifier).submit();
    if (!mounted) return;
    final DeliveryFlowState state = ref.read(deliveryFlowProvider);
    if (job == null) {
      if (state.failure != null) AppFeedback.showFailure(context, state.failure!);
      return;
    }
    context.pushReplacement(Routes.job(job.id));
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final DeliveryFlowState state = ref.watch(deliveryFlowProvider);
    final DeliveryFlowController controller = ref.read(deliveryFlowProvider.notifier);

    return Scaffold(
      backgroundColor: context.colors.background,
      appBar: AppBar(title: Text(l10n.serviceDelivery)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          TamamSpacing.s4,
          TamamSpacing.s4,
          TamamSpacing.s4,
          TamamSpacing.s10,
        ),
        children: <Widget>[
          _Section(
            title: l10n.deliveryRoute,
            child: Column(
              children: <Widget>[
                _AddressTile(
                  icon: Icons.trip_origin_rounded,
                  color: context.colors.mapPickup,
                  label: l10n.deliveryPickupLabel,
                  value: state.pickup?.formatted ?? l10n.ridePickupEmpty,
                  onTap: () => unawaited(_pickAddress(isPickup: true)),
                ),
                Divider(height: 1, color: context.colors.border),
                _AddressTile(
                  icon: Icons.place_rounded,
                  color: context.colors.mapDestination,
                  label: l10n.deliveryDropoffLabel,
                  value: state.destination?.formatted ?? l10n.rideDestinationEmpty,
                  onTap: () => unawaited(_pickAddress(isPickup: false)),
                ),
              ],
            ),
          ),
          _Section(
            title: l10n.deliveryPackage,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const _PackageCategoryChips(),
                const SizedBox(height: TamamSpacing.s4),
                Text(
                  l10n.deliverySize,
                  style: TamamType.labelLg.toTextStyle(color: context.colors.textSecondary),
                ),
                const SizedBox(height: TamamSpacing.s2),
                SegmentedButton<String>(
                  showSelectedIcon: false,
                  segments: <ButtonSegment<String>>[
                    for (final String size in const <String>['SMALL', 'MEDIUM', 'LARGE', 'XL'])
                      ButtonSegment<String>(value: size, label: Text(JobLabels.packageSize(l10n, size))),
                  ],
                  selected: <String>{state.size},
                  onSelectionChanged: (Set<String> value) => controller.setSize(value.first),
                ),
                const SizedBox(height: TamamSpacing.s4),
                TextField(
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    labelText: l10n.deliveryWeight,
                    suffixText: l10n.unitKg,
                  ),
                  onChanged: (String value) => controller.setWeight(double.tryParse(value)),
                ),
                const SizedBox(height: TamamSpacing.s4),
                TextField(
                  maxLines: 2,
                  decoration: InputDecoration(labelText: l10n.deliveryDescription),
                  onChanged: controller.setDescription,
                ),
                const SizedBox(height: TamamSpacing.s4),
                AttachmentPicker(
                  attachments: state.attachments,
                  hint: l10n.deliveryPhotosHint,
                  onAdd: ({required bool fromCamera}) =>
                      unawaited(controller.addPhotos(fromCamera: fromCamera)),
                  onRemove: controller.removeAttachment,
                ),
              ],
            ),
          ),
          _Section(
            title: l10n.deliverySender,
            child: _ContactForm(
              contact: state.sender,
              nameLabel: l10n.contactName,
              onChanged: controller.setSender,
            ),
          ),
          _Section(
            title: l10n.deliveryRecipient,
            child: Column(
              children: <Widget>[
                _ContactForm(
                  contact: state.recipient,
                  nameLabel: l10n.contactName,
                  onChanged: controller.setRecipient,
                ),
                const SizedBox(height: TamamSpacing.s3),
                TextField(
                  maxLines: 2,
                  decoration: InputDecoration(labelText: l10n.deliveryNotes),
                  onChanged: controller.setDeliveryNotes,
                ),
              ],
            ),
          ),
          if (ref.watch(featureFlagsValueProvider).hasUrgentServices)
            _Section(
              title: l10n.deliveryUrgency,
              child: Wrap(
                spacing: TamamSpacing.s2,
                children: JobUrgency.values
                    .map(
                      (JobUrgency urgency) => ChoiceChip(
                        label: Text(JobLabels.urgency(l10n, urgency)),
                        selected: state.urgency == urgency,
                        onSelected: (bool _) {
                          controller.setUrgency(urgency);
                          unawaited(controller.estimate());
                        },
                      ),
                    )
                    .toList(growable: false),
              ),
            ),
          _EstimateSection(
            state: state,
            onEstimate: () => unawaited(controller.estimate()),
            onSubmit: () => unawaited(_submit()),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

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

class _PackageCategoryChips extends ConsumerWidget {
  const _PackageCategoryChips();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final String language = ref.watch(localeControllerProvider).languageCode;
    final DeliveryFlowState state = ref.watch(deliveryFlowProvider);

    return ref.watch(packageCategoriesProvider).when(
          skipLoadingOnRefresh: true,
          loading: () => const SkeletonBox(height: 40),
          error: (Object _, StackTrace __) => Text(
            l10n.deliveryCategoriesUnavailable,
            style: TamamType.bodySm.toTextStyle(color: context.colors.danger),
          ),
          data: (List<PackageCategory> categories) => Wrap(
            spacing: TamamSpacing.s2,
            runSpacing: TamamSpacing.s2,
            children: categories
                .map(
                  (PackageCategory category) => ChoiceChip(
                    label: Text(category.name.resolve(language)),
                    selected: state.packageCategoryId == category.id,
                    onSelected: (bool _) {
                      ref.read(deliveryFlowProvider.notifier).setPackageCategory(category.id);
                      unawaited(ref.read(deliveryFlowProvider.notifier).estimate());
                    },
                  ),
                )
                .toList(growable: false),
          ),
        );
  }
}

class _ContactForm extends StatelessWidget {
  const _ContactForm({required this.contact, required this.nameLabel, required this.onChanged});

  final Contact contact;
  final String nameLabel;
  final ValueChanged<Contact> onChanged;

  @override
  Widget build(BuildContext context) => Column(
        children: <Widget>[
          TextFormField(
            initialValue: contact.name,
            textCapitalization: TextCapitalization.words,
            decoration: InputDecoration(labelText: nameLabel),
            onChanged: (String value) => onChanged(contact.copyWith(name: value)),
          ),
          const SizedBox(height: TamamSpacing.s3),
          PhoneField(
            initialValue: contact.phone.isEmpty ? null : contact.phone,
            label: context.l10n.contactPhone,
            onChanged: (String? value) => onChanged(contact.copyWith(phone: value ?? '')),
          ),
        ],
      );
}

class _EstimateSection extends ConsumerWidget {
  const _EstimateSection({
    required this.state,
    required this.onEstimate,
    required this.onSubmit,
  });

  final DeliveryFlowState state;
  final VoidCallback onEstimate;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final DeliveryFlowController controller = ref.read(deliveryFlowProvider.notifier);

    if (state.estimating) {
      return const TamamCard(child: SkeletonList(itemCount: 2, itemHeight: 64));
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
            onPressed: state.canEstimate ? onEstimate : null,
          ),
        ],
      );
    }

    return TamamCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          for (int i = 0; i < state.estimate!.options.length; i++) ...<Widget>[
            FareOptionCard(
              option: state.estimate!.options[i],
              selected: state.selectedOption == i,
              onTap: () => controller.selectOption(i),
            ),
            const SizedBox(height: TamamSpacing.s2),
          ],
          const SizedBox(height: TamamSpacing.s2),
          CheckoutPanel(
            selection: state.checkout,
            onPaymentChanged: controller.setPaymentMethod,
            onApplyPromo: (String code) => unawaited(controller.applyPromo(code)),
            onClearPromo: controller.clearPromo,
            onScheduleChanged: controller.setSchedule,
          ),
          const SizedBox(height: TamamSpacing.s4),
          if (state.option != null)
            FareBreakdownList(
              lines: state.option!.breakdown,
              total: Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      l10n.checkoutTotal,
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
          if (!state.contactsComplete)
            Padding(
              padding: const EdgeInsets.only(bottom: TamamSpacing.s2),
              child: Text(
                l10n.deliveryContactsRequired,
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

class _AddressTile extends StatelessWidget {
  const _AddressTile({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Icon(icon, color: color),
        title: Text(label, style: TamamType.labelSm.toTextStyle(color: context.colors.textTertiary)),
        subtitle: Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TamamType.bodyLg.toTextStyle(color: context.colors.textPrimary),
        ),
        onTap: onTap,
      );
}
