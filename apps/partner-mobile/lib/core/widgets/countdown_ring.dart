import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';

/// A circular countdown drawn around the seconds remaining.
///
/// Used by the incoming-offer sheet, where the partner has a handful of seconds
/// to decide: the ring drains clockwise (anticlockwise in RTL) and turns from
/// yellow to red as the deadline approaches, so urgency reads without counting.
class CountdownRing extends StatelessWidget {
  const CountdownRing({
    required this.remaining,
    required this.total,
    super.key,
    this.size = 88,
    this.strokeWidth = 7,
    this.label,
  });

  final Duration remaining;

  /// The full window the ring represents; a zero or negative value renders empty.
  final Duration total;
  final double size;
  final double strokeWidth;

  /// Overrides the default "seconds left" text (used for the accessibility label).
  final String? label;

  double get _progress {
    if (total.inMilliseconds <= 0) return 0;
    return (remaining.inMilliseconds / total.inMilliseconds).clamp(0.0, 1.0);
  }

  int get seconds => remaining.isNegative ? 0 : remaining.inSeconds;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final bool urgent = seconds <= 5;
    final Color arc = urgent ? colors.danger : colors.accent;

    return Semantics(
      liveRegion: true,
      label: label ?? '$seconds',
      child: SizedBox(
        width: size,
        height: size,
        child: CustomPaint(
          painter: _RingPainter(
            progress: _progress,
            arcColor: arc,
            trackColor: colors.textOnBrand.withOpacity(0.22),
            strokeWidth: strokeWidth,
            clockwise: Directionality.of(context) == TextDirection.ltr,
          ),
          child: Center(
            child: ExcludeSemantics(
              child: Text(
                '$seconds',
                style: TamamType.displaySm.toTextStyle(color: colors.textOnBrand),
                textDirection: TextDirection.ltr,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  const _RingPainter({
    required this.progress,
    required this.arcColor,
    required this.trackColor,
    required this.strokeWidth,
    required this.clockwise,
  });

  final double progress;
  final Color arcColor;
  final Color trackColor;
  final double strokeWidth;
  final bool clockwise;

  @override
  void paint(Canvas canvas, Size size) {
    final Rect rect = Offset.zero & size;
    final Rect inset = rect.deflate(strokeWidth / 2);
    final Paint track = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;
    final Paint arc = Paint()
      ..color = arcColor
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = strokeWidth;

    canvas.drawArc(inset, 0, 2 * math.pi, false, track);
    final double sweep = 2 * math.pi * progress * (clockwise ? 1 : -1);
    canvas.drawArc(inset, -math.pi / 2, sweep, false, arc);
  }

  @override
  bool shouldRepaint(covariant _RingPainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.arcColor != arcColor ||
      oldDelegate.trackColor != trackColor ||
      oldDelegate.clockwise != clockwise;
}
