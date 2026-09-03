import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/format/money_formatter.dart';
import 'package:tamam_partner/core/format/phone_formatter.dart';
import 'package:tamam_partner/core/models/money.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/money_text.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/active_job/presentation/active_job_controller.dart';
import 'package:tamam_partner/features/quotes/domain/quote_draft.dart';
import 'package:tamam_partner/features/quotes/presentation/quote_providers.dart';
import 'package:tamam_partner/features/quotes/presentation/widgets/quote_item_sheet.dart';
import 'package:tamam_partner/features/quotes/presentation/widgets/quote_summary_card.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Build a quote (or change order): line items, discount, description,
/// estimated duration, live *preview* total, submit.
class QuoteBuilderScreen extends ConsumerStatefulWidget {
  const QuoteBuilderScreen({required this.jobId, super.key, this.changeOrder = false});

  final String jobId;
  final bool changeOrder;

  @override
  ConsumerState<QuoteBuilderScreen> createState() => _QuoteBuilderScreenState();
}

class _QuoteBuilderScreenState extends ConsumerState<QuoteBuilderScreen> {
  late final QuoteBuilderArgs _args = QuoteBuilderArgs(jobId: widget.jobId, changeOrder: widget.changeOrder);
  final TextEditingController _discount = TextEditingController();
  final TextEditingController _description = TextEditingController();
  final TextEditingController _duration = TextEditingController();
  bool _seeded = false;

  @override
  void dispose() {
    _discount.dispose();
    _description.dispose();
    _duration.dispose();
    super.dispose();
  }

  void _seed(QuoteBuilderState state) {
    if (_seeded) return;
    _seeded = true;
    if (state.draft.discountMinor > 0) {
      _discount.text = minorToEditable(state.draft.discountMinor, state.draft.currency);
    }
    _description.text = state.draft.description;
    if (state.draft.estimatedDurationMin != null) _duration.text = '${state.draft.estimatedDurationMin}';
  }

  Future<void> _addItem(String currency) async {
    final QuoteDraftItem? item = await QuoteItemSheet.show(context, currency: currency);
    if (item != null) ref.read(quoteBuilderProvider(_args).notifier).addItem(item);
  }

  Future<void> _editItem(int index, QuoteDraftItem current, String currency) async {
    final QuoteDraftItem? item = await QuoteItemSheet.show(context, currency: currency, initial: current);
    if (item != null) ref.read(quoteBuilderProvider(_args).notifier).replaceItem(index, item);
  }

  Future<void> _submit() async {
    final bool ok = await ref.read(quoteBuilderProvider(_args).notifier).submit();
    if (!mounted) return;
    final QuoteBuilderState? state = ref.read(quoteBuilderProvider(_args)).valueOrNull;
    if (ok && state?.submittedJob != null) {
      ref.read(activeJobProvider(widget.jobId).notifier).applyJob(state!.submittedJob!);
      AppFeedback.showMessage(context, context.l10n.quoteSubmitted, icon: Icons.check_rounded);
      context.pop();
    } else if (state?.failure != null) {
      AppFeedback.showFailure(context, state!.failure!);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AsyncValue<QuoteBuilderState> value = ref.watch(quoteBuilderProvider(_args));

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(widget.changeOrder ? l10n.quoteBuilderChangeOrderTitle : l10n.quoteBuilderTitle)),
      body: AsyncView<QuoteBuilderState>(
        value: value,
        onRetry: () => ref.invalidate(quoteBuilderProvider(_args)),
        builder: (QuoteBuilderState state) {
          _seed(state);
          final QuoteDraft draft = state.draft;
          final QuoteBuilderController controller = ref.read(quoteBuilderProvider(_args).notifier);
          final MoneyFormatter money = ref.watch(moneyFormatterProvider);

          return Column(
            children: <Widget>[
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(TamamSpacing.s4),
                  children: <Widget>[
                    if (state.rejectedNote != null && state.rejectedNote!.isNotEmpty)
                      Container(
                        margin: const EdgeInsets.only(bottom: TamamSpacing.s3),
                        padding: const EdgeInsets.all(TamamSpacing.s3),
                        decoration: BoxDecoration(
                          color: colors.dangerSoft,
                          borderRadius: BorderRadius.circular(TamamRadius.md),
                        ),
                        child: Text(
                          l10n.quoteRejectionNote(state.rejectedNote!),
                          style: TamamType.bodySm.toTextStyle(color: TamamSemantic.dangerStrong),
                        ),
                      ),
                    if (widget.changeOrder)
                      Padding(
                        padding: const EdgeInsets.only(bottom: TamamSpacing.s3),
                        child: Text(
                          l10n.quoteChangeOrderHint,
                          style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                        ),
                      ),
                    Text(l10n.quoteItemsTitle, style: TamamType.headingSm.toTextStyle(color: colors.textPrimary)),
                    const SizedBox(height: TamamSpacing.s2),
                    if (draft.items.isEmpty)
                      TamamCard(
                        onTap: () => unawaited(_addItem(draft.currency)),
                        child: Row(
                          children: <Widget>[
                            Icon(Icons.add_circle_outline_rounded, color: colors.primary),
                            const SizedBox(width: TamamSpacing.s3),
                            Expanded(
                              child: Text(
                                l10n.quoteEmptyHint,
                                style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                              ),
                            ),
                          ],
                        ),
                      ),
                    for (int i = 0; i < draft.items.length; i++)
                      _DraftItemTile(
                        item: draft.items[i],
                        currency: draft.currency,
                        onTap: () => unawaited(_editItem(i, draft.items[i], draft.currency)),
                        onRemove: () => controller.removeItem(i),
                      ),
                    if (draft.items.isNotEmpty && draft.items.length < QuoteDraft.maxItems)
                      TextButton.icon(
                        onPressed: () => unawaited(_addItem(draft.currency)),
                        icon: const Icon(Icons.add_rounded),
                        label: Text(l10n.quoteAddItem),
                      ),
                    const SizedBox(height: TamamSpacing.s4),
                    TamamCard(
                      child: Column(
                        children: <Widget>[
                          TextField(
                            controller: _discount,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            textDirection: TextDirection.ltr,
                            inputFormatters: <TextInputFormatter>[
                              FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩.,٫]')),
                            ],
                            onChanged: (String text) =>
                                controller.setDiscount(parseMajorToMinor(text, draft.currency) ?? 0),
                            decoration: InputDecoration(
                              labelText: l10n.quoteDiscount,
                              suffixText: MoneyFormatter.symbolFor(draft.currency),
                              errorText: draft.discountExceedsSubtotal ? l10n.quoteDiscountTooLarge : null,
                            ),
                          ),
                          const SizedBox(height: TamamSpacing.s3),
                          TextField(
                            controller: _duration,
                            keyboardType: TextInputType.number,
                            textDirection: TextDirection.ltr,
                            inputFormatters: <TextInputFormatter>[
                              FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩]')),
                              LengthLimitingTextInputFormatter(5),
                            ],
                            onChanged: (String text) {
                              final int? minutes = int.tryParse(PhoneFormatter.digitsOnly(text));
                              controller.setDuration(minutes == null || minutes < 5 ? null : minutes);
                            },
                            decoration: InputDecoration(
                              labelText: l10n.quoteDurationLabel,
                              helperText: l10n.quoteDurationHint,
                            ),
                          ),
                          const SizedBox(height: TamamSpacing.s3),
                          TextField(
                            controller: _description,
                            maxLines: 4,
                            maxLength: 1000,
                            textCapitalization: TextCapitalization.sentences,
                            onChanged: controller.setDescription,
                            decoration: InputDecoration(
                              labelText: l10n.quoteDescriptionLabel,
                              alignLabelWithHint: true,
                              counterText: '',
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: TamamSpacing.s4),
                    _PreviewTotals(draft: draft, money: money),
                    if (state.failure != null) ...<Widget>[
                      const SizedBox(height: TamamSpacing.s3),
                      Text(
                        state.failure!.isVersionConflict
                            ? l10n.quoteVersionConflict
                            : localizedFailure(l10n, state.failure!),
                        style: TamamType.bodySm.toTextStyle(color: colors.danger),
                      ),
                    ],
                    const SizedBox(height: TamamSpacing.s8),
                  ],
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(TamamSpacing.s4, 0, TamamSpacing.s4, TamamSpacing.s4),
                  child: TamamButton(
                    label: widget.changeOrder ? l10n.quoteSubmitChangeOrder : l10n.quoteSubmit,
                    busy: state.busy,
                    onPressed: draft.canSubmit ? () => unawaited(_submit()) : null,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _DraftItemTile extends ConsumerWidget {
  const _DraftItemTile({
    required this.item,
    required this.currency,
    required this.onTap,
    required this.onRemove,
  });

  final QuoteDraftItem item;
  final String currency;
  final VoidCallback onTap;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final MoneyFormatter money = ref.watch(moneyFormatterProvider);
    return TamamCard(
      margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
      onTap: onTap,
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(item.description, style: TamamType.bodyLg.toTextStyle(color: colors.textPrimary)),
                Text(
                  '${QuoteLabels.kind(l10n, item.kind)} · ${item.quantity} × ${money.formatCompact(Money(amount: item.unitPriceMinor, currency: currency))}',
                  textDirection: TextDirection.ltr,
                  style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                ),
              ],
            ),
          ),
          MoneyText(Money(amount: item.lineTotalMinor, currency: currency), emphasis: MoneyEmphasis.medium),
          IconButton(
            tooltip: l10n.actionRemove,
            onPressed: onRemove,
            icon: Icon(Icons.delete_outline_rounded, color: colors.danger),
          ),
        ],
      ),
    );
  }
}

class _PreviewTotals extends StatelessWidget {
  const _PreviewTotals({required this.draft, required this.money});

  final QuoteDraft draft;
  final MoneyFormatter money;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    return TamamCard(
      background: colors.surfaceBrandSoft,
      elevated: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(Icons.calculate_outlined, size: TamamSize.iconSm, color: colors.primary),
              const SizedBox(width: TamamSpacing.s1),
              Text(l10n.quotePreviewTitle, style: TamamType.labelMd.toTextStyle(color: colors.primary)),
            ],
          ),
          const SizedBox(height: TamamSpacing.s2),
          _Line(label: l10n.quoteKindLabor, value: money.format(draft.labor)),
          _Line(label: l10n.quoteKindParts, value: money.format(draft.parts)),
          _Line(label: l10n.quoteKindFee, value: money.format(draft.fees)),
          if (draft.discountMinor > 0) _Line(label: l10n.quoteDiscount, value: '- ${money.format(draft.discount)}'),
          Divider(color: colors.border),
          Row(
            children: <Widget>[
              Expanded(child: Text(l10n.quotePreviewTotal, style: TamamType.labelLg.toTextStyle(color: colors.textPrimary))),
              MoneyText(draft.previewTotal),
            ],
          ),
          const SizedBox(height: TamamSpacing.s1),
          Text(l10n.quotePreviewDisclaimer, style: TamamType.bodySm.toTextStyle(color: colors.textTertiary)),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: <Widget>[
            Expanded(child: Text(label, style: TamamType.bodyMd.toTextStyle(color: context.colors.textSecondary))),
            Text(value, textDirection: TextDirection.ltr, style: TamamType.labelMd.toTextStyle(color: context.colors.textPrimary)),
          ],
        ),
      );
}
