import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';

/// Makes a tap feel like a tap.
///
/// Anything a customer can press wraps in this: the surface dips slightly under
/// the finger, settles back on an emphasized curve, and fires a light haptic on
/// press-down rather than on release, so the phone answers at the moment of
/// contact instead of after it. A card that swallows a tap with no
/// acknowledgement is the clearest tell of an unfinished app.
///
/// The scale is deliberately small. Anything past a few percent reads as a toy;
/// the point is to be felt more than seen.
class TamamPressable extends StatefulWidget {
  const TamamPressable({
    required this.child,
    super.key,
    this.onTap,
    this.onLongPress,
    this.pressedScale = 0.97,
    this.haptics = true,
    this.borderRadius,
    this.semanticLabel,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  /// How far the surface dips. Large targets want less; small chips can take more.
  final double pressedScale;
  final bool haptics;
  final BorderRadius? borderRadius;
  final String? semanticLabel;

  @override
  State<TamamPressable> createState() => _TamamPressableState();
}

class _TamamPressableState extends State<TamamPressable> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: TamamMotion.durationFast,
    reverseDuration: TamamMotion.durationBase,
    lowerBound: 0,
    upperBound: 1,
  );

  late final Animation<double> _scale = Tween<double>(
    begin: 1,
    end: widget.pressedScale,
  ).animate(CurvedAnimation(
    parent: _controller,
    curve: Curves.easeOut,
    // Settling is the part the eye reads, so it gets the emphasized curve.
    reverseCurve: Curves.easeOutBack,
  ));

  bool get _enabled => widget.onTap != null || widget.onLongPress != null;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _down(TapDownDetails _) {
    if (!_enabled) return;
    _controller.forward();
    // On press, not on release: the answer should arrive with the contact.
    if (widget.haptics) unawaited(HapticFeedback.lightImpact());
  }

  void _up([TapUpDetails? _]) => _controller.reverse();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: _enabled,
      label: widget.semanticLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: _down,
        onTapUp: _up,
        onTapCancel: _up,
        onTap: widget.onTap,
        onLongPress: widget.onLongPress == null
            ? null
            : () {
                if (widget.haptics) unawaited(HapticFeedback.mediumImpact());
                widget.onLongPress!.call();
              },
        child: AnimatedBuilder(
          animation: _scale,
          builder: (BuildContext _, Widget? child) =>
              Transform.scale(scale: _scale.value, child: child),
          child: widget.child,
        ),
      ),
    );
  }
}
