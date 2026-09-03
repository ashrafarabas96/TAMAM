import 'package:flutter/material.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';

/// A shimmering placeholder block used by every loading state.
///
/// Implemented with a single [AnimationController] and a gradient sweep so it
/// costs one repaint per frame and needs no extra package.
class SkeletonBox extends StatefulWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height = 16,
    this.radius = TamamRadius.sm,
    this.margin,
  });

  final double? width;
  final double height;
  final double radius;
  final EdgeInsetsGeometry? margin;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final bool rtl = context.isRtl;
    // Placeholders carry no meaning; screen readers should skip them entirely.
    return ExcludeSemantics(
      child: Container(
        width: widget.width,
        height: widget.height,
        margin: widget.margin,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: colors.skeleton,
          borderRadius: BorderRadius.circular(widget.radius),
        ),
        child: AnimatedBuilder(
          animation: _controller,
          builder: (BuildContext context, Widget? child) {
            final double t = _controller.value * 2 - 1;
            final double shift = rtl ? -t : t;
            return DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment(shift - 0.6, 0),
                  end: Alignment(shift + 0.6, 0),
                  colors: <Color>[
                    colors.skeleton,
                    colors.surface.withOpacity(0.55),
                    colors.skeleton,
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

/// A vertical stack of skeleton lines — the default "list is loading" look.
class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.itemCount = 4, this.itemHeight = 88});

  final int itemCount;
  final double itemHeight;

  @override
  Widget build(BuildContext context) => Column(
        children: List<Widget>.generate(
          itemCount,
          (int index) => SkeletonBox(
            height: itemHeight,
            radius: TamamRadius.card,
            margin: const EdgeInsets.only(bottom: TamamSpacing.s3),
          ),
        ),
      );
}
