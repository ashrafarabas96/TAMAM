import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/theme/banner_style.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/widgets/skeleton_box.dart';
import 'package:tamam_customer/features/banners/domain/banner.dart';
import 'package:tamam_customer/features/banners/presentation/banner_providers.dart';
import 'package:tamam_customer/features/banners/presentation/widgets/hero_banner_carousel.dart';
import 'package:tamam_customer/features/banners/presentation/widgets/inline_banner.dart';

/// Drops the right banner treatment into any screen with one line.
///
/// The placement decides the layout (carousel / stack / single) and the aspect
/// ratio, both read from the design tokens, so adding a placement server-side
/// needs no layout code here.
///
/// Banners are never load-bearing: while the feed is loading a skeleton of the
/// correct height keeps the layout stable, and an empty or failed feed collapses
/// to nothing.
class PlacementBanner extends ConsumerWidget {
  const PlacementBanner({
    required this.placement,
    super.key,
    this.padding = EdgeInsets.zero,
    this.dismissible = false,
  });

  final BannerPlacement placement;
  final EdgeInsetsGeometry padding;
  final bool dismissible;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<BannerFeed> feed = ref.watch(bannerFeedProvider(placement));
    final BannerStyle style = BannerStyle.forPlacement(placement);

    return feed.when(
      skipLoadingOnRefresh: true,
      loading: () => Padding(
        padding: padding,
        child: _BannerSkeleton(style: style),
      ),
      error: (Object _, StackTrace __) => const SizedBox.shrink(),
      data: (BannerFeed data) {
        if (data.isEmpty) return const SizedBox.shrink();
        final List<PromoBanner> banners = data.banners.take(style.maxItems).toList(growable: false);
        return Padding(
          padding: padding,
          child: _layout(banners, style),
        );
      },
    );
  }

  Widget _layout(List<PromoBanner> banners, BannerStyle style) {
    if (style.isCarousel && banners.length > 1) {
      return HeroBannerCarousel(
        banners: banners,
        placement: placement,
        aspectRatio: style.aspectRatio,
        autoplay: style.autoplay,
      );
    }
    if (banners.length == 1 || style.style == 'single') {
      return InlineBanner(
        banner: banners.first,
        aspectRatio: style.aspectRatio,
        dismissible: dismissible,
      );
    }
    return Column(
      children: <Widget>[
        for (int i = 0; i < banners.length; i++) ...<Widget>[
          if (i > 0) const SizedBox(height: TamamSpacing.s3),
          InlineBanner(
            banner: banners[i],
            aspectRatio: style.aspectRatio,
            dismissible: dismissible,
          ),
        ],
      ],
    );
  }
}

class _BannerSkeleton extends StatelessWidget {
  const _BannerSkeleton({required this.style});

  final BannerStyle style;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s4),
        child: AspectRatio(
          aspectRatio: style.aspectRatio,
          child: const SkeletonBox(height: double.infinity, radius: TamamRadius.banner),
        ),
      );
}
