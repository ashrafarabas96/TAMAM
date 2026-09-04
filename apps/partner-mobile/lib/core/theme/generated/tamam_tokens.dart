// AUTO-GENERATED from packages/ui-tokens/tokens.json — DO NOT EDIT BY HAND.
// Regenerate with: pnpm tokens:generate

// ignore_for_file: constant_identifier_names, public_member_api_docs
import 'package:flutter/material.dart';

import '../../contracts/generated/tamam_contracts.dart';

/// Brand palette (purple + yellow) — Getir-inspired identity.
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

abstract final class TamamSemantic {
  static const Color successBase = Color(0xFF1FA463);
  static const Color successSoft = Color(0xFFE3F6EC);
  static const Color successStrong = Color(0xFF15794A);
  static const Color warningBase = Color(0xFFF59E0B);
  static const Color warningSoft = Color(0xFFFEF3DC);
  static const Color warningStrong = Color(0xFFB45309);
  static const Color dangerBase = Color(0xFFE11D48);
  static const Color dangerSoft = Color(0xFFFDE7EC);
  static const Color dangerStrong = Color(0xFF9F1239);
  static const Color infoBase = Color(0xFF2563EB);
  static const Color infoSoft = Color(0xFFE5EDFD);
  static const Color infoStrong = Color(0xFF1E40AF);
}

abstract final class TamamServiceColors {
  static const Color ride = Color(0xFF5B32F6);
  static const Color delivery = Color(0xFF3D1ECF);
  static const Color homeService = Color(0xFFFFC107);
  static const Color chalet = Color(0xFF8560F8);
  static const Color urgent = Color(0xFFE11D48);
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
  final Color mapRoute;
  final Color mapPickup;
  final Color mapDestination;

  static const TamamColorScheme light = TamamColorScheme(
    background: Color(0xFFF6F6FB),
    surface: Color(0xFFFFFFFF),
    surfaceAlt: Color(0xFFF2ECFF),
    surfaceBrand: Color(0xFF5B32F6),
    surfaceBrandSoft: Color(0xFFF2ECFF),
    border: Color(0xFFE2E1F0),
    borderStrong: Color(0xFFCDCBE2),
    textPrimary: Color(0xFF1B1240),
    textSecondary: Color(0xFF585378),
    textTertiary: Color(0xFFA29FC0),
    textOnBrand: Color(0xFFFFFFFF),
    textOnAccent: Color(0xFF1B1240),
    primary: Color(0xFF5B32F6),
    primaryHover: Color(0xFF4C27EA),
    primaryPressed: Color(0xFF3D1ECF),
    accent: Color(0xFFFFC107),
    accentHover: Color(0xFFFFB300),
    accentPressed: Color(0xFFFFA000),
    overlay: Color(0x991B1240),
    skeleton: Color(0xFFEFEFF7),
    mapRoute: Color(0xFF5B32F6),
    mapPickup: Color(0xFF1FA463),
    mapDestination: Color(0xFFE11D48),
  );

  static const TamamColorScheme dark = TamamColorScheme(
    background: Color(0xFF100A28),
    surface: Color(0xFF1B1240),
    surfaceAlt: Color(0xFF2A2542),
    surfaceBrand: Color(0xFF5B32F6),
    surfaceBrandSoft: Color(0xFF2E169C),
    border: Color(0xFF2A2542),
    borderStrong: Color(0xFF3F3A5C),
    textPrimary: Color(0xFFF6F6FB),
    textSecondary: Color(0xFFA29FC0),
    textTertiary: Color(0xFF77739B),
    textOnBrand: Color(0xFFFFFFFF),
    textOnAccent: Color(0xFF1B1240),
    primary: Color(0xFFA98CFA),
    primaryHover: Color(0xFFC9B4FD),
    primaryPressed: Color(0xFF8560F8),
    accent: Color(0xFFFFCA28),
    accentHover: Color(0xFFFFD54F),
    accentPressed: Color(0xFFFFC107),
    overlay: Color(0xCC100A28),
    skeleton: Color(0xFF2A2542),
    mapRoute: Color(0xFFA98CFA),
    mapPickup: Color(0xFF4ED08D),
    mapDestination: Color(0xFFFB7185),
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
  static const double card = 16.0;
  static const double button = 12.0;
  static const double sheet = 24.0;
  static const double banner = 16.0;
}

abstract final class TamamSize {
  static const double touchTargetMin = 48.0;
  static const double buttonHeightLg = 52.0;
  static const double buttonHeightMd = 44.0;
  static const double buttonHeightSm = 36.0;
  static const double inputHeight = 52.0;
  static const double appBarHeight = 56.0;
  static const double bottomNavHeight = 64.0;
  static const double iconSm = 16.0;
  static const double iconMd = 22.0;
  static const double iconLg = 28.0;
  static const double avatarSm = 32.0;
  static const double avatarMd = 44.0;
  static const double avatarLg = 64.0;
  static const double serviceCardHeight = 120.0;
  static const double bannerHeroHeight = 156.0;
  static const double bannerInlineHeight = 96.0;
  static const double bannerAspectHero = 2.25;
  static const double bannerAspectInline = 3.6;
}

/// Elevation tokens as ready-to-use shadow lists (soft, brand-tinted).
abstract final class TamamElevation {
  static const List<BoxShadow> card = <BoxShadow>[BoxShadow(color: Color(0x0F1E1050), offset: Offset(0.0, 2.0), blurRadius: 10.0, spreadRadius: 0.0)];
  static const List<BoxShadow> raised = <BoxShadow>[BoxShadow(color: Color(0x191E1050), offset: Offset(0.0, 6.0), blurRadius: 20.0, spreadRadius: 0.0)];
  static const List<BoxShadow> sheet = <BoxShadow>[BoxShadow(color: Color(0x261E1050), offset: Offset(0.0, -4.0), blurRadius: 24.0, spreadRadius: 0.0)];
  static const List<BoxShadow> floating = <BoxShadow>[BoxShadow(color: Color(0x331E1050), offset: Offset(0.0, 8.0), blurRadius: 28.0, spreadRadius: 0.0)];
}

abstract final class TamamMotion {
  static const Duration durationFast = Duration(milliseconds: 120);
  static const Duration durationBase = Duration(milliseconds: 200);
  static const Duration durationSlow = Duration(milliseconds: 320);
  static const Duration durationBannerAutoplay = Duration(milliseconds: 4500);
}

abstract final class TamamFonts {
  static const String arabic = 'Cairo';
  static const String latin = 'Inter';
  static const String mono = 'JetBrains Mono';
}

class TamamTypeStyle {
  const TamamTypeStyle(this.size, this.lineHeight, this.weight, this.letterSpacing);
  final double size;
  final double lineHeight;
  final FontWeight weight;
  final double letterSpacing;
  TextStyle toTextStyle({Color? color, String? fontFamily}) => TextStyle(
        fontSize: size,
        height: lineHeight / size,
        fontWeight: weight,
        letterSpacing: letterSpacing,
        color: color,
        fontFamily: fontFamily,
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
    BannerPlacement.homeHero: BannerPlacementSpec(aspectRatio: 2.25, maxItems: 6, autoplay: Duration(milliseconds: 4500), style: 'carousel'),
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
    'gradientPurple': BannerThemeSpec(background: Color(0xFF5D3EBC), foreground: Color(0xFFFFFFFF), accent: Color(0xFFFFD300), gradient: [Color(0xFF5D3EBC), Color(0xFF3E2887)]),
    'gradientSunset': BannerThemeSpec(background: Color(0xFFFFD300), foreground: Color(0xFF21154A), accent: Color(0xFF5D3EBC), gradient: [Color(0xFFFFD300), Color(0xFFF97316)]),
  };
}
