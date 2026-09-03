import 'package:flutter/material.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';

/// One number in the home stats row: rating, acceptance rate, completed jobs.
class StatTile extends StatelessWidget {
  const StatTile({
    required this.value,
    required this.label,
    required this.icon,
    super.key,
    this.tone,
    this.onTap,
  });

  final String value;
  final String label;
  final IconData icon;

  /// Overrides the icon colour, e.g. to warn about a low acceptance rate.
  final Color? tone;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Semantics(
      button: onTap != null,
      label: '$label: $value',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(TamamRadius.md),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: TamamSpacing.s2),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(icon, size: TamamSize.iconMd, color: tone ?? colors.primary),
              const SizedBox(height: TamamSpacing.s1),
              ExcludeSemantics(
                child: Text(
                  value,
                  style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                  textDirection: TextDirection.ltr,
                ),
              ),
              ExcludeSemantics(
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  style: TamamType.labelSm.toTextStyle(color: colors.textTertiary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
