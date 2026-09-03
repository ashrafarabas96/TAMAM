import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/models/money.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/core/widgets/sheet_scaffold.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/domain/quote.dart';
import 'package:tamam_customer/features/jobs/presentation/job_providers.dart';
import 'package:tamam_customer/features/jobs/presentation/job_tracking_controller.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Review, approve or reject a technician's quote or change order.
///
/// The job's `version` travels with the decision so a quote that was superseded
/// while this sheet was open is rejected by the server instead of silently
/// approving the wrong amount.
class QuoteSheet extends ConsumerStatefulWidget {
  const QuoteSheet({required this.job, required this.quote, super.key});

  final Job job;
  final Quote quote;

  static Future<void> show(BuildContext context, {required Job job, required Quote quote}) =>
      SheetScaffold.show<void>(
        context,
        (BuildContext _) => QuoteSheet(job: job, quote: quote),
        dismissible: false,
      );

  @override
  ConsumerState<QuoteSheet> createState() => _QuoteSheetState();
}

class _QuoteSheetState extends ConsumerState<QuoteSheet> {
  final TextEditingController _note = TextEditingController();
  bool _busy = false;
  bool _rejecting = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _decide({required bool approve}) async {
    setState(() => _busy = true);
    try {
      await ref.read(jobsRepositoryProvider).decideQuote(
            widget.job.id,
            approve: approve,
            version: widget.job.version,
            note: _note.text,
          );
      await ref.read(jobTrackingProvider(widget.job.id).notifier).reload();
      if (mounted) Navigator.of(context).pop();
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _busy = false);
      AppFeedback.showFailure(context, asFailure(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final Quote quote = widget.quote;

    return SheetScaffold(
      title: quote.isChangeOrder ? l10n.quoteChangeOrderTitle : l10n.quoteTitle,
      subtitle: l10n.quoteRevision(quote.revision),
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (_rejecting) ...<Widget>[
            TextField(
              controller: _note,
              maxLines: 2,
              decoration: InputDecoration(labelText: l10n.quoteRejectReason),
            ),
            const SizedBox(height: TamamSpacing.s3),
          ],
          TamamButton(
            label: l10n.quoteApprove,
            busy: _busy && !_rejecting,
            onPressed: _busy ? null : () => unawaited(_decide(approve: true)),
          ),
          const SizedBox(height: TamamSpacing.s2),
          TamamButton(
            label: _rejecting ? l10n.quoteConfirmReject : l10n.quoteReject,
            variant: TamamButtonVariant.danger,
            busy: _busy && _rejecting,
            onPressed: _busy
                ? null
                : () {
                    if (!_rejecting) {
                      setState(() => _rejecting = true);
                      return;
                    }
                    unawaited(_decide(approve: false));
                  },
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (quote.description != null && quote.description!.isNotEmpty) ...<Widget>[
            Text(
              quote.description!,
              style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
            ),
            const SizedBox(height: TamamSpacing.s4),
          ],
          for (final QuoteItem item in quote.items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: TamamSpacing.s2),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          item.description,
                          style: TamamType.bodyLg.toTextStyle(color: colors.textPrimary),
                        ),
                        Text(
                          l10n.quoteItemMeta(_kindLabel(l10n, item.kind), item.quantity.toString()),
                          style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                        ),
                      ],
                    ),
                  ),
                  MoneyText(item.total, emphasis: MoneyEmphasis.subtle),
                ],
              ),
            ),
          Divider(color: colors.border, height: TamamSpacing.s6),
          _TotalRow(label: l10n.quoteLabor, amount: quote.laborCost),
          _TotalRow(label: l10n.quoteParts, amount: quote.partsCost),
          if (quote.additionalFees.amount != 0)
            _TotalRow(label: l10n.quoteFees, amount: quote.additionalFees),
          if (quote.discount.amount != 0)
            _TotalRow(label: l10n.quoteDiscount, amount: quote.discount, credit: true),
          if (quote.tax.amount != 0) _TotalRow(label: l10n.quoteTax, amount: quote.tax),
          Divider(color: colors.border, height: TamamSpacing.s6),
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  l10n.checkoutTotal,
                  style: TamamType.headingMd.toTextStyle(color: colors.textPrimary),
                ),
              ),
              MoneyText(quote.total),
            ],
          ),
          if (quote.estimatedDurationMin != null) ...<Widget>[
            const SizedBox(height: TamamSpacing.s2),
            Text(
              l10n.quoteDuration(quote.estimatedDurationMin!),
              style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }

  String _kindLabel(AppLocalizations l10n, String kind) {
    switch (kind) {
      case 'PARTS':
        return l10n.quoteParts;
      case 'FEE':
        return l10n.quoteFees;
      default:
        return l10n.quoteLabor;
    }
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({required this.label, required this.amount, this.credit = false});

  final String label;
  final Money amount;
  final bool credit;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Text(
                label,
                style: TamamType.bodyMd.toTextStyle(color: context.colors.textSecondary),
              ),
            ),
            MoneyText(
              amount,
              emphasis: MoneyEmphasis.subtle,
              color: credit ? context.colors.success : null,
            ),
          ],
        ),
      );
}
