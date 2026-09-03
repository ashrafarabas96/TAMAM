import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/models/money.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/money_text.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/quotes/domain/quote.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Labels for quote enums, shared by the builder, the card and the list.
abstract final class QuoteLabels {
  static String status(AppLocalizations l10n, QuoteStatus status) {
    switch (status) {
      case QuoteStatus.draft:
        return l10n.quoteStatusDraft;
      case QuoteStatus.submitted:
        return l10n.quoteStatusSubmitted;
      case QuoteStatus.approved:
        return l10n.quoteStatusApproved;
      case QuoteStatus.rejected:
        return l10n.quoteStatusRejected;
      case QuoteStatus.superseded:
        return l10n.quoteStatusSuperseded;
      case QuoteStatus.cancelled:
        return l10n.quoteStatusCancelled;
    }
  }

  static PillTone tone(QuoteStatus status) {
    switch (status) {
      case QuoteStatus.approved:
        return PillTone.success;
      case QuoteStatus.rejected:
      case QuoteStatus.cancelled:
        return PillTone.danger;
      case QuoteStatus.submitted:
        return PillTone.warning;
      case QuoteStatus.draft:
      case QuoteStatus.superseded:
        return PillTone.neutral;
    }
  }

  static String kind(AppLocalizations l10n, QuoteItemKind kind) {
    switch (kind) {
      case QuoteItemKind.labor:
        return l10n.quoteKindLabor;
      case QuoteItemKind.parts:
        return l10n.quoteKindParts;
      case QuoteItemKind.fee:
        return l10n.quoteKindFee;
    }
  }
}

/// A submitted quote or change order, with its server-computed totals.
class QuoteSummaryCard extends ConsumerWidget {
  const QuoteSummaryCard({required this.quote, super.key, this.expanded = false, this.onTap});

  final Quote quote;
  final bool expanded;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);

    return TamamCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  quote.isChangeOrder ? l10n.quoteChangeOrderTitle(quote.revision) : l10n.quoteTitle(quote.revision),
                  style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                ),
              ),
              StatusPill(label: QuoteLabels.status(l10n, quote.status), tone: QuoteLabels.tone(quote.status)),
            ],
          ),
          if (quote.submittedAt != null)
            Text(
              units.dateTime(quote.submittedAt!),
              style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
            ),
          const SizedBox(height: TamamSpacing.s3),
          if (expanded) ...<Widget>[
            for (final QuoteItem item in quote.items)
              Padding(
                padding: const EdgeInsets.only(bottom: TamamSpacing.s2),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(item.description, style: TamamType.bodyMd.toTextStyle(color: colors.textPrimary)),
                          Text(
                            '${QuoteLabels.kind(l10n, item.kind)} · ${units.number(item.quantity)} × ${ref.watch(moneyFormatterProvider).formatCompact(item.unitPrice)}',
                            textDirection: TextDirection.ltr,
                            style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                          ),
                        ],
                      ),
                    ),
                    MoneyText(item.total, emphasis: MoneyEmphasis.subtle),
                  ],
                ),
              ),
            Divider(color: colors.border),
            _TotalRow(label: l10n.quoteKindLabor, money: quote.laborCost),
            _TotalRow(label: l10n.quoteKindParts, money: quote.partsCost),
            _TotalRow(label: l10n.quoteKindFee, money: quote.additionalFees),
            if (!quote.discount.isZero)
              _TotalRow(label: l10n.quoteDiscount, money: Money(amount: -quote.discount.amount, currency: quote.discount.currency), signed: true),
            if (!quote.tax.isZero) _TotalRow(label: l10n.quoteTax, money: quote.tax),
            Divider(color: colors.border),
          ],
          Row(
            children: <Widget>[
              Expanded(
                child: Text(l10n.quoteTotal, style: TamamType.labelLg.toTextStyle(color: colors.textSecondary)),
              ),
              MoneyText(quote.total),
            ],
          ),
          if (quote.estimatedDurationMin != null)
            Padding(
              padding: const EdgeInsets.only(top: TamamSpacing.s2),
              child: Text(
                l10n.quoteEstimatedDuration(units.number(quote.estimatedDurationMin!)),
                style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
              ),
            ),
          if (quote.isRejected && quote.decisionNote != null && quote.decisionNote!.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: TamamSpacing.s3),
              padding: const EdgeInsets.all(TamamSpacing.s3),
              decoration: BoxDecoration(
                color: colors.dangerSoft,
                borderRadius: BorderRadius.circular(TamamRadius.md),
              ),
              child: Text(
                l10n.quoteRejectionNote(quote.decisionNote!),
                style: TamamType.bodySm.toTextStyle(color: TamamSemantic.dangerStrong),
              ),
            ),
        ],
      ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({required this.label, required this.money, this.signed = false});

  final String label;
  final Money money;
  final bool signed;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: <Widget>[
            Expanded(child: Text(label, style: TamamType.bodyMd.toTextStyle(color: context.colors.textSecondary))),
            MoneyText(money, emphasis: MoneyEmphasis.subtle, signed: signed),
          ],
        ),
      );
}
