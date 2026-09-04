import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/features/chalet/domain/chalet_booking.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// The whole arithmetic behind a price, not just the total.
///
/// Every adjustment the server applied is listed in the customer's own
/// language, including the note that the owner's minimum rate is what set the
/// price. A number nobody can explain is a number nobody trusts, and the owner
/// should be able to see that their own floor — not the platform — held the
/// line.
class ChaletPriceSheet extends ConsumerWidget {
  const ChaletPriceSheet({required this.price, super.key});

  final ChaletPrice price;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final TamamColors colors = context.colors;
    final AppLocalizations l10n = context.l10n;
    final TextTheme text = Theme.of(context).textTheme;
    final bool isArabic = Localizations.localeOf(context).languageCode == 'ar';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        _Row(
          label: l10n.chaletPriceHourly,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              if (price.isDiscounted) ...<Widget>[
                MoneyText(
                  price.baseHourlyRate,
                  emphasis: MoneyEmphasis.subtle,
                  style: text.bodySmall?.copyWith(
                    decoration: TextDecoration.lineThrough,
                    color: colors.textTertiary,
                  ),
                ),
                const SizedBox(width: TamamSpacing.s2),
              ],
              MoneyText(price.effectiveHourlyRate),
            ],
          ),
        ),
        for (final ChaletPriceLine line in price.lines)
          _Row(
            label: isArabic ? line.labelAr : line.label,
            child: MoneyText(
              line.amount,
              signed: true,
              emphasis: MoneyEmphasis.subtle,
              color: line.isDiscount ? colors.success : colors.textSecondary,
            ),
          ),
        const Divider(height: TamamSpacing.s6),
        _Row(label: l10n.chaletPriceSubtotal, child: MoneyText(price.subtotal)),
        if (!price.deposit.isZero)
          _Row(label: l10n.chaletPriceDeposit, child: MoneyText(price.deposit)),
        _Row(
          label: l10n.chaletPriceTotal,
          emphasised: true,
          child: MoneyText(price.total, style: text.titleMedium),
        ),
        if (price.clampedToMinimum) ...<Widget>[
          const SizedBox(height: TamamSpacing.s3),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(Icons.info_outline_rounded, size: 16, color: colors.textTertiary),
              const SizedBox(width: TamamSpacing.s2),
              Expanded(
                child: Text(
                  l10n.chaletPriceFloorNote,
                  style: text.bodySmall?.copyWith(color: colors.textTertiary),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.child, this.emphasised = false});

  final String label;
  final Widget child;
  final bool emphasised;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: TamamSpacing.s1),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              label,
              style: emphasised
                  ? text.titleSmall?.copyWith(color: context.colors.textPrimary)
                  : text.bodyMedium?.copyWith(color: context.colors.textSecondary),
            ),
          ),
          child,
        ],
      ),
    );
  }
}
