import 'package:flutter/material.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';

/// Read-only star rating with the numeric value beside it.
class RatingBadge extends StatelessWidget {
  const RatingBadge({required this.rating, super.key, this.count, this.compact = true});

  final double rating;
  final int? count;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final String value = rating.toStringAsFixed(1);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Icon(Icons.star_rounded, size: TamamSize.iconSm, color: TamamBrand.yellow600),
        const SizedBox(width: 2),
        Text(
          count == null || compact ? value : '$value (${count!})',
          style: TamamType.labelMd.toTextStyle(color: colors.textSecondary),
        ),
      ],
    );
  }
}

/// The 1–5 star input on the rating screen.
class RatingInput extends StatelessWidget {
  const RatingInput({required this.value, required this.onChanged, super.key, this.size = 44});

  final int value;
  final ValueChanged<int> onChanged;
  final double size;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List<Widget>.generate(5, (int index) {
        final int star = index + 1;
        final bool filled = star <= value;
        return Semantics(
          button: true,
          selected: filled,
          value: '$star',
          child: IconButton(
            onPressed: () => onChanged(star),
            iconSize: size,
            padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s1),
            constraints: const BoxConstraints(
              minWidth: TamamSize.touchTargetMin,
              minHeight: TamamSize.touchTargetMin,
            ),
            icon: Icon(
              filled ? Icons.star_rounded : Icons.star_border_rounded,
              color: filled ? TamamBrand.yellow500 : colors.borderStrong,
            ),
          ),
        );
      }),
    );
  }
}
