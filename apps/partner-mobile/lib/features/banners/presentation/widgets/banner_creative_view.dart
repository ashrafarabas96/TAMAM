import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/theme/banner_style.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/features/banners/domain/banner.dart';
import 'package:visibility_detector/visibility_detector.dart';

/// Draws one banner: artwork, legibility scrim and the localised overlay.
///
/// The creative may be pure artwork (no overlay fields) or artwork plus copy;
/// when the image fails to load the theme colour and the headline still carry
/// the message, so a broken CDN never leaves an empty rectangle.
class BannerCreativeView extends ConsumerWidget {
  const BannerCreativeView({
    required this.banner,
    super.key,
    this.radius = TamamRadius.banner,
    this.parallax = 0,
    this.compact = false,
  });

  final PromoBanner banner;
  final double radius;

  /// -1…1 — horizontal offset of the artwork relative to the card, giving the
  /// carousel a subtle depth cue while paging.
  final double parallax;

  /// Inline placements have less height, so the overlay drops a line.
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final String language = ref.watch(localeControllerProvider).languageCode;
    final BannerPalette palette = BannerPalette.forTheme(banner.creative.theme);
    final BorderRadius borderRadius = BorderRadius.circular(radius);
    final String imageUrl = banner.creative.imageUrl.resolve(language);

    return DecoratedBox(
      decoration: palette.decoration(borderRadius),
      child: ClipRRect(
        borderRadius: borderRadius,
        child: Stack(
          fit: StackFit.expand,
          children: <Widget>[
            if (imageUrl.isNotEmpty)
              Transform.translate(
                offset: Offset(parallax * 18, 0),
                child: Transform.scale(
                  scale: parallax == 0 ? 1 : 1.06,
                  child: CachedNetworkImage(
                    imageUrl: imageUrl,
                    fit: BoxFit.cover,
                    fadeInDuration: TamamMotion.durationBase,
                    placeholder: (BuildContext _, String __) =>
                        _ShimmerFill(palette: palette),
                    errorWidget: (BuildContext _, String __, Object ___) =>
                        const SizedBox.shrink(),
                  ),
                ),
              ),
            if (banner.creative.hasOverlayText) _Scrim(palette: palette),
            if (banner.creative.hasOverlayText)
              Padding(
                padding:
                    EdgeInsets.all(compact ? TamamSpacing.s3 : TamamSpacing.s4),
                child: _Overlay(
                  banner: banner,
                  palette: palette,
                  language: language,
                  compact: compact,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Scrim extends StatelessWidget {
  const _Scrim({required this.palette});

  final BannerPalette palette;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: <Color>[
              palette.background.withOpacity(0.82),
              palette.background.withOpacity(0.25),
              Colors.transparent,
            ],
            stops: const <double>[0, 0.55, 1],
          ),
        ),
      );
}

class _Overlay extends StatelessWidget {
  const _Overlay({
    required this.banner,
    required this.palette,
    required this.language,
    required this.compact,
  });

  final PromoBanner banner;
  final BannerPalette palette;
  final String language;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final BannerCreative creative = banner.creative;
    final String? badge = creative.badge?.resolve(language);
    final String? headline = creative.headline?.resolve(language);
    final String? subheadline = creative.subheadline?.resolve(language);
    final String? cta = creative.ctaLabel?.resolve(language);

    // The hero's height comes from its aspect ratio, not from this text. On a
    // 320-wide phone that is about 140px; with Arabic leading and large
    // accessibility text the badge, a two-line headline, a subheadline and a
    // CTA simply do not fit, and a Spacer in an overflowing column is meaningless.
    // Instead the overlay measures what each piece needs — line height times
    // the user's text scale, which is exact because every style pins `height` —
    // against the height it was actually given, and adds pieces in order of
    // importance: one headline line, the CTA, the badge, the second headline
    // line, the subheadline. Nothing is ever clipped; it is left out.
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints box) {
        final TextScaler scaler = MediaQuery.textScalerOf(context);
        final TextDirection direction = Directionality.of(context);
        final TextStyle ambient = DefaultTextStyle.of(context).style;
        final TextHeightBehavior? heightBehavior =
            DefaultTextHeightBehavior.maybeOf(context);
        final Locale? locale = Localizations.maybeLocaleOf(context);

        // Measures a piece exactly as the Text widget below will draw it: same
        // string, style, scale, direction and width. Predicting from the token
        // line height is not enough — a line that mixes scripts (an Arabic
        // headline in the Latin theme, a Latin promo code in the Arabic one)
        // takes the tallest of its fallback fonts, and the engine rounds
        // ascent and descent to whole pixels.
        double heightOf(String text, TamamTypeStyle style, int maxLines,
            [double inset = 0]) {
          final TextPainter painter = TextPainter(
            text:
                TextSpan(text: text, style: ambient.merge(style.toTextStyle())),
            textDirection: direction,
            textScaler: scaler,
            maxLines: maxLines,
            ellipsis: '\u2026',
            locale: locale,
            textHeightBehavior: heightBehavior,
          )..layout(
              maxWidth: (box.maxWidth - inset).clamp(0.0, double.infinity));
          final double height = painter.height;
          painter.dispose();
          return height;
        }

        // One pixel of slack: the engine rounds line boxes to device pixels and
        // a third of a pixel over is still an overflow.
        final double h = box.maxHeight - 1;
        final bool hasHeadline = headline != null && headline.isNotEmpty;
        final bool hasCta = cta != null && cta.isNotEmpty;
        final bool hasBadge = badge != null && badge.isNotEmpty;
        final bool hasSub =
            !compact && subheadline != null && subheadline.isNotEmpty;

        final double ctaH = hasCta
            ? heightOf(cta, TamamType.labelMd, 1, TamamSpacing.s3 * 2) +
                TamamSpacing.s1 * 2
            : 0;
        final double badgeH = hasBadge
            ? heightOf(badge, TamamType.labelSm, 1, TamamSpacing.s2 * 2) + 6
            : 0;
        final double subH =
            hasSub ? heightOf(subheadline, TamamType.bodySm, 1) + 2 : 0;
        double oneLine(TamamTypeStyle style) =>
            hasHeadline ? heightOf(headline, style, 1) : 0;

        double baseline(TamamTypeStyle style, double gap) =>
            oneLine(style) + (hasHeadline && hasCta ? gap : 0) + ctaH;

        // Start from the largest headline and the comfortable gap; step down a
        // size, then tighten the gap, only when one headline line plus the CTA
        // would not fit otherwise.
        TamamTypeStyle headlineStyle =
            compact ? TamamType.headingSm : TamamType.headingMd;
        double gap = TamamSpacing.s2;
        if (baseline(headlineStyle, gap) > h) {
          headlineStyle = TamamType.headingSm;
        }
        if (baseline(headlineStyle, gap) > h) {
          gap = TamamSpacing.s1;
        }
        if (baseline(headlineStyle, gap) > h) {
          gap = 0;
        }
        double used = baseline(headlineStyle, gap);

        // A box too short for one headline line and the button keeps the
        // message and loses the button: the banner is tappable as a whole.
        final bool showCta = hasCta && (!hasHeadline || used <= h);
        if (hasCta && !showCta) {
          used = oneLine(headlineStyle);
        }
        // Beyond even that — a strip a few dozen pixels tall at the largest
        // accessibility scale — what remains scales down as one piece rather
        // than overflowing.
        final bool squeeze = used > h;

        // The badge sits in the top corner; the column rises from the bottom.
        // They must not meet, so the badge only earns its place if a clear
        // spacing remains between the two.
        final bool showBadge = hasBadge && used + TamamSpacing.s2 + badgeH <= h;
        if (showBadge) {
          used += TamamSpacing.s2 + badgeH;
        }

        // A short headline such as "خصم ٢٠٪" must not reserve a second line it
        // never uses, so the two-line height is measured, not assumed.
        int headlineLines = 1;
        if (hasHeadline && !compact) {
          final double single = oneLine(headlineStyle);
          final double wrapped = heightOf(headline, headlineStyle, 2);
          if (wrapped > single && used - single + wrapped <= h) {
            headlineLines = 2;
            used += wrapped - single;
          }
        }

        final bool showSub = hasSub && used + subH <= h;

        final Widget column = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            if (hasHeadline)
              Text(
                headline,
                maxLines: headlineLines,
                overflow: TextOverflow.ellipsis,
                style: headlineStyle.toTextStyle(color: palette.foreground),
              ),
            if (showSub) ...<Widget>[
              const SizedBox(height: 2),
              Text(
                subheadline,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TamamType.bodySm.toTextStyle(
                    color: palette.foreground.withValues(alpha: 0.9)),
              ),
            ],
            if (showCta) ...<Widget>[
              if (hasHeadline) SizedBox(height: gap),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: TamamSpacing.s3,
                  vertical: TamamSpacing.s1,
                ),
                decoration: BoxDecoration(
                  color: palette.accent,
                  borderRadius: BorderRadius.circular(TamamRadius.pill),
                ),
                child: Text(
                  cta,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style:
                      TamamType.labelMd.toTextStyle(color: palette.background),
                ),
              ),
            ],
          ],
        );

        return Stack(
          children: <Widget>[
            if (showBadge)
              PositionedDirectional(
                top: 0,
                start: 0,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: TamamSpacing.s2, vertical: 3),
                  decoration: BoxDecoration(
                    color: palette.accent,
                    borderRadius: BorderRadius.circular(TamamRadius.pill),
                  ),
                  child: Text(
                    badge,
                    maxLines: 1,
                    style: TamamType.labelSm
                        .toTextStyle(color: palette.background),
                  ),
                ),
              ),
            Align(
              alignment: AlignmentDirectional.bottomStart,
              child: squeeze
                  ? FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: AlignmentDirectional.bottomStart,
                      child: ConstrainedBox(
                        constraints: BoxConstraints(maxWidth: box.maxWidth),
                        child: column,
                      ),
                    )
                  : column,
            ),
          ],
        );
      },
    );
  }
}

class _ShimmerFill extends StatelessWidget {
  const _ShimmerFill({required this.palette});

  final BannerPalette palette;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(color: palette.background.withOpacity(0.6)),
      );
}

/// Reports an impression once a banner has been at least 50 % visible for one
/// continuous second — the definition the campaign analytics assume.
class BannerImpressionTracker extends StatefulWidget {
  const BannerImpressionTracker({
    required this.trackingKey,
    required this.onImpression,
    required this.child,
    super.key,
    this.enabled = true,
  });

  /// Stable across rebuilds; also used as the [VisibilityDetector] key.
  final String trackingKey;
  final VoidCallback onImpression;
  final Widget child;
  final bool enabled;

  @override
  State<BannerImpressionTracker> createState() =>
      _BannerImpressionTrackerState();
}

class _BannerImpressionTrackerState extends State<BannerImpressionTracker> {
  static const Duration _dwell = Duration(seconds: 1);
  static const double _threshold = 0.5;

  bool _reported = false;
  Timer? _dwellTimer;

  @override
  void dispose() {
    _dwellTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) return widget.child;
    return VisibilityDetector(
      key: Key('banner-impression-${widget.trackingKey}'),
      onVisibilityChanged: _onVisibilityChanged,
      child: widget.child,
    );
  }

  /// An impression is one uninterrupted second at or above [_threshold] visibility. The
  /// timer *is* the dwell: it starts when the banner becomes visible and is cancelled the
  /// moment it stops being visible. Measuring elapsed time with `DateTime.now()` as well
  /// was both redundant and untestable — widget tests advance a fake clock, which the wall
  /// clock never sees, so the impression could never fire under test.
  void _onVisibilityChanged(VisibilityInfo info) {
    if (_reported || !mounted) return;
    if (info.visibleFraction < _threshold) {
      _dwellTimer?.cancel();
      _dwellTimer = null;
      return;
    }
    if (_dwellTimer?.isActive ?? false) return;
    _dwellTimer = Timer(_dwell, () {
      if (mounted && !_reported) _report();
    });
  }

  void _report() {
    _reported = true;
    _dwellTimer?.cancel();
    widget.onImpression();
  }
}
