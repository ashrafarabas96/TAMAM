import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/offline_banner.dart';
import 'package:tamam_customer/core/widgets/section_header.dart';
import 'package:tamam_customer/core/widgets/skeleton_box.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/banners/presentation/banner_providers.dart';
import 'package:tamam_customer/features/banners/presentation/widgets/placement_banner.dart';
import 'package:tamam_customer/features/catalog/domain/catalog.dart';
import 'package:tamam_customer/features/catalog/presentation/catalog_providers.dart';
import 'package:tamam_customer/features/home/presentation/widgets/home_header.dart';
import 'package:tamam_customer/features/home/presentation/widgets/service_tile.dart';
import 'package:tamam_customer/features/jobs/data/jobs_repository.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/presentation/job_providers.dart';
import 'package:tamam_customer/features/jobs/presentation/widgets/job_card.dart';
import 'package:tamam_customer/features/notifications/presentation/notification_providers.dart';
import 'package:tamam_customer/features/places/domain/saved_place.dart';
import 'package:tamam_customer/features/places/presentation/address_sheet.dart';
import 'package:tamam_customer/features/places/presentation/place_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// The home canvas: purple header, hero banners, the four services, popular
/// categories, an inline banner, recent orders, saved places and offers.
///
/// Everything below the header is independently loadable, so one slow section
/// never blocks the rest — and every section has its own empty/skeleton state.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final int unread = ref.watch(unreadNotificationsProvider).valueOrNull ?? 0;
    final List<Job> activeJobs = ref.watch(activeJobsProvider).valueOrNull ?? const <Job>[];

    return Scaffold(
      backgroundColor: colors.background,
      body: Column(
        children: <Widget>[
          HomeHeader(
            unreadCount: unread,
            onPickAddress: () => unawaited(AddressSheet.show(context, ref)),
          ),
          const OfflineBanner(),
          Expanded(
            child: RefreshIndicator(
              color: colors.primary,
              onRefresh: () => _refreshAll(ref),
              child: ListView(
                padding: const EdgeInsets.only(bottom: TamamSpacing.s8),
                children: <Widget>[
                  if (activeJobs.isNotEmpty)
                    ActiveJobBanner(
                      job: activeJobs.first,
                      onTap: () => context.push(Routes.job(activeJobs.first.id)),
                    ),
                  const SizedBox(height: TamamSpacing.s4),
                  const PlacementBanner(placement: BannerPlacement.homeHero),
                  const SizedBox(height: TamamSpacing.s5),
                  const _ServicesGrid(),
                  const _PopularCategories(),
                  const SizedBox(height: TamamSpacing.s4),
                  const PlacementBanner(placement: BannerPlacement.homeInline),
                  const _RecentOrders(),
                  const _SavedPlacesStrip(),
                  _OffersTeaser(l10n: l10n),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _refreshAll(WidgetRef ref) async {
    ref
      ..invalidate(activeJobsProvider)
      ..invalidate(serviceTypesProvider)
      ..invalidate(categoriesProvider(JobType.homeService))
      ..invalidate(savedPlacesProvider)
      ..invalidate(unreadNotificationsProvider)
      ..invalidate(ordersProvider(JobStatusGroup.all));
    await ref.read(bannerFeedProvider(BannerPlacement.homeHero).notifier).refresh();
    await ref.read(bannerFeedProvider(BannerPlacement.homeInline).notifier).refresh();
  }
}

/// The 2×2 grid of the four services.
class _ServicesGrid extends ConsumerWidget {
  const _ServicesGrid();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s4),
      child: Column(
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: ServiceTile(
                  title: l10n.serviceRide,
                  caption: l10n.serviceRideCaption,
                  icon: Icons.local_taxi_rounded,
                  color: TamamServiceColors.ride,
                  onTap: () => context.push(Routes.ride),
                ),
              ),
              const SizedBox(width: TamamSpacing.s3),
              Expanded(
                child: ServiceTile(
                  title: l10n.serviceDelivery,
                  caption: l10n.serviceDeliveryCaption,
                  icon: Icons.inventory_2_rounded,
                  color: TamamServiceColors.delivery,
                  onTap: () => context.push(Routes.delivery),
                ),
              ),
            ],
          ),
          const SizedBox(height: TamamSpacing.s3),
          Row(
            children: <Widget>[
              Expanded(
                child: ServiceTile(
                  title: l10n.serviceHome,
                  caption: l10n.serviceHomeCaption,
                  icon: Icons.handyman_rounded,
                  color: TamamServiceColors.homeService,
                  onTap: () => context.push(Routes.search),
                ),
              ),
              const SizedBox(width: TamamSpacing.s3),
              Expanded(
                child: ServiceTile(
                  title: l10n.serviceChalet,
                  caption: l10n.serviceChaletCaption,
                  icon: Icons.holiday_village_rounded,
                  color: TamamServiceColors.chalet,
                  onTap: () => context.push(Routes.chalets),
                ),
              ),
            ],
          ),
          const SizedBox(height: TamamSpacing.s3),
          // Urgent is a way of asking for a service rather than a service, so
          // it sits on its own row. It is also what keeps the count even: five
          // tiles in two columns would leave a hole in the last row.
          ServiceTile(
            title: l10n.serviceUrgent,
            caption: l10n.serviceUrgentCaption,
            icon: Icons.bolt_rounded,
            color: TamamServiceColors.urgent,
            enabled: ref.watch(featureFlagsValueProvider).hasUrgentServices,
            onTap: () => context.push('${Routes.search}?urgent=1'),
          ),
        ],
      ),
    );
  }
}

/// "الأكثر طلبًا" — featured home-service categories.
class _PopularCategories extends ConsumerWidget {
  const _PopularCategories();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final String language = ref.watch(localeControllerProvider).languageCode;
    final AsyncValue<List<ServiceCategory>> categories =
        ref.watch(categoriesProvider(JobType.homeService));

    return categories.when(
      skipLoadingOnRefresh: true,
      loading: () => Column(
        children: <Widget>[
          SectionHeader(title: l10n.homePopular),
          HorizontalCarousel(
            height: 108,
            itemCount: 4,
            itemBuilder: (BuildContext _, int __) => const SkeletonBox(
              width: 120,
              height: 108,
              radius: TamamRadius.card,
            ),
          ),
        ],
      ),
      error: (Object _, StackTrace __) => const SizedBox.shrink(),
      data: (List<ServiceCategory> all) {
        final List<ServiceCategory> featured = <ServiceCategory>[
          ...all.where((ServiceCategory c) => c.isFeatured),
          ...all.where((ServiceCategory c) => !c.isFeatured),
        ].take(10).toList(growable: false);
        if (featured.isEmpty) return const SizedBox.shrink();

        return Column(
          children: <Widget>[
            SectionHeader(
              title: l10n.homePopular,
              actionLabel: l10n.actionSeeAll,
              onAction: () => context.push(Routes.search),
            ),
            HorizontalCarousel(
              height: 112,
              itemCount: featured.length,
              itemBuilder: (BuildContext context, int index) {
                final ServiceCategory category = featured[index];
                return SizedBox(
                  width: 116,
                  child: TamamCard(
                    padding: const EdgeInsets.all(TamamSpacing.s3),
                    onTap: () => context.push(Routes.category(category.id)),
                    semanticLabel: category.name.resolve(language),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: <Widget>[
                        Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: category.color.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(TamamRadius.sm),
                          ),
                          child: Icon(
                            Icons.build_circle_outlined,
                            size: TamamSize.iconMd,
                            color: category.color,
                          ),
                        ),
                        Text(
                          category.name.resolve(language),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TamamType.labelMd.toTextStyle(color: context.colors.textPrimary),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        );
      },
    );
  }
}

/// "طلباتك الأخيرة" — the three most recent orders.
class _RecentOrders extends ConsumerWidget {
  const _RecentOrders();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final AsyncValue<OrdersPage> recent = ref.watch(ordersProvider(JobStatusGroup.all));

    return recent.when(
      skipLoadingOnRefresh: true,
      loading: () => Padding(
        padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s4),
        child: Column(
          children: <Widget>[
            SectionHeader(title: l10n.homeRecentOrders, padding: EdgeInsets.zero),
            const SkeletonList(itemCount: 2),
          ],
        ),
      ),
      error: (Object _, StackTrace __) => const SizedBox.shrink(),
      data: (OrdersPage page) {
        if (page.jobs.isEmpty) return const SizedBox.shrink();
        final List<Job> latest = page.jobs.take(3).toList(growable: false);
        return Column(
          children: <Widget>[
            SectionHeader(
              title: l10n.homeRecentOrders,
              actionLabel: l10n.actionSeeAll,
              onAction: () => context.go(Routes.orders),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s4),
              child: Column(
                children: latest
                    .map(
                      (Job job) => JobCard(
                        job: job,
                        onTap: () => context.push(Routes.job(job.id)),
                      ),
                    )
                    .toList(growable: false),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// "الأماكن المفضلة" — one-tap addresses.
class _SavedPlacesStrip extends ConsumerWidget {
  const _SavedPlacesStrip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final List<SavedPlace> places = ref.watch(savedPlacesProvider).valueOrNull ?? const <SavedPlace>[];

    return Column(
      children: <Widget>[
        SectionHeader(
          title: l10n.homeSavedPlaces,
          actionLabel: l10n.actionManage,
          onAction: () => context.push(Routes.savedPlaces),
        ),
        if (places.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s4),
            child: TamamCard(
              onTap: () => context.push(Routes.savedPlaces),
              child: Row(
                children: <Widget>[
                  Icon(Icons.add_location_alt_outlined, color: context.colors.primary),
                  const SizedBox(width: TamamSpacing.s3),
                  Expanded(
                    child: Text(
                      l10n.homeAddPlace,
                      style: TamamType.bodyMd.toTextStyle(color: context.colors.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
          )
        else
          HorizontalCarousel(
            height: 44,
            itemCount: places.length,
            itemBuilder: (BuildContext context, int index) {
              final SavedPlace place = places[index];
              return ActionChip(
                avatar: Icon(
                  _placeIcon(place.kind),
                  size: TamamSize.iconSm,
                  color: context.colors.primary,
                ),
                label: Text(place.label),
                onPressed: () => unawaited(
                  ref.read(currentAddressProvider.notifier).select(place.address),
                ),
              );
            },
          ),
      ],
    );
  }

  IconData _placeIcon(SavedPlaceKind kind) {
    switch (kind) {
      case SavedPlaceKind.home:
        return Icons.home_rounded;
      case SavedPlaceKind.work:
        return Icons.work_rounded;
      case SavedPlaceKind.custom:
        return Icons.place_rounded;
    }
  }
}

/// "العروض" — the promo-codes teaser.
class _OffersTeaser extends StatelessWidget {
  const _OffersTeaser({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Column(
      children: <Widget>[
        SectionHeader(title: l10n.homeOffers),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s4),
          child: TamamCard(
            onTap: () => context.push(Routes.promos),
            background: colors.surfaceBrandSoft,
            child: Row(
              children: <Widget>[
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: colors.accent,
                    borderRadius: BorderRadius.circular(TamamRadius.sm),
                  ),
                  child: Icon(Icons.local_offer_rounded, color: colors.textOnAccent),
                ),
                const SizedBox(width: TamamSpacing.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        l10n.homeOffersTitle,
                        style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                      ),
                      Text(
                        l10n.homeOffersBody,
                        style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
