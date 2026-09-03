import 'package:flutter/material.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';

/// The bold title that opens every home/section block, with an optional
/// trailing action ("عرض الكل").
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    required this.title,
    super.key,
    this.actionLabel,
    this.onAction,
    this.padding = const EdgeInsets.fromLTRB(TamamSpacing.s4, TamamSpacing.s5, TamamSpacing.s4, TamamSpacing.s3),
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Padding(
      padding: padding,
      child: Row(
        children: <Widget>[
          Expanded(
            child: Semantics(
              header: true,
              child: Text(
                title,
                style: TamamType.headingMd.toTextStyle(color: colors.textPrimary),
              ),
            ),
          ),
          if (actionLabel != null && onAction != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(
                minimumSize: const Size(0, TamamSize.touchTargetMin),
                padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s2),
              ),
              child: Text(actionLabel!, style: TamamType.labelMd.toTextStyle(color: colors.primary)),
            ),
        ],
      ),
    );
  }
}

/// Horizontal list with the standard gutters and a fixed height.
class HorizontalCarousel extends StatelessWidget {
  const HorizontalCarousel({
    required this.height,
    required this.itemCount,
    required this.itemBuilder,
    super.key,
    this.separator = TamamSpacing.s3,
    this.padding = const EdgeInsets.symmetric(horizontal: TamamSpacing.s4),
  });

  final double height;
  final int itemCount;
  final Widget Function(BuildContext context, int index) itemBuilder;
  final double separator;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: height,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: padding,
          itemCount: itemCount,
          separatorBuilder: (BuildContext _, int __) => SizedBox(width: separator),
          itemBuilder: itemBuilder,
        ),
      );
}
