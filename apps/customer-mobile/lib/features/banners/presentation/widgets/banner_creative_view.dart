import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/theme/banner_style.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/features/banners/domain/banner.dart';
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
                    placeholder: (BuildContext _, String __) => _ShimmerFill(palette: palette),
                    errorWidget: (BuildContext _, String __, Object ___) => const SizedBox.shrink(),
                  ),
                ),
              ),
            if (banner.creative.hasOverlayText) _Scrim(palette: palette),
            if (banner.creative.hasOverlayText)
              Padding(
                padding: EdgeInsets.all(compact ? TamamSpacing.s3 : TamamSpacing.s4),
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.end,
      children: <Widget>[
        if (badge != null && badge.isNotEmpty) ...<Widget>[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s2, vertical: 3),
            decoration: BoxDecoration(
              color: palette.accent,
              borderRadius: BorderRadius.circular(TamamRadius.pill),
            ),
            child: Text(
              badge,
              style: TamamType.labelSm.toTextStyle(color: palette.background),
            ),
          ),
          const Spacer(),
        ] else
          const Spacer(),
        if (headline != null && headline.isNotEmpty)
          Text(
            headline,
            maxLines: compact ? 1 : 2,
            overflow: TextOverflow.ellipsis,
            style: (compact ? TamamType.headingSm : TamamType.headingMd)
                .toTextStyle(color: palette.foreground),
          ),
        if (!compact && subheadline != null && subheadline.isNotEmpty) ...<Widget>[
          const SizedBox(height: 2),
          Text(
            subheadline,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TamamType.bodySm.toTextStyle(color: palette.foreground.withOpacity(0.9)),
          ),
        ],
        if (cta != null && cta.isNotEmpty) ...<Widget>[
          SizedBox(height: compact ? TamamSpacing.s1 : TamamSpacing.s2),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s3, vertical: TamamSpacing.s1),
            decoration: BoxDecoration(
              color: palette.accent,
              borderRadius: BorderRadius.circular(TamamRadius.pill),
            ),
            child: Text(
              cta,
              style: TamamType.labelMd.toTextStyle(color: palette.background),
            ),
          ),
        ],
      ],
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
  State<BannerImpressionTracker> createState() => _BannerImpressionTrackerState();
}

class _BannerImpressionTrackerState extends State<BannerImpressionTracker> {
  static const Duration _dwell = Duration(seconds: 1);
  static const double _threshold = 0.5;

  DateTime? _visibleSince;
  bool _reported = false;

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) return widget.child;
    return VisibilityDetector(
      key: Key('banner-impression-${widget.trackingKey}'),
      onVisibilityChanged: _onVisibilityChanged,
      child: widget.child,
    );
  }

  void _onVisibilityChanged(VisibilityInfo info) {
    if (_reported || !mounted) return;
    if (info.visibleFraction < _threshold) {
      _visibleSince = null;
      return;
    }
    final DateTime now = DateTime.now();
    final DateTime? since = _visibleSince;
    if (since == null) {
      _visibleSince = now;
      // Visibility only fires on change, so re-check once the dwell has elapsed.
      Future<void>.delayed(_dwell, () {
        if (!mounted || _reported) return;
        final DateTime? start = _visibleSince;
        if (start != null && DateTime.now().difference(start) >= _dwell) _report();
      });
      return;
    }
    if (now.difference(since) >= _dwell) _report();
  }

  void _report() {
    _reported = true;
    widget.onImpression();
  }
}
