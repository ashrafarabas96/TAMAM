import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';

/// A drop-in for [InkWell] whose surface dips and answers with a haptic.
///
/// Cards get this through TamamCard. Everything else that is tappable — chips,
/// pills, icon buttons, the address row — used a bare InkWell, whose only
/// acknowledgement is a ripple that reads as a stain on a small target. This
/// keeps the ripple and the exact constructor shape, and drives a small scale
/// from the ink highlight itself, so there is no second gesture recogniser to
/// fight the first.
class TamamInkWell extends StatefulWidget {
  const TamamInkWell({
    required this.child,
    super.key,
    this.onTap,
    this.onLongPress,
    this.borderRadius,
    this.customBorder,
    this.pressedScale = 0.97,
    this.haptics = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final BorderRadius? borderRadius;
  final ShapeBorder? customBorder;
  final double pressedScale;
  final bool haptics;

  @override
  State<TamamInkWell> createState() => _TamamInkWellState();
}

class _TamamInkWellState extends State<TamamInkWell> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final bool enabled = widget.onTap != null || widget.onLongPress != null;
    return AnimatedScale(
      scale: _pressed ? widget.pressedScale : 1,
      duration: _pressed ? TamamMotion.durationFast : TamamMotion.durationBase,
      curve: _pressed ? Curves.easeOut : Curves.easeOutBack,
      child: InkWell(
        onTap: widget.onTap,
        onLongPress: widget.onLongPress,
        borderRadius: widget.borderRadius,
        customBorder: widget.customBorder,
        onHighlightChanged: enabled ? (bool v) => setState(() => _pressed = v) : null,
        // On contact, not on release.
        onTapDown: enabled && widget.haptics ? (_) => unawaited(HapticFeedback.lightImpact()) : null,
        child: widget.child,
      ),
    );
  }
}
