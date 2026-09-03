import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';

/// Carries the generated semantic palette through `Theme.of(context)` so no
/// widget ever reaches for a raw colour constant.
@immutable
class TamamColors extends ThemeExtension<TamamColors> {
  const TamamColors(this.scheme);

  final TamamColorScheme scheme;

  Color get background => scheme.background;
  Color get surface => scheme.surface;
  Color get surfaceAlt => scheme.surfaceAlt;
  Color get surfaceBrand => scheme.surfaceBrand;
  Color get surfaceBrandSoft => scheme.surfaceBrandSoft;
  Color get border => scheme.border;
  Color get borderStrong => scheme.borderStrong;
  Color get textPrimary => scheme.textPrimary;
  Color get textSecondary => scheme.textSecondary;
  Color get textTertiary => scheme.textTertiary;
  Color get textOnBrand => scheme.textOnBrand;
  Color get textOnAccent => scheme.textOnAccent;
  Color get primary => scheme.primary;
  Color get accent => scheme.accent;
  Color get overlay => scheme.overlay;
  Color get skeleton => scheme.skeleton;
  Color get mapRoute => scheme.mapRoute;
  Color get mapPickup => scheme.mapPickup;
  Color get mapDestination => scheme.mapDestination;

  Color get success => TamamSemantic.successBase;
  Color get successSoft => TamamSemantic.successSoft;
  Color get warning => TamamSemantic.warningBase;
  Color get warningSoft => TamamSemantic.warningSoft;
  Color get danger => TamamSemantic.dangerBase;
  Color get dangerSoft => TamamSemantic.dangerSoft;
  Color get info => TamamSemantic.infoBase;
  Color get infoSoft => TamamSemantic.infoSoft;

  @override
  TamamColors copyWith({TamamColorScheme? scheme}) => TamamColors(scheme ?? this.scheme);

  /// The palette is a fixed pair (light/dark); mid-animation blends would only
  /// muddy brand colours, so the target scheme wins immediately.
  @override
  TamamColors lerp(covariant TamamColors? other, double t) => t < 0.5 ? this : (other ?? this);
}

/// Convenience accessors used throughout the widget tree.
extension TamamThemeContext on BuildContext {
  TamamColors get colors => Theme.of(this).extension<TamamColors>() ?? const TamamColors(TamamColorScheme.light);
  TextTheme get texts => Theme.of(this).textTheme;
  bool get isRtl => Directionality.of(this) == TextDirection.rtl;
}

/// Builds the Getir-inspired light and dark themes from the generated tokens.
///
/// Rules encoded here (so screens never repeat them):
///  * primary CTA = yellow surface, dark-purple bold label, 52 high, radius 12;
///  * secondary CTA = purple surface, white label;
///  * cards = white, radius 16, soft elevation shadow;
///  * inputs = 52 high, filled surface, radius 12, purple focus ring;
///  * bottom sheets = radius 24;
///  * chips = pill-shaped.
abstract final class TamamTheme {
  static ThemeData light(String languageCode) => _build(TamamColorScheme.light, Brightness.light, languageCode);

  static ThemeData dark(String languageCode) => _build(TamamColorScheme.dark, Brightness.dark, languageCode);

  /// Cairo for Arabic, Inter for Latin — both with the platform stack as fallback.
  static TextTheme fontsFor(String languageCode, TextTheme base) =>
      languageCode.startsWith('ar') ? GoogleFonts.cairoTextTheme(base) : GoogleFonts.interTextTheme(base);

  static ThemeData _build(TamamColorScheme c, Brightness brightness, String languageCode) {
    final TextTheme text = fontsFor(languageCode, _textTheme(c));
    final ColorScheme material = ColorScheme(
      brightness: brightness,
      primary: c.primary,
      onPrimary: c.textOnBrand,
      primaryContainer: c.surfaceBrandSoft,
      onPrimaryContainer: c.primary,
      secondary: c.accent,
      onSecondary: c.textOnAccent,
      secondaryContainer: TamamBrand.yellow100,
      onSecondaryContainer: TamamBrand.purple900,
      surface: c.surface,
      onSurface: c.textPrimary,
      surfaceContainerHighest: c.surfaceAlt,
      onSurfaceVariant: c.textSecondary,
      error: TamamSemantic.dangerBase,
      onError: TamamNeutral.n0,
      errorContainer: TamamSemantic.dangerSoft,
      onErrorContainer: TamamSemantic.dangerStrong,
      outline: c.border,
      outlineVariant: c.borderStrong,
      shadow: TamamNeutral.n1000,
      scrim: c.overlay,
      inverseSurface: c.textPrimary,
      onInverseSurface: c.surface,
      inversePrimary: TamamBrand.purple200,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: material,
      scaffoldBackgroundColor: c.background,
      canvasColor: c.background,
      dividerColor: c.border,
      splashFactory: InkSparkle.splashFactory,
      textTheme: text,
      extensions: <ThemeExtension<Object?>>[TamamColors(c)],
      appBarTheme: AppBarTheme(
        backgroundColor: c.surfaceBrand,
        foregroundColor: c.textOnBrand,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        toolbarHeight: TamamSize.appBarHeight,
        titleTextStyle: TamamType.headingMd.toTextStyle(color: c.textOnBrand).merge(text.titleMedium),
        iconTheme: IconThemeData(color: c.textOnBrand, size: TamamSize.iconMd),
      ),
      cardTheme: CardThemeData(
        color: c.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TamamRadius.card)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(style: primaryButtonStyle(c, text)),
      filledButtonTheme: FilledButtonThemeData(style: secondaryButtonStyle(c, text)),
      outlinedButtonTheme: OutlinedButtonThemeData(style: outlineButtonStyle(c, text)),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: c.primary,
          minimumSize: const Size(0, TamamSize.touchTargetMin),
          textStyle: TamamType.labelLg.toTextStyle(),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s4, vertical: TamamSpacing.s4),
        hintStyle: TamamType.bodyMd.toTextStyle(color: c.textTertiary),
        labelStyle: TamamType.labelMd.toTextStyle(color: c.textSecondary),
        floatingLabelStyle: TamamType.labelMd.toTextStyle(color: c.primary),
        errorStyle: TamamType.bodySm.toTextStyle(color: TamamSemantic.dangerBase),
        border: _inputBorder(c.border),
        enabledBorder: _inputBorder(c.border),
        focusedBorder: _inputBorder(c.primary, width: 1.6),
        errorBorder: _inputBorder(TamamSemantic.dangerBase),
        focusedErrorBorder: _inputBorder(TamamSemantic.dangerBase, width: 1.6),
        disabledBorder: _inputBorder(c.border),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: c.surface,
        selectedColor: c.surfaceBrandSoft,
        disabledColor: c.surfaceAlt,
        labelStyle: TamamType.labelMd.toTextStyle(color: c.textPrimary),
        secondaryLabelStyle: TamamType.labelMd.toTextStyle(color: c.primary),
        side: BorderSide(color: c.border),
        padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s3, vertical: TamamSpacing.s2),
        shape: const StadiumBorder(),
        showCheckmark: false,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: c.surface,
        showDragHandle: true,
        dragHandleColor: c.borderStrong,
        dragHandleSize: const Size(44, 4),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(TamamRadius.sheet)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TamamRadius.xl)),
        titleTextStyle: TamamType.headingMd.toTextStyle(color: c.textPrimary).merge(text.titleMedium),
        contentTextStyle: TamamType.bodyMd.toTextStyle(color: c.textSecondary).merge(text.bodyMedium),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: c.surfaceBrandSoft,
        height: TamamSize.bottomNavHeight,
        elevation: 0,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith<IconThemeData>(
          (Set<WidgetState> states) => IconThemeData(
            size: TamamSize.iconMd,
            color: states.contains(WidgetState.selected) ? c.primary : c.textTertiary,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith<TextStyle>(
          (Set<WidgetState> states) => TamamType.labelSm.toTextStyle(
            color: states.contains(WidgetState.selected) ? c.primary : c.textTertiary,
          ),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: TamamBrand.purple900,
        contentTextStyle: TamamType.bodyMd.toTextStyle(color: TamamNeutral.n0),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TamamRadius.md)),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: c.primary,
        unselectedLabelColor: c.textTertiary,
        labelStyle: TamamType.labelLg.toTextStyle(),
        unselectedLabelStyle: TamamType.labelLg.toTextStyle(),
        indicatorColor: c.primary,
        indicatorSize: TabBarIndicatorSize.tab,
        dividerColor: c.border,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: c.primary, linearTrackColor: c.skeleton),
      listTileTheme: ListTileThemeData(
        iconColor: c.textSecondary,
        textColor: c.textPrimary,
        titleTextStyle: TamamType.bodyLg.toTextStyle(color: c.textPrimary),
        subtitleTextStyle: TamamType.bodySm.toTextStyle(color: c.textSecondary),
        minVerticalPadding: TamamSpacing.s3,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TamamRadius.md)),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith<Color>(
          (Set<WidgetState> s) => s.contains(WidgetState.selected) ? TamamNeutral.n0 : c.surface,
        ),
        trackColor: WidgetStateProperty.resolveWith<Color>(
          (Set<WidgetState> s) => s.contains(WidgetState.selected) ? c.primary : c.borderStrong,
        ),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith<Color>(
          (Set<WidgetState> s) => s.contains(WidgetState.selected) ? c.primary : c.borderStrong,
        ),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith<Color>(
          (Set<WidgetState> s) => s.contains(WidgetState.selected) ? c.primary : Colors.transparent,
        ),
        side: BorderSide(color: c.borderStrong, width: 1.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TamamRadius.xs)),
      ),
    );
  }

  /// Yellow CTA with dark-purple bold text — the app's single primary action.
  static ButtonStyle primaryButtonStyle(TamamColorScheme c, TextTheme text) => ElevatedButton.styleFrom(
        backgroundColor: c.accent,
        foregroundColor: c.textOnAccent,
        disabledBackgroundColor: c.skeleton,
        disabledForegroundColor: c.textTertiary,
        elevation: 0,
        minimumSize: const Size.fromHeight(TamamSize.buttonHeightLg),
        padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TamamRadius.button)),
        textStyle: TamamType.labelLg.toTextStyle().merge(text.labelLarge).copyWith(fontWeight: FontWeight.w700),
      );

  static ButtonStyle secondaryButtonStyle(TamamColorScheme c, TextTheme text) => FilledButton.styleFrom(
        backgroundColor: c.primary,
        foregroundColor: c.textOnBrand,
        disabledBackgroundColor: c.skeleton,
        disabledForegroundColor: c.textTertiary,
        elevation: 0,
        minimumSize: const Size.fromHeight(TamamSize.buttonHeightLg),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TamamRadius.button)),
        textStyle: TamamType.labelLg.toTextStyle().merge(text.labelLarge),
      );

  static ButtonStyle outlineButtonStyle(TamamColorScheme c, TextTheme text) => OutlinedButton.styleFrom(
        foregroundColor: c.primary,
        minimumSize: const Size.fromHeight(TamamSize.buttonHeightLg),
        side: BorderSide(color: c.borderStrong),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(TamamRadius.button)),
        textStyle: TamamType.labelLg.toTextStyle().merge(text.labelLarge),
      );

  static OutlineInputBorder _inputBorder(Color color, {double width = 1}) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(TamamRadius.button),
        borderSide: BorderSide(color: color, width: width),
      );

  static TextTheme _textTheme(TamamColorScheme c) => TextTheme(
        displayLarge: TamamType.displayLg.toTextStyle(color: c.textPrimary),
        displayMedium: TamamType.displaySm.toTextStyle(color: c.textPrimary),
        displaySmall: TamamType.headingLg.toTextStyle(color: c.textPrimary),
        headlineMedium: TamamType.headingLg.toTextStyle(color: c.textPrimary),
        headlineSmall: TamamType.headingMd.toTextStyle(color: c.textPrimary),
        titleLarge: TamamType.headingMd.toTextStyle(color: c.textPrimary),
        titleMedium: TamamType.headingSm.toTextStyle(color: c.textPrimary),
        titleSmall: TamamType.labelLg.toTextStyle(color: c.textPrimary),
        bodyLarge: TamamType.bodyLg.toTextStyle(color: c.textPrimary),
        bodyMedium: TamamType.bodyMd.toTextStyle(color: c.textPrimary),
        bodySmall: TamamType.bodySm.toTextStyle(color: c.textSecondary),
        labelLarge: TamamType.labelLg.toTextStyle(color: c.textPrimary),
        labelMedium: TamamType.labelMd.toTextStyle(color: c.textSecondary),
        labelSmall: TamamType.labelSm.toTextStyle(color: c.textTertiary),
      );
}
