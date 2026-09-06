// AUTO-GENERATED from packages/ui-tokens/tokens.json — DO NOT EDIT BY HAND.
// Regenerate with: pnpm tokens:generate

// ignore_for_file: constant_identifier_names, public_member_api_docs
import 'package:flutter/material.dart';

import '../../contracts/generated/tamam_contracts.dart';

/// Brand palette: purple #5D3EBC and yellow #FFD300, the two identity constants.
abstract final class TamamBrand {
  static const Color purple50 = Color(0xFFF5F3FB);
  static const Color purple100 = Color(0xFFE8E4F6);
  static const Color purple200 = Color(0xFFCEC5EB);
  static const Color purple300 = Color(0xFFAE9EDE);
  static const Color purple400 = Color(0xFF8770CD);
  static const Color purple500 = Color(0xFF5D3EBC);
  static const Color purple600 = Color(0xFF5538AC);
  static const Color purple700 = Color(0xFF4B329A);
  static const Color purple800 = Color(0xFF3F2A83);
  static const Color purple900 = Color(0xFF32206A);
  static const Color yellow50 = Color(0xFFFFFBEB);
  static const Color yellow100 = Color(0xFFFFF7D1);
  static const Color yellow200 = Color(0xFFFFEFA3);
  static const Color yellow300 = Color(0xFFFFE56B);
  static const Color yellow400 = Color(0xFFFFDC33);
  static const Color yellow500 = Color(0xFFFFD300);
  static const Color yellow600 = Color(0xFFEFC100);
  static const Color yellow700 = Color(0xFFDCAC00);
  static const Color yellow800 = Color(0xFFC49100);
  static const Color yellow900 = Color(0xFFAD7700);
}

abstract final class TamamNeutral {
  static const Color n0 = Color(0xFFFFFFFF);
  static const Color n50 = Color(0xFFFAF9FE);
  static const Color n100 = Color(0xFFF4F2FB);
  static const Color n200 = Color(0xFFE5E0F1);
  static const Color n300 = Color(0xFFCFC8E2);
  static const Color n400 = Color(0xFFA9A0C4);
  static const Color n500 = Color(0xFF8B83A6);
  static const Color n600 = Color(0xFF6E6889);
  static const Color n700 = Color(0xFF565073);
  static const Color n800 = Color(0xFF3A3160);
  static const Color n900 = Color(0xFF1B1140);
  static const Color n1000 = Color(0xFF191922);
}

abstract final class TamamServiceColors {
  static const Color ride = Color(0xFF5D3EBC);
  static const Color delivery = Color(0xFF4B329A);
  static const Color homeService = Color(0xFFC49100);
  static const Color chalet = Color(0xFF8770CD);
  static const Color urgent = Color(0xFFB3123A);
}

/// Semantic colour scheme resolved per theme mode.
class TamamColorScheme {
  const TamamColorScheme({
    required this.background,
    required this.surface,
    required this.surfaceAlt,
    required this.surfaceBrand,
    required this.surfaceBrandSoft,
    required this.border,
    required this.borderStrong,
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.textOnBrand,
    required this.textOnAccent,
    required this.primary,
    required this.primaryHover,
    required this.primaryPressed,
    required this.accent,
    required this.accentHover,
    required this.accentPressed,
    required this.overlay,
    required this.skeleton,
    required this.success,
    required this.successSoft,
    required this.successStrong,
    required this.warning,
    required this.warningSoft,
    required this.warningStrong,
    required this.danger,
    required this.dangerSoft,
    required this.dangerStrong,
    required this.info,
    required this.infoSoft,
    required this.infoStrong,
    required this.mapRoute,
    required this.mapPickup,
    required this.mapDestination,
  });

  final Color background;
  final Color surface;
  final Color surfaceAlt;
  final Color surfaceBrand;
  final Color surfaceBrandSoft;
  final Color border;
  final Color borderStrong;
  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;
  final Color textOnBrand;
  final Color textOnAccent;
  final Color primary;
  final Color primaryHover;
  final Color primaryPressed;
  final Color accent;
  final Color accentHover;
  final Color accentPressed;
  final Color overlay;
  final Color skeleton;
  final Color success;
  final Color successSoft;
  final Color successStrong;
  final Color warning;
  final Color warningSoft;
  final Color warningStrong;
  final Color danger;
  final Color dangerSoft;
  final Color dangerStrong;
  final Color info;
  final Color infoSoft;
  final Color infoStrong;
  final Color mapRoute;
  final Color mapPickup;
  final Color mapDestination;

  static const TamamColorScheme light = TamamColorScheme(
    background: Color(0xFFF7F5FC),
    surface: Color(0xFFFFFFFF),
    surfaceAlt: Color(0xFFEFEAFB),
    surfaceBrand: Color(0xFF5D3EBC),
    surfaceBrandSoft: Color(0xFFEFE9FD),
    border: Color(0xFFE5E0F1),
    borderStrong: Color(0xFF8B83A6),
    textPrimary: Color(0xFF1B1140),
    textSecondary: Color(0xFF565073),
    textTertiary: Color(0xFF6E6889),
    textOnBrand: Color(0xFFFFFFFF),
    textOnAccent: Color(0xFF21154A),
    primary: Color(0xFF5D3EBC),
    primaryHover: Color(0xFF5338A5),
    primaryPressed: Color(0xFF49338E),
    accent: Color(0xFFFFD300),
    accentHover: Color(0xFFF0C600),
    accentPressed: Color(0xFFD9B300),
    overlay: Color(0xA621154A),
    skeleton: Color(0xFFEFEAF8),
    success: Color(0xFF0E7A45),
    successSoft: Color(0xFFE4F5EC),
    successStrong: Color(0xFF0A5C34),
    warning: Color(0xFF8A5200),
    warningSoft: Color(0xFFFDF1DC),
    warningStrong: Color(0xFF6B3F00),
    danger: Color(0xFFB3123A),
    dangerSoft: Color(0xFFFCE8ED),
    dangerStrong: Color(0xFF8C0E2D),
    info: Color(0xFF1D4FBF),
    infoSoft: Color(0xFFE6EDFC),
    infoStrong: Color(0xFF163C92),
    mapRoute: Color(0xFF5D3EBC),
    mapPickup: Color(0xFF0E7A45),
    mapDestination: Color(0xFFB3123A),
  );

  static const TamamColorScheme dark = TamamColorScheme(
    background: Color(0xFF121017),
    surface: Color(0xFF191922),
    surfaceAlt: Color(0xFF232331),
    surfaceBrand: Color(0xFF5D3EBC),
    surfaceBrandSoft: Color(0xFF2B2350),
    border: Color(0xFF2E2E3D),
    borderStrong: Color(0xFF6E6B82),
    textPrimary: Color(0xFFF6F4FD),
    textSecondary: Color(0xFFB5AECF),
    textTertiary: Color(0xFF948DAC),
    textOnBrand: Color(0xFFFFFFFF),
    textOnAccent: Color(0xFF21154A),
    primary: Color(0xFF7257C5),
    primaryHover: Color(0xFF7D64C9),
    primaryPressed: Color(0xFF6D51C3),
    accent: Color(0xFFFFD300),
    accentHover: Color(0xFFFFDE3D),
    accentPressed: Color(0xFFE8C000),
    overlay: Color(0xD90B0910),
    skeleton: Color(0xFF232331),
    success: Color(0xFF3DD68C),
    successSoft: Color(0xFF12301F),
    successStrong: Color(0xFF6FE7AC),
    warning: Color(0xFFFFC24D),
    warningSoft: Color(0xFF332405),
    warningStrong: Color(0xFFFFD680),
    danger: Color(0xFFFF7A94),
    dangerSoft: Color(0xFF37131C),
    dangerStrong: Color(0xFFFFA3B4),
    info: Color(0xFF7FA8FF),
    infoSoft: Color(0xFF141F38),
    infoStrong: Color(0xFFA8C4FF),
    mapRoute: Color(0xFF8770CD),
    mapPickup: Color(0xFF3DD68C),
    mapDestination: Color(0xFFFF7A94),
  );
}

abstract final class TamamSpacing {
  static const double s0 = 0.0;
  static const double s1 = 4.0;
  static const double s2 = 8.0;
  static const double s3 = 12.0;
  static const double s4 = 16.0;
  static const double s5 = 20.0;
  static const double s6 = 24.0;
  static const double s7 = 28.0;
  static const double s8 = 32.0;
  static const double s10 = 40.0;
  static const double s12 = 48.0;
  static const double s16 = 64.0;
}

abstract final class TamamRadius {
  static const double xs = 6.0;
  static const double sm = 10.0;
  static const double md = 12.0;
  static const double lg = 16.0;
  static const double xl = 20.0;
  static const double xxl = 28.0;
  static const double pill = 999.0;
  static const double card = 18.0;
  static const double button = 14.0;
  static const double sheet = 28.0;
  static const double banner = 20.0;
}

abstract final class TamamSize {
  static const double touchTargetMin = 48.0;
  static const double buttonHeightLg = 54.0;
  static const double buttonHeightMd = 46.0;
  static const double buttonHeightSm = 38.0;
  static const double inputHeight = 54.0;
  static const double appBarHeight = 56.0;
  static const double bottomNavHeight = 66.0;
  static const double iconSm = 16.0;
  static const double iconMd = 22.0;
  static const double iconLg = 28.0;
  static const double avatarSm = 32.0;
  static const double avatarMd = 44.0;
  static const double avatarLg = 64.0;
  static const double serviceCardHeight = 120.0;
  static const double bannerHeroHeight = 168.0;
  static const double bannerInlineHeight = 96.0;
  static const double bannerAspectHero = 2.25;
  static const double bannerAspectInline = 3.6;
}

/// Elevation tokens as ready-to-use shadow lists (soft, brand-tinted).
abstract final class TamamElevation {
  static const List<BoxShadow> card = <BoxShadow>[BoxShadow(color: Color(0x1221154A), offset: Offset(0.0, 2.0), blurRadius: 12.0, spreadRadius: 0.0)];
  static const List<BoxShadow> raised = <BoxShadow>[BoxShadow(color: Color(0x1F21154A), offset: Offset(0.0, 8.0), blurRadius: 24.0, spreadRadius: -2.0)];
  static const List<BoxShadow> sheet = <BoxShadow>[BoxShadow(color: Color(0x2E21154A), offset: Offset(0.0, -6.0), blurRadius: 32.0, spreadRadius: 0.0)];
  static const List<BoxShadow> floating = <BoxShadow>[BoxShadow(color: Color(0x3821154A), offset: Offset(0.0, 12.0), blurRadius: 36.0, spreadRadius: -4.0)];
}

abstract final class TamamMotion {
  static const Duration durationFast = Duration(milliseconds: 120);
  static const Duration durationBase = Duration(milliseconds: 220);
  static const Duration durationSlow = Duration(milliseconds: 340);
  static const Duration durationBannerAutoplay = Duration(milliseconds: 5000);
}

abstract final class TamamFonts {
  static const String arabic = 'Tajawal';
  static const String latin = 'Poppins';
  static const String mono = 'JetBrains Mono';
  /// Platform faces to fall back through when a glyph is missing.
  static const List<String> fallbackArabic = <String>['Noto Sans Arabic', 'Tahoma', 'sans-serif'];
  static const List<String> fallbackLatin = <String>['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'];
}

/// Which script the UI is currently set in. Arabic is cursive, so the two
/// typographic rules that differ from Latin are applied from here rather than
/// being repeated at every call site.
enum TamamScript { latin, arabic }

class TamamTypeStyle {
  const TamamTypeStyle(this.size, this.lineHeight, this.weight, this.letterSpacing);
  final double size;
  final double lineHeight;
  final FontWeight weight;
  final double letterSpacing;

  /// Set once from the active locale (see TamamTheme). The whole UI is in one
  /// script at a time, so this is app state, not per-widget state.
  static TamamScript script = TamamScript.latin;

  static bool get _isArabic => script == TamamScript.arabic;

  /// Letter-spacing pulls joined Arabic letterforms apart and must be 0.
  double get effectiveLetterSpacing => _isArabic ? 0 : letterSpacing;

  /// Arabic needs more leading than Latin at the same size.
  double get effectiveHeight =>
      (lineHeight * (_isArabic ? 1.15 : 1)) / size;

  TextStyle toTextStyle({Color? color, String? fontFamily}) => TextStyle(
        fontSize: size,
        height: effectiveHeight,
        fontWeight: weight,
        letterSpacing: effectiveLetterSpacing,
        color: color,
        fontFamily: fontFamily,
        leadingDistribution: TextLeadingDistribution.even,
      );
}

abstract final class TamamType {
  static const TamamTypeStyle displayLg = TamamTypeStyle(34.0, 42.0, FontWeight.w800, -0.5);
  static const TamamTypeStyle displaySm = TamamTypeStyle(28.0, 36.0, FontWeight.w800, -0.3);
  static const TamamTypeStyle headingLg = TamamTypeStyle(22.0, 30.0, FontWeight.w700, 0.0);
  static const TamamTypeStyle headingMd = TamamTypeStyle(18.0, 26.0, FontWeight.w700, 0.0);
  static const TamamTypeStyle headingSm = TamamTypeStyle(16.0, 24.0, FontWeight.w600, 0.0);
  static const TamamTypeStyle bodyLg = TamamTypeStyle(16.0, 24.0, FontWeight.w400, 0.0);
  static const TamamTypeStyle bodyMd = TamamTypeStyle(14.0, 22.0, FontWeight.w400, 0.0);
  static const TamamTypeStyle bodySm = TamamTypeStyle(12.0, 18.0, FontWeight.w400, 0.0);
  static const TamamTypeStyle labelLg = TamamTypeStyle(15.0, 20.0, FontWeight.w600, 0.1);
  static const TamamTypeStyle labelMd = TamamTypeStyle(13.0, 18.0, FontWeight.w600, 0.1);
  static const TamamTypeStyle labelSm = TamamTypeStyle(11.0, 16.0, FontWeight.w600, 0.2);
  static const TamamTypeStyle price = TamamTypeStyle(20.0, 28.0, FontWeight.w800, -0.2);
}

class BannerPlacementSpec {
  const BannerPlacementSpec({required this.aspectRatio, required this.maxItems, required this.autoplay, required this.style});
  final double aspectRatio;
  final int maxItems;
  final Duration autoplay;
  final String style;
}

abstract final class TamamBannerSpecs {
  static const Map<BannerPlacement, BannerPlacementSpec> byPlacement = {
    BannerPlacement.homeHero: BannerPlacementSpec(aspectRatio: 2.25, maxItems: 6, autoplay: Duration(milliseconds: 5000), style: 'carousel'),
    BannerPlacement.homeInline: BannerPlacementSpec(aspectRatio: 3.6, maxItems: 3, autoplay: Duration(milliseconds: 0), style: 'stack'),
    BannerPlacement.serviceCategoryTop: BannerPlacementSpec(aspectRatio: 3.0, maxItems: 3, autoplay: Duration(milliseconds: 5000), style: 'carousel'),
    BannerPlacement.checkoutPromo: BannerPlacementSpec(aspectRatio: 4.5, maxItems: 1, autoplay: Duration(milliseconds: 0), style: 'single'),
    BannerPlacement.orderTracking: BannerPlacementSpec(aspectRatio: 4.5, maxItems: 1, autoplay: Duration(milliseconds: 0), style: 'single'),
    BannerPlacement.partnerHome: BannerPlacementSpec(aspectRatio: 3.0, maxItems: 3, autoplay: Duration(milliseconds: 5000), style: 'carousel'),
  };
  static BannerPlacement? fromApi(String value) {
    switch (value) {
      case 'HOME_HERO': return BannerPlacement.homeHero;
      case 'HOME_INLINE': return BannerPlacement.homeInline;
      case 'SERVICE_CATEGORY_TOP': return BannerPlacement.serviceCategoryTop;
      case 'CHECKOUT_PROMO': return BannerPlacement.checkoutPromo;
      case 'ORDER_TRACKING': return BannerPlacement.orderTracking;
      case 'PARTNER_HOME': return BannerPlacement.partnerHome;
      default: return null;
    }
  }
}

class BannerThemeSpec {
  const BannerThemeSpec({required this.background, required this.foreground, required this.accent, this.gradient});
  final Color background;
  final Color foreground;
  final Color accent;
  final List<Color>? gradient;
}

abstract final class TamamBannerThemes {
  static const Map<String, BannerThemeSpec> byName = {
    'purple': BannerThemeSpec(background: Color(0xFF5D3EBC), foreground: Color(0xFFFFFFFF), accent: Color(0xFFFFD300)),
    'yellow': BannerThemeSpec(background: Color(0xFFFFD300), foreground: Color(0xFF21154A), accent: Color(0xFF5D3EBC)),
    'dark': BannerThemeSpec(background: Color(0xFF191922), foreground: Color(0xFFFFFFFF), accent: Color(0xFFFFD300)),
    'light': BannerThemeSpec(background: Color(0xFFFFFFFF), foreground: Color(0xFF191922), accent: Color(0xFF5D3EBC)),
    'gradientPurple': BannerThemeSpec(background: Color(0xFF6A48D6), foreground: Color(0xFFFFFFFF), accent: Color(0xFFFFD300), gradient: [Color(0xFF6A48D6), Color(0xFF3F2A83)]),
    'gradientSunset': BannerThemeSpec(background: Color(0xFFFFD300), foreground: Color(0xFF21154A), accent: Color(0xFF5D3EBC), gradient: [Color(0xFFFFD300), Color(0xFFF97316)]),
  };
}
