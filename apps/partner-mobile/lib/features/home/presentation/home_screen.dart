import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/empty_state.dart';
import 'package:tamam_partner/core/widgets/offline_banner.dart';
import 'package:tamam_partner/core/widgets/skeleton_box.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';
import 'package:tamam_partner/features/account/presentation/partner_providers.dart';
import 'package:tamam_partner/features/banners/presentation/banner_providers.dart';
import 'package:tamam_partner/features/banners/presentation/widgets/placement_banner.dart';
import 'package:tamam_partner/features/earnings/domain/earnings.dart';
import 'package:tamam_partner/features/earnings/presentation/earnings_providers.dart';
import 'package:tamam_partner/features/home/presentation/availability_controller.dart';
import 'package:tamam_partner/features/home/presentation/widgets/home_cards.dart';
import 'package:tamam_partner/features/home/presentation/widgets/home_header.dart';
import 'package:tamam_partner/features/jobs/presentation/jobs_providers.dart';
import 'package:tamam_partner/features/notifications/presentation/notification_providers.dart';
import 'package:tamam_partner/features/offers/presentation/offers_controller.dart';
import 'package:tamam_partner/features/vehicles/presentation/vehicles_providers.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// The working home: availability toggle in the header, today's earnings,
/// warnings that would block a shift, stats, PARTNER_HOME banners and the
/// offers currently waiting for an answer.
///
/// Every block loads independently, so a slow earnings call never delays the
/// toggle — the one control a partner needs immediately.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final int unread = ref.watch(unreadNotificationsProvider).valueOrNull ?? 0;
    final AsyncValue<PartnerProfile> profile = ref.watch(partnerProfileProvider);
    final AvailabilityState availability = ref.watch(availabilityControllerProvider);

    return Scaffold(
      backgroundColor: colors.background,
      body: Column(
        children: <Widget>[
          HomeHeader(unreadCount: unread),
          const OfflineBanner(),
          Expanded(
            child: RefreshIndicator(
              color: colors.primary,
              onRefresh: () => _refresh(ref),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  TamamSpacing.s4,
                  TamamSpacing.s4,
                  TamamSpacing.s4,
                  TamamSpacing.s16,
                ),
                children: <Widget>[
                  const ResumeWorkCard(),
                  const InterruptionCard(),
                  const BackgroundLimitedBanner(),
                  const TodayEarningsCard(),
                  const SizedBox(height: TamamSpacing.s3),
                  profile.when(
                    skipLoadingOnRefresh: true,
                    loading: () => const Column(
                      children: <Widget>[
                        SkeletonBox(height: 74, radius: TamamRadius.card),
                        SizedBox(height: TamamSpacing.s3),
                        SkeletonBox(height: 56, radius: TamamRadius.card),
                      ],
                    ),
                    error: (Object error, StackTrace _) => EmptyState(
                      icon: Icons.person_off_outlined,
                      tone: EmptyStateTone.warning,
                      title: l10n.homeProfileUnavailable,
                      message: localizedFailure(l10n, asFailure(error)),
                      actionLabel: l10n.actionRetry,
                      onAction: () => ref.invalidate(partnerProfileProvider),
                    ),
                    data: (PartnerProfile data) => Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        WarningsCard(profile: data),
                        StatsRow(profile: data),
                        if (data.needsVehicle) ...<Widget>[
                          const SizedBox(height: TamamSpacing.s3),
                          const Align(alignment: AlignmentDirectional.centerStart, child: ActiveVehicleChip()),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: TamamSpacing.s4),
                  const PlacementBanner(placement: BannerPlacement.partnerHome),
                  const PendingOffersList(),
                  if (availability.loaded && !availability.isOnline && ref.watch(offersControllerProvider).isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: TamamSpacing.s6),
                      child: EmptyState(
                        icon: Icons.bolt_outlined,
                        title: l10n.homeOfflineEmptyTitle,
                        message: l10n.homeOfflineEmptyBody,
                      ),
                    )
                  else if (availability.isOnline && ref.watch(offersControllerProvider).isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: TamamSpacing.s6),
                      child: EmptyState(
                        icon: Icons.radar_rounded,
                        title: l10n.homeWaitingTitle,
                        message: l10n.homeWaitingBody,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _refresh(WidgetRef ref) async {
    ref
      ..invalidate(partnerProfileProvider)
      ..invalidate(earningsProvider(EarningsPeriod.today))
      ..invalidate(activeJobsProvider)
      ..invalidate(vehiclesProvider)
      ..invalidate(unreadNotificationsProvider);
    await ref.read(availabilityControllerProvider.notifier).load();
    await ref.read(offersControllerProvider.notifier).refresh();
    unawaited(ref.read(bannerFeedProvider(BannerPlacement.partnerHome).notifier).refresh());
  }
}
