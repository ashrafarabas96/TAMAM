import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/config/feature_flags.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/format/unit_formatter.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/features/jobs/presentation/checkout_state.dart';
import 'package:tamam_customer/features/jobs/presentation/job_labels.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Payment method, promo code and scheduling — the checkout block every flow
/// shows above its final CTA.
class CheckoutPanel extends ConsumerWidget {
  const CheckoutPanel({
    required this.selection,
    required this.onPaymentChanged,
    required this.onApplyPromo,
    required this.onClearPromo,
    required this.onScheduleChanged,
    super.key,
    this.allowScheduling = true,
  });

  final CheckoutSelection selection;
  final ValueChanged<PaymentMethod> onPaymentChanged;
  final ValueChanged<String> onApplyPromo;
  final VoidCallback onClearPromo;

  /// `null` clears the schedule and returns to "now".
  final ValueChanged<DateTime?> onScheduleChanged;
  final bool allowScheduling;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final FeatureFlags flags = ref.watch(featureFlagsValueProvider);

    final List<PaymentMethod> methods = <PaymentMethod>[
      PaymentMethod.cash,
      if (flags.hasWalletPayments) PaymentMethod.wallet,
      if (flags.hasCardPayments) PaymentMethod.card,
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          l10n.checkoutPaymentMethod,
          style: TamamType.labelLg.toTextStyle(color: context.colors.textSecondary),
        ),
        const SizedBox(height: TamamSpacing.s2),
        Wrap(
          spacing: TamamSpacing.s2,
          children: methods
              .map(
                (PaymentMethod method) => ChoiceChip(
                  avatar: Icon(_iconFor(method), size: TamamSize.iconSm),
                  label: Text(JobLabels.paymentMethod(l10n, method)),
                  selected: selection.paymentMethod == method,
                  onSelected: (bool _) => onPaymentChanged(method),
                ),
              )
              .toList(growable: false),
        ),
        const SizedBox(height: TamamSpacing.s4),
        _PromoField(
          selection: selection,
          onApply: onApplyPromo,
          onClear: onClearPromo,
        ),
        if (allowScheduling && flags.hasScheduledJobs) ...<Widget>[
          const SizedBox(height: TamamSpacing.s4),
          _ScheduleRow(selection: selection, onChanged: onScheduleChanged),
        ],
      ],
    );
  }

  IconData _iconFor(PaymentMethod method) {
    switch (method) {
      case PaymentMethod.cash:
        return Icons.payments_outlined;
      case PaymentMethod.wallet:
        return Icons.account_balance_wallet_outlined;
      case PaymentMethod.card:
        return Icons.credit_card_rounded;
      case PaymentMethod.bank:
      case PaymentMethod.externalGateway:
        return Icons.account_balance_outlined;
    }
  }
}

class _PromoField extends StatefulWidget {
  const _PromoField({required this.selection, required this.onApply, required this.onClear});

  final CheckoutSelection selection;
  final ValueChanged<String> onApply;
  final VoidCallback onClear;

  @override
  State<_PromoField> createState() => _PromoFieldState();
}

class _PromoFieldState extends State<_PromoField> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.selection.promoCode ?? '');

  @override
  void didUpdateWidget(covariant _PromoField oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A banner may have handed us a code while this field was on screen.
    final String? code = widget.selection.promoCode;
    if (code != null && code != _controller.text) _controller.text = code;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final CheckoutSelection selection = widget.selection;

    if (selection.hasPromo) {
      return Container(
        padding: const EdgeInsets.all(TamamSpacing.s3),
        decoration: BoxDecoration(
          color: colors.successSoft,
          borderRadius: BorderRadius.circular(TamamRadius.md),
        ),
        child: Row(
          children: <Widget>[
            Icon(Icons.local_offer_rounded, size: TamamSize.iconMd, color: colors.success),
            const SizedBox(width: TamamSpacing.s2),
            Expanded(
              child: Text(
                l10n.checkoutPromoApplied(selection.promoPreview!.code),
                style: TamamType.labelMd.toTextStyle(color: TamamSemantic.successStrong),
              ),
            ),
            MoneyText(
              selection.promoPreview!.discount,
              emphasis: MoneyEmphasis.subtle,
              color: TamamSemantic.successStrong,
            ),
            IconButton(
              tooltip: l10n.actionRemove,
              icon: const Icon(Icons.close_rounded),
              onPressed: widget.onClear,
            ),
          ],
        ),
      );
    }

    return TextField(
      controller: _controller,
      textCapitalization: TextCapitalization.characters,
      textInputAction: TextInputAction.done,
      onSubmitted: widget.onApply,
      decoration: InputDecoration(
        labelText: l10n.checkoutPromoLabel,
        hintText: l10n.checkoutPromoHint,
        errorText: selection.promoFailure == null
            ? null
            : localizedFailure(l10n, selection.promoFailure!),
        prefixIcon: const Icon(Icons.local_offer_outlined),
        suffixIcon: selection.promoBusy
            ? const Padding(
                padding: EdgeInsets.all(14),
                child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
              )
            : TextButton(
                onPressed: () => widget.onApply(_controller.text),
                child: Text(l10n.actionApply),
              ),
      ),
    );
  }
}

class _ScheduleRow extends ConsumerWidget {
  const _ScheduleRow({required this.selection, required this.onChanged});

  final CheckoutSelection selection;
  final ValueChanged<DateTime?> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);

    return Row(
      children: <Widget>[
        Icon(Icons.schedule_rounded, color: colors.textSecondary, size: TamamSize.iconMd),
        const SizedBox(width: TamamSpacing.s3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                l10n.checkoutSchedule,
                style: TamamType.labelLg.toTextStyle(color: colors.textPrimary),
              ),
              Text(
                selection.isScheduled
                    ? units.weekdayTime(selection.scheduledFor!)
                    : l10n.checkoutScheduleNow,
                style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
              ),
            ],
          ),
        ),
        TextButton(
          onPressed: () => unawaited(_pick(context)),
          child: Text(selection.isScheduled ? l10n.actionChange : l10n.actionSchedule),
        ),
        if (selection.isScheduled)
          IconButton(
            tooltip: l10n.actionRemove,
            icon: const Icon(Icons.close_rounded),
            onPressed: () => onChanged(null),
          ),
      ],
    );
  }

  Future<void> _pick(BuildContext context) async {
    final DateTime now = DateTime.now();
    final DateTime? date = await showDatePicker(
      context: context,
      initialDate: selection.scheduledFor ?? now.add(const Duration(hours: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 30)),
    );
    if (date == null || !context.mounted) return;
    final TimeOfDay? time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(selection.scheduledFor ?? now.add(const Duration(hours: 1))),
    );
    if (time == null) return;
    onChanged(DateTime(date.year, date.month, date.day, time.hour, time.minute));
  }
}
