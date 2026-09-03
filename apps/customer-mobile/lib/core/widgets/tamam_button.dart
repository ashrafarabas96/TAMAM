import 'package:flutter/material.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';

/// Visual weight of an action.
enum TamamButtonVariant {
  /// Yellow surface, dark-purple label — one per screen.
  primary,

  /// Purple surface, white label.
  secondary,

  /// Purple outline on the canvas.
  outline,

  /// Text-only.
  ghost,

  /// Destructive confirmation (cancel a job, delete an account).
  danger,
}

/// The app's button. Handles the busy state itself so callers never juggle a
/// spinner and an enabled flag separately.
class TamamButton extends StatelessWidget {
  const TamamButton({
    required this.label,
    required this.onPressed,
    super.key,
    this.variant = TamamButtonVariant.primary,
    this.icon,
    this.busy = false,
    this.expanded = true,
    this.semanticLabel,
  });

  final String label;

  /// `null` disables the button; combined with [busy] for in-flight requests.
  final VoidCallback? onPressed;
  final TamamButtonVariant variant;
  final IconData? icon;
  final bool busy;
  final bool expanded;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final bool enabled = onPressed != null && !busy;
    final Widget child = busy
        ? SizedBox(
            height: 20,
            width: 20,
            child: CircularProgressIndicator(strokeWidth: 2.4, color: _foreground(colors)),
          )
        : Row(
            mainAxisSize: expanded ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              if (icon != null) ...<Widget>[
                Icon(icon, size: TamamSize.iconMd),
                const SizedBox(width: TamamSpacing.s2),
              ],
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          );

    final Widget button = switch (variant) {
      TamamButtonVariant.primary => ElevatedButton(onPressed: enabled ? onPressed : null, child: child),
      TamamButtonVariant.secondary => FilledButton(onPressed: enabled ? onPressed : null, child: child),
      TamamButtonVariant.outline => OutlinedButton(onPressed: enabled ? onPressed : null, child: child),
      TamamButtonVariant.ghost => TextButton(onPressed: enabled ? onPressed : null, child: child),
      TamamButtonVariant.danger => FilledButton(
          onPressed: enabled ? onPressed : null,
          style: FilledButton.styleFrom(
            backgroundColor: colors.dangerSoft,
            foregroundColor: TamamSemantic.dangerStrong,
            minimumSize: const Size.fromHeight(TamamSize.buttonHeightLg),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TamamRadius.button)),
          ),
          child: child,
        ),
    };

    return Semantics(
      button: true,
      enabled: enabled,
      label: semanticLabel ?? label,
      child: SizedBox(
        width: expanded ? double.infinity : null,
        height: TamamSize.buttonHeightLg,
        child: button,
      ),
    );
  }

  Color _foreground(TamamColors colors) => switch (variant) {
        TamamButtonVariant.primary => colors.textOnAccent,
        TamamButtonVariant.secondary => colors.textOnBrand,
        TamamButtonVariant.outline || TamamButtonVariant.ghost => colors.primary,
        TamamButtonVariant.danger => TamamSemantic.dangerStrong,
      };
}
