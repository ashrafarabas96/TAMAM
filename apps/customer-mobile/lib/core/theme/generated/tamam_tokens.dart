// AUTO-GENERATED from packages/ui-tokens/tokens.json — DO NOT EDIT BY HAND.
// Regenerate with: pnpm tokens:generate

// ignore_for_file: constant_identifier_names, public_member_api_docs
import 'package:flutter/material.dart';

import '../../contracts/generated/tamam_contracts.dart';

/// Brand palette: purple #5D3EBC and yellow #FFD300, the two identity constants.
abstract final class TamamBrand {
  static const Color purple50 = Color(0xFFF2ECFF);
  static const Color purple100 = Color(0xFFE4D9FE);
  static const Color purple200 = Color(0xFFC9B4FD);
  static const Color purple300 = Color(0xFFA98CFA);
  static const Color purple400 = Color(0xFF8560F8);
  static const Color purple500 = Color(0xFF5B32F6);
  static const Color purple600 = Color(0xFF4C27EA);
  static const Color purple700 = Color(0xFF3D1ECF);
  static const Color purple800 = Color(0xFF2E169C);
  static const Color purple900 = Color(0xFF1B0F5E);
  static const Color yellow50 = Color(0xFFFFF8E1);
  static const Color yellow100 = Color(0xFFFFECB3);
  static const Color yellow200 = Color(0xFFFFE082);
  static const Color yellow300 = Color(0xFFFFD54F);
  static const Color yellow400 = Color(0xFFFFCA28);
  static const Color yellow500 = Color(0xFFFFC107);
  static const Color yellow600 = Color(0xFFFFB300);
  static const Color yellow700 = Color(0xFFFFA000);
  static const Color yellow800 = Color(0xFFFF8F00);
  static const Color yellow900 = Color(0xFFFF6F00);
}

abstract final class TamamNeutral {
  static const Color n0 = Color(0xFFFFFFFF);
  static const Color n50 = Color(0xFFF6F6FB);
  static const Color n100 = Color(0xFFEFEFF7);
  static const Color n200 = Color(0xFFE2E1F0);
  static const Color n300 = Color(0xFFCDCBE2);
  static const Color n400 = Color(0xFFA29FC0);
  static const Color n500 = Color(0xFF77739B);
  static const Color n600 = Color(0xFF585378);
  static const Color n700 = Color(0xFF3F3A5C);
  static const Color n800 = Color(0xFF2A2542);
  static const Color n900 = Color(0xFF1B1240);
  static const Color n1000 = Color(0xFF100A28);
}

abstract final class TamamServiceColors {
  static const Color ride = Color(0xFFFFC107);
  static const Color delivery = Color(0xFF5B32F6);
  static const Color homeService = Color(0xFF3D1ECF);
  static const Color chalet = Color(0xFF8560F8);
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
    required this.textOnBrandMuted,
    required this.textOnOverlay,
    required this.accentInk,
    required this.primaryInk,
    required this.accentRule,
    required this.primaryRule,
    required this.dangerSurface,
    required this.textOnDanger,
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
  final Color textOnBrandMuted;
  final Color textOnOverlay;
  final Color accentInk;
  final Color primaryInk;
  final Color accentRule;
  final Color primaryRule;
  final Color dangerSurface;
  final Color textOnDanger;

  static const TamamColorScheme light = TamamColorScheme(
    background: Color(0xFFF6F6FB),
    surface: Color(0xFFFFFFFF),
    surfaceAlt: Color(0xFFF2ECFF),
    surfaceBrand: Color(0xFF5B32F6),
    surfaceBrandSoft: Color(0xFFF2ECFF),
    border: Color(0xFFE2E1F0),
    borderStrong: Color(0xFF77739B),
    textPrimary: Color(0xFF1B1240),
    textSecondary: Color(0xFF585378),
    textTertiary: Color(0xFF585378),
    textOnBrand: Color(0xFFFFFFFF),
    textOnAccent: Color(0xFF1B1240),
    primary: Color(0xFF5B32F6),
    primaryHover: Color(0xFF4C27EA),
    primaryPressed: Color(0xFF3D1ECF),
    accent: Color(0xFFFFC107),
    accentHover: Color(0xFFFFB300),
    accentPressed: Color(0xFFFFA000),
    overlay: Color(0xA61B1240),
    skeleton: Color(0xFFEFEFF7),
    success: Color(0xFF0E7A45),
    successSoft: Color(0xFFE4F5EC),
    successStrong: Color(0xFF0A5C34),
    warning: Color(0xFF8A5200),
    warningSoft: Color(0xFFFEF3DC),
    warningStrong: Color(0xFF6B3F00),
    danger: Color(0xFFB3123A),
    dangerSoft: Color(0xFFFDE7EC),
    dangerStrong: Color(0xFF8C0E2D),
    info: Color(0xFF1D4FBF),
    infoSoft: Color(0xFFE5EDFD),
    infoStrong: Color(0xFF163C92),
    mapRoute: Color(0xFF5B32F6),
    mapPickup: Color(0xFF0E7A45),
    mapDestination: Color(0xFFB3123A),
    textOnBrandMuted: Color(0xFFE4D9FE),
    textOnOverlay: Color(0xFFFFFFFF),
    accentInk: Color(0xFF8A5F00),
    primaryInk: Color(0xFF4C27EA),
    accentRule: Color(0xFFBD8B00),
    primaryRule: Color(0xFF8560F8),
    dangerSurface: Color(0xFFB3123A),
    textOnDanger: Color(0xFFFFFFFF),
  );

  static const TamamColorScheme dark = TamamColorScheme(
    background: Color(0xFF100A28),
    surface: Color(0xFF1B1240),
    surfaceAlt: Color(0xFF2A2542),
    surfaceBrand: Color(0xFF5B32F6),
    surfaceBrandSoft: Color(0xFF2E169C),
    border: Color(0xFF2A2542),
    borderStrong: Color(0xFF77739B),
    textPrimary: Color(0xFFF6F6FB),
    textSecondary: Color(0xFFC9B4FD),
    textTertiary: Color(0xFFA29FC0),
    textOnBrand: Color(0xFFFFFFFF),
    textOnAccent: Color(0xFF1B1240),
    primary: Color(0xFF5B32F6),
    primaryHover: Color(0xFF7C53FF),
    primaryPressed: Color(0xFF4C27EA),
    accent: Color(0xFFFFC107),
    accentHover: Color(0xFFFFCA28),
    accentPressed: Color(0xFFFFB300),
    overlay: Color(0xD9100A28),
    skeleton: Color(0xFF2A2542),
    success: Color(0xFF3DD68C),
    successSoft: Color(0xFF12301F),
    successStrong: Color(0xFF6FE7AC),
    warning: Color(0xFFFFCA28),
    warningSoft: Color(0xFF332405),
    warningStrong: Color(0xFFFFE082),
    danger: Color(0xFFFF7A94),
    dangerSoft: Color(0xFF37131C),
    dangerStrong: Color(0xFFFFA3B4),
    info: Color(0xFFA98CFA),
    infoSoft: Color(0xFF141F38),
    infoStrong: Color(0xFFC9B4FD),
    mapRoute: Color(0xFFA98CFA),
    mapPickup: Color(0xFF3DD68C),
    mapDestination: Color(0xFFFF7A94),
    textOnBrandMuted: Color(0xFFE4D9FE),
    textOnOverlay: Color(0xFFFFFFFF),
    accentInk: Color(0xFFFFC107),
    primaryInk: Color(0xFFA98CFA),
    accentRule: Color(0xFFFFC107),
    primaryRule: Color(0xFF8560F8),
    dangerSurface: Color(0xFF8C0E2D),
    textOnDanger: Color(0xFFFFFFFF),
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
  static const double serviceCardHeight = 140.0;
  static const double bannerHeroHeight = 168.0;
  static const double bannerInlineHeight = 96.0;
  static const double bannerAspectHero = 2.25;
  static const double bannerAspectInline = 3.6;
  static const double serviceIconTile = 52.0;
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

  /// The face these styles render in when a call site does not name one.
  ///
  /// Most styles in the app are built by calling toTextStyle() directly rather
  /// than by reading Theme.of(context).textTheme, so setting the family on the
  /// TextTheme alone left those call sites with a null family and the platform
  /// default -- the app rendered in two typefaces at once. Defaulting it here
  /// covers every call site, themed or not.
  static String get family =>
      _isArabic ? TamamFonts.arabic : TamamFonts.latin;

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
        fontFamily: fontFamily ?? family,
        fontFamilyFallback: fontFamily != null
            ? null
            : (_isArabic
                ? <String>[TamamFonts.latin, ...TamamFonts.fallbackArabic]
                : <String>[TamamFonts.arabic, ...TamamFonts.fallbackLatin]),
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
    'purple': BannerThemeSpec(background: Color(0xFF5B32F6), foreground: Color(0xFFFFFFFF), accent: Color(0xFFFFC107)),
    'yellow': BannerThemeSpec(background: Color(0xFFFFC107), foreground: Color(0xFF1B1240), accent: Color(0xFF3D1ECF)),
    'dark': BannerThemeSpec(background: Color(0xFF1B0F5E), foreground: Color(0xFFFFFFFF), accent: Color(0xFFFFC107)),
    'light': BannerThemeSpec(background: Color(0xFFFFFFFF), foreground: Color(0xFF1B1240), accent: Color(0xFF5B32F6)),
    'gradientPurple': BannerThemeSpec(background: Color(0xFF5B32F6), foreground: Color(0xFFFFFFFF), accent: Color(0xFFFFC107), gradient: [Color(0xFF5B32F6), Color(0xFF3D1ECF)]),
    'gradientSunset': BannerThemeSpec(background: Color(0xFFFFC107), foreground: Color(0xFF1B1240), accent: Color(0xFF3D1ECF), gradient: [Color(0xFFFFC107), Color(0xFFFF6F00)]),
  };
}
