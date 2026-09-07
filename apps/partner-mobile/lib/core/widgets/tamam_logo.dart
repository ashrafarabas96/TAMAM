import 'package:flutter/material.dart';

/// The brand lockup — the T mark with TAMAM / تمام set beside it.
///
/// Two files, not one recoloured at runtime: the wordmark is deep purple, which
/// disappears on the dark canvas, so the dark variant lifts the wordmark to near
/// white while leaving the mark's purple and every yellow exactly as authored.
/// Tinting the whole asset would flatten the modelling that makes it read as the
/// brand rather than as a silhouette of it.
class TamamLogo extends StatelessWidget {
  const TamamLogo({
    super.key,
    this.height = 44,
    this.markOnly = false,
    this.onBrand = false,
  });

  final double height;

  /// Sitting on the brand purple itself, where the purple mark would vanish.
  /// This is the reversed lockup: mark and wordmark in white, speed marks and
  /// the dot still yellow.
  final bool onBrand;

  /// The square mark alone, for places too tight for the wordmark.
  final bool markOnly;

  @override
  Widget build(BuildContext context) {
    final bool isDark = Theme.of(context).brightness == Brightness.dark;
    final String asset = markOnly
        ? 'assets/brand/logo/mark.png'
        : onBrand
            ? 'assets/brand/logo/lockup-onbrand.png'
            : isDark
                ? 'assets/brand/logo/lockup-dark.png'
                : 'assets/brand/logo/lockup.png';
    return Semantics(
      label: 'تمام',
      image: true,
      child: Image.asset(
        asset,
        height: height,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.medium,
      ),
    );
  }
}
