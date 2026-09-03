import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/format/unit_formatter.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/features/jobs/domain/fare.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// A selectable vehicle / service option inside an estimate.
///
/// The price shown is exactly what the server returned; the card never adds,
/// rounds or recomputes anything.
class FareOptionCard extends ConsumerWidget {
  const FareOptionCard({
    required this.option,
    required this.selected,
    required this.onTap,
    super.key,
  });

  final FareOption option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    final String language = ref.watch(localeControllerProvider).languageCode;
    final int? eta = option.etaToPickupSeconds;

    return Semantics(
      button: true,
      selected: selected,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(TamamRadius.card),
        child: AnimatedContainer(
          duration: TamamMotion.durationFast,
          padding: const EdgeInsets.all(TamamSpacing.s3),
          decoration: BoxDecoration(
            color: selected ? colors.surfaceBrandSoft : colors.surface,
            borderRadius: BorderRadius.circular(TamamRadius.card),
            border: Border.all(
              color: selected ? colors.primary : colors.border,
              width: selected ? 1.6 : 1,
            ),
          ),
          child: Row(
            children: <Widget>[
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: colors.surfaceAlt,
                  borderRadius: BorderRadius.circular(TamamRadius.sm),
                ),
                child: Icon(
                  option.seats != null ? Icons.directions_car_rounded : Icons.handyman_rounded,
                  color: colors.primary,
                ),
              ),
              const SizedBox(width: TamamSpacing.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Flexible(
                          child: Text(
                            option.name.resolve(language),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                          ),
                        ),
                        if (option.hasSurge) ...<Widget>[
                          const SizedBox(width: TamamSpacing.s2),
                          Icon(Icons.trending_up_rounded, size: TamamSize.iconSm, color: colors.warning),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      <String>[
                        if (option.seats != null) l10n.fareSeats(option.seats!),
                        if (eta != null && eta > 0) l10n.fareEtaMinutes(units.minutesValue(eta)),
                      ].join(' · '),
                      style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                    ),
                  ],
                ),
              ),
              MoneyText(option.total, emphasis: MoneyEmphasis.medium),
            ],
          ),
        ),
      ),
    );
  }
}

/// The server-provided price breakdown, rendered verbatim.
class FareBreakdownList extends StatelessWidget {
  const FareBreakdownList({required this.lines, super.key, this.total});

  final List<FareBreakdownLine> lines;
  final Widget? total;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final String language = Localizations.localeOf(context).languageCode;
    if (lines.isEmpty && total == null) return const SizedBox.shrink();

    return Column(
      children: <Widget>[
        for (final FareBreakdownLine line in lines)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    line.label.resolve(language),
                    style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                  ),
                ),
                MoneyText(
                  line.amount,
                  emphasis: MoneyEmphasis.subtle,
                  color: line.isCredit ? colors.success : colors.textPrimary,
                ),
              ],
            ),
          ),
        if (total != null) ...<Widget>[
          Padding(
            padding: const EdgeInsets.symmetric(vertical: TamamSpacing.s2),
            child: Divider(height: 1, color: colors.border),
          ),
          total!,
        ],
      ],
    );
  }
}
