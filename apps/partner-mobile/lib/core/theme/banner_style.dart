import 'package:flutter/material.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
// The token file no longer declares its own `BannerPlacement` — it imports the contract
// enum, which is the one the API speaks. The prefix stays only to mark the spec lookups.
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart' as tokens;

/// Layout + autoplay rules for one placement, read from the design tokens.
class BannerStyle {
  const BannerStyle({
    required this.aspectRatio,
    required this.maxItems,
    required this.autoplay,
    required this.style,
  });

  final double aspectRatio;
  final int maxItems;
  final Duration autoplay;

  /// `carousel`, `stack` or `single`.
  final String style;

  bool get isCarousel => style == 'carousel';
  bool get autoplays => autoplay.inMilliseconds > 0;

  /// Falls back to the hero spec when a new placement is added server-side
  /// before the app ships support for it.
  static BannerStyle forPlacement(BannerPlacement placement) {
    final BannerPlacement? key = tokens.TamamBannerSpecs.fromApi(placement.value);
    final tokens.BannerPlacementSpec spec = tokens.TamamBannerSpecs.byPlacement[key] ??
        tokens.TamamBannerSpecs.byPlacement[BannerPlacement.homeHero]!;
    return BannerStyle(
      aspectRatio: spec.aspectRatio,
      maxItems: spec.maxItems,
      autoplay: spec.autoplay,
      style: spec.style,
    );
  }
}

/// Colours for one creative theme key (`purple`, `gradientSunset`, …).
class BannerPalette {
  const BannerPalette({
    required this.background,
    required this.foreground,
    required this.accent,
    this.gradient,
  });

  final Color background;
  final Color foreground;
  final Color accent;
  final List<Color>? gradient;

  /// The fill painted behind the creative (and shown when the image fails).
  Decoration decoration(BorderRadius radius) => BoxDecoration(
        color: gradient == null ? background : null,
        gradient: gradient == null
            ? null
            : LinearGradient(
                colors: gradient!,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
        borderRadius: radius,
      );

  static BannerPalette forTheme(String? themeKey) {
    final tokens.BannerThemeSpec spec =
        tokens.TamamBannerThemes.byName[themeKey] ?? tokens.TamamBannerThemes.byName['purple']!;
    return BannerPalette(
      background: spec.background,
      foreground: spec.foreground,
      accent: spec.accent,
      gradient: spec.gradient,
    );
  }
}
