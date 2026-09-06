import 'package:flutter/material.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/tamam_pressable.dart';

/// The white, 16-radius, softly shadowed surface every block of content sits on.
class TamamCard extends StatelessWidget {
  const TamamCard({
    required this.child,
    super.key,
    this.padding = const EdgeInsets.all(TamamSpacing.s4),
    this.margin,
    this.onTap,
    this.radius = TamamRadius.card,
    this.background,
    this.border,
    this.elevated = true,
    this.semanticLabel,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final double radius;
  final Color? background;
  final BoxBorder? border;
  final bool elevated;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final BorderRadius borderRadius = BorderRadius.circular(radius);
    final Widget content = DecoratedBox(
      decoration: BoxDecoration(
        color: background ?? colors.surface,
        borderRadius: borderRadius,
        border: border,
        boxShadow: elevated ? TamamElevation.card : null,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: borderRadius,
        child: Padding(padding: padding, child: child),
      ),
    );
    // An ink ripple alone is a weak answer on a card this size: it reads as a
    // stain rather than as the card responding. Wrapping the whole surface means
    // the card itself dips under the finger and the phone answers on contact.
    final Widget responsive = onTap == null
        ? content
        : TamamPressable(onTap: onTap, borderRadius: borderRadius, child: content);
    final Widget wrapped =
        margin == null ? responsive : Padding(padding: margin!, child: responsive);
    if (semanticLabel == null && onTap == null) return wrapped;
    // The label is merged with whatever the card's own text already announces, so it must
    // supply only what that text does not — a label repeating the visible copy is read
    // twice. The button role follows onTap, independently of the label.
    return Semantics(label: semanticLabel, button: onTap != null, child: wrapped);
  }
}
