import 'package:flutter/material.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';

/// A "go forward" chevron that points the right way in both directions.
///
/// Material's chevron icons do not auto-mirror, and in an Arabic-first app a
/// chevron pointing the wrong way reads as "go back".
class DirectionalChevron extends StatelessWidget {
  const DirectionalChevron({super.key, this.color, this.size = TamamSize.iconMd});

  final Color? color;
  final double size;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
        child: Icon(
          context.isRtl ? Icons.chevron_left_rounded : Icons.chevron_right_rounded,
          size: size,
          color: color ?? context.colors.textTertiary,
        ),
      );
}
