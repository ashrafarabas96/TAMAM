import 'package:flutter/material.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';

/// A service icon with weight to it.
///
/// A flat glyph on a flat square is the difference between an app that looks
/// assembled and one that looks designed. Depth here is built from four cheap
/// layers rather than a bitmap, so it stays crisp at any size and recolours with
/// the theme:
///
///   1. a diagonal gradient on the tile, light source top-start;
///   2. a soft inner highlight along that top edge, which is what reads as a
///      raised surface rather than a printed one;
///   3. a coloured drop shadow tinted by the tile itself, not a grey one — grey
///      shadows under a coloured object are the classic tell of a flat design
///      wearing depth as a costume;
///   4. a hairline rim that keeps the shape defined against both canvases.
///
/// In dark mode the light source stays put but the shadow deepens and the
/// highlight weakens, because a lit object on a dark ground shows more shadow
/// and less bloom.
class TamamIconTile extends StatelessWidget {
  const TamamIconTile({
    required this.icon,
    required this.color,
    super.key,
    this.size = 56,
    this.iconSize,
    this.pressed = false,
  });

  final IconData icon;

  /// The service colour this tile represents; every other layer derives from it.
  final Color color;
  final double size;
  final double? iconSize;

  /// Lets a parent press animation flatten the tile, so the depth reacts too.
  final bool pressed;

  @override
  Widget build(BuildContext context) {
    final bool isDark = Theme.of(context).brightness == Brightness.dark;
    final TamamColors colors = context.colors;

    // The face runs from a lifted tint at the top-start to the colour itself at
    // the bottom-end. Keeping the darker stop at full saturation stops the tile
    // from washing out the brand hue.
    final Color faceTop = Color.alphaBlend(
      Colors.white.withValues(alpha: isDark ? 0.18 : 0.28),
      color,
    );
    final Color faceBottom = Color.alphaBlend(
      Colors.black.withValues(alpha: isDark ? 0.10 : 0.04),
      color,
    );

    final double lift = pressed ? 0.35 : 1;

    return AnimatedContainer(
      duration: TamamMotion.durationFast,
      curve: Curves.easeOut,
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.32),
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: <Color>[faceTop, faceBottom],
        ),
        border: Border.all(
          color: Color.alphaBlend(
            Colors.white.withValues(alpha: isDark ? 0.14 : 0.35),
            color,
          ),
          width: 0.8,
        ),
        boxShadow: <BoxShadow>[
          // Tinted by the tile, so the object and its shadow belong together.
          BoxShadow(
            color: color.withValues(alpha: (isDark ? 0.45 : 0.28) * lift),
            blurRadius: (isDark ? 18 : 14) * lift,
            offset: Offset(0, (isDark ? 8 : 6) * lift),
            spreadRadius: -2,
          ),
          // A second, tighter shadow gives the edge its bite.
          BoxShadow(
            color: colors.textPrimary.withValues(alpha: (isDark ? 0.30 : 0.08) * lift),
            blurRadius: 4 * lift,
            offset: Offset(0, 1.5 * lift),
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: <Widget>[
          // The inner highlight: a short gradient hugging the top edge only.
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(size * 0.32),
                gradient: LinearGradient(
                  begin: AlignmentDirectional.topStart,
                  end: AlignmentDirectional.center,
                  colors: <Color>[
                    Colors.white.withValues(alpha: isDark ? 0.16 : 0.34),
                    Colors.white.withValues(alpha: 0),
                  ],
                ),
              ),
            ),
          ),
          Icon(
            icon,
            size: iconSize ?? size * 0.46,
            // White glyph on a saturated face reads at every service colour;
            // the drop shadow lifts it off the gradient instead of letting it
            // sit flat on the tile.
            color: Colors.white,
            shadows: <Shadow>[
              Shadow(
                color: Color.alphaBlend(Colors.black.withValues(alpha: 0.35), color),
                blurRadius: 6,
                offset: const Offset(0, 1.5),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
