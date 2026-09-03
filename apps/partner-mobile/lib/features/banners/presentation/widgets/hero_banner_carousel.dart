import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/theme/banner_style.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/features/banners/domain/banner.dart';
import 'package:tamam_partner/features/banners/presentation/banner_action_handler.dart';
import 'package:tamam_partner/features/banners/presentation/banner_providers.dart';
import 'package:tamam_partner/features/banners/presentation/widgets/banner_creative_view.dart';
import 'package:visibility_detector/visibility_detector.dart';

/// The full-width hero carousel at the top of the home canvas.
///
/// Behaviour worth calling out:
///  * autoplay pauses while the customer touches it and while it is scrolled
///    off screen, then resumes — it never fights the user;
///  * paging follows the ambient text direction, so in Arabic the second banner
///    is to the left;
///  * each page gets a small parallax offset for depth without a heavy effect;
///  * impressions are reported per banner by [BannerImpressionTracker].
class HeroBannerCarousel extends ConsumerStatefulWidget {
  const HeroBannerCarousel({
    required this.banners,
    required this.placement,
    super.key,
    this.aspectRatio,
    this.autoplay,
  });

  final List<PromoBanner> banners;
  final BannerPlacement placement;
  final double? aspectRatio;
  final Duration? autoplay;

  @override
  ConsumerState<HeroBannerCarousel> createState() => _HeroBannerCarouselState();
}

class _HeroBannerCarouselState extends ConsumerState<HeroBannerCarousel> {
  static const double _viewportFraction = 0.92;

  final PageController _controller = PageController(viewportFraction: _viewportFraction);
  Timer? _timer;
  int _index = 0;
  double _page = 0;
  bool _paused = false;
  bool _visible = true;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onScroll);
    _restartTimer();
  }

  @override
  void didUpdateWidget(covariant HeroBannerCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.banners.length != widget.banners.length) {
      _index = 0;
      _restartTimer();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_controller.hasClients) return;
    final double? page = _controller.page;
    if (page == null) return;
    setState(() {
      _page = page;
      _index = page.round();
    });
  }

  void _restartTimer() {
    _timer?.cancel();
    final Duration interval = widget.autoplay ?? BannerStyle.forPlacement(widget.placement).autoplay;
    if (interval.inMilliseconds <= 0 || widget.banners.length < 2) return;
    _timer = Timer.periodic(interval, (_) => _advance());
  }

  void _advance() {
    if (_paused || !_visible || !mounted || !_controller.hasClients) return;
    final int next = (_index + 1) % widget.banners.length;
    unawaited(
      _controller.animateToPage(
        next,
        duration: TamamMotion.durationSlow,
        curve: Curves.easeOutCubic,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.banners.isEmpty) return const SizedBox.shrink();
    final double ratio = widget.aspectRatio ?? BannerStyle.forPlacement(widget.placement).aspectRatio;

    return VisibilityDetector(
      key: Key('hero-carousel-${widget.placement.value}'),
      onVisibilityChanged: (VisibilityInfo info) {
        final bool visible = info.visibleFraction > 0.35;
        if (visible != _visible && mounted) setState(() => _visible = visible);
      },
      child: Column(
        children: <Widget>[
          AspectRatio(
            aspectRatio: ratio,
            child: Listener(
              onPointerDown: (_) => _paused = true,
              onPointerUp: (_) => _paused = false,
              onPointerCancel: (_) => _paused = false,
              child: PageView.builder(
                controller: _controller,
                itemCount: widget.banners.length,
                padEnds: true,
                itemBuilder: (BuildContext context, int index) {
                  final PromoBanner banner = widget.banners[index];
                  final double delta = (_page - index).clamp(-1.0, 1.0);
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s1),
                    child: BannerImpressionTracker(
                      trackingKey: '${banner.id}-${widget.placement.value}',
                      onImpression: () => ref.read(bannerEventQueueProvider).recordImpression(
                            trackingToken: banner.trackingToken,
                            placement: banner.placement,
                          ),
                      child: Semantics(
                        button: banner.isTappable,
                        label: _semanticLabel(banner),
                        child: GestureDetector(
                          onTap: banner.isTappable
                              ? () => unawaited(BannerActionHandler.handle(context, ref, banner))
                              : null,
                          child: BannerCreativeView(banner: banner, parallax: delta),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          if (widget.banners.length > 1) ...<Widget>[
            const SizedBox(height: TamamSpacing.s3),
            _PageDots(count: widget.banners.length, index: _index),
          ],
        ],
      ),
    );
  }

  String _semanticLabel(PromoBanner banner) {
    final String language = Localizations.localeOf(context).languageCode;
    final String headline = banner.creative.headline?.resolve(language) ?? '';
    final String sub = banner.creative.subheadline?.resolve(language) ?? '';
    return <String>[headline, sub].where((String s) => s.isNotEmpty).join('. ');
  }
}

class _PageDots extends StatelessWidget {
  const _PageDots({required this.count, required this.index});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return ExcludeSemantics(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List<Widget>.generate(count, (int i) {
          final bool active = i == index;
          return AnimatedContainer(
            duration: TamamMotion.durationBase,
            margin: const EdgeInsets.symmetric(horizontal: 3),
            width: active ? 18 : 6,
            height: 6,
            decoration: BoxDecoration(
              color: active ? colors.primary : colors.borderStrong,
              borderRadius: BorderRadius.circular(TamamRadius.pill),
            ),
          );
        }),
      ),
    );
  }
}
