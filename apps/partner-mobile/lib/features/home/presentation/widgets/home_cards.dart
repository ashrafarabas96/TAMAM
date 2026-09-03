import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/money_text.dart';
import 'package:tamam_partner/core/widgets/skeleton_box.dart';
import 'package:tamam_partner/core/widgets/stat_tile.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';
import 'package:tamam_partner/features/earnings/domain/earnings.dart';
import 'package:tamam_partner/features/earnings/presentation/earnings_providers.dart';
import 'package:tamam_partner/features/home/presentation/availability_controller.dart';
import 'package:tamam_partner/features/jobs/presentation/job_labels.dart';
import 'package:tamam_partner/features/location/presentation/work_session_controller.dart';
import 'package:tamam_partner/features/offers/domain/job_offer.dart';
import 'package:tamam_partner/features/offers/presentation/offer_sheet.dart';
import 'package:tamam_partner/features/offers/presentation/offers_controller.dart';
import 'package:tamam_partner/features/vehicles/domain/vehicle.dart';
import 'package:tamam_partner/features/vehicles/presentation/vehicles_providers.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Today's net earnings, with the balance and a shortcut to the earnings tab.
class TodayEarningsCard extends ConsumerWidget {
  const TodayEarningsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AsyncValue<PartnerEarnings> value = ref.watch(earningsProvider(EarningsPeriod.today));

    return TamamCard(
      onTap: () => context.go(Routes.earnings),
      child: value.when(
        skipLoadingOnRefresh: true,
        loading: () => const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            SkeletonBox(width: 120, height: 14),
            SizedBox(height: TamamSpacing.s2),
            SkeletonBox(width: 160, height: 32),
            SizedBox(height: TamamSpacing.s2),
            SkeletonBox(width: 200, height: 14),
          ],
        ),
        error: (Object error, StackTrace _) => Row(
          children: <Widget>[
            Icon(Icons.error_outline_rounded, color: colors.danger),
            const SizedBox(width: TamamSpacing.s2),
            Expanded(child: Text(localizedFailure(l10n, asFailure(error)), style: TamamType.bodySm.toTextStyle(color: colors.textSecondary))),
            TextButton(onPressed: () => ref.invalidate(earningsProvider(EarningsPeriod.today)), child: Text(l10n.actionRetry)),
          ],
        ),
        data: (PartnerEarnings earnings) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(child: Text(l10n.homeTodayEarnings, style: TamamType.labelMd.toTextStyle(color: colors.textSecondary))),
                Icon(Icons.chevron_right_rounded, color: colors.textTertiary),
              ],
            ),
            const SizedBox(height: TamamSpacing.s1),
            MoneyText(earnings.netEarnings, style: const TextStyle(fontSize: 30)),
            const SizedBox(height: TamamSpacing.s2),
            Row(
              children: <Widget>[
                _Mini(label: l10n.homeCompletedJobs, value: '${earnings.completedJobs}'),
                const SizedBox(width: TamamSpacing.s5),
                _Mini(label: l10n.earningsBalance, value: ref.watch(moneyFormatterProvider).formatCompact(earnings.currentBalance)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Mini extends StatelessWidget {
  const _Mini({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(value, textDirection: TextDirection.ltr, style: TamamType.headingSm.toTextStyle(color: colors.textPrimary)),
        Text(label, style: TamamType.labelSm.toTextStyle(color: colors.textTertiary)),
      ],
    );
  }
}

/// Rating · acceptance % · completed, from the profile.
class StatsRow extends ConsumerWidget {
  const StatsRow({required this.profile, super.key});

  final PartnerProfile profile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    final int acceptance = (profile.acceptanceRate * 100).round();
    return TamamCard(
      padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s2, vertical: TamamSpacing.s1),
      child: Row(
        children: <Widget>[
          Expanded(
            child: StatTile(
              icon: Icons.star_rounded,
              value: profile.rating.toStringAsFixed(1),
              label: l10n.statsRating,
              tone: TamamBrand.yellow600,
            ),
          ),
          Expanded(
            child: StatTile(
              icon: Icons.thumb_up_alt_rounded,
              value: '$acceptance%',
              label: l10n.statsAcceptance,
              tone: acceptance < 60 ? colors.warning : null,
            ),
          ),
          Expanded(
            child: StatTile(
              icon: Icons.task_alt_rounded,
              value: units.number(profile.completedJobs),
              label: l10n.statsCompleted,
            ),
          ),
        ],
      ),
    );
  }
}

/// Documents expiring / expired, rejected vehicle, no active vehicle.
class WarningsCard extends ConsumerWidget {
  const WarningsCard({required this.profile, super.key});

  final PartnerProfile profile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final List<PartnerDocument> blocking = profile.blockingDocuments;
    final List<PartnerDocument> expiring = profile.expiringDocuments;
    final List<Vehicle> vehicles = ref.watch(vehiclesProvider).valueOrNull ?? const <Vehicle>[];
    final bool needsVehicle = profile.needsVehicle && !vehicles.any((Vehicle v) => v.isActive && v.isApproved);
    if (blocking.isEmpty && expiring.isEmpty && !needsVehicle) return const SizedBox.shrink();

    return Column(
      children: <Widget>[
        for (final PartnerDocument doc in blocking)
          _WarningTile(
            color: colors.dangerSoft,
            foreground: TamamSemantic.dangerStrong,
            icon: Icons.gpp_bad_rounded,
            text: doc.isRejected
                ? l10n.warningDocumentRejected(JobLabels.documentType(l10n, doc.type))
                : l10n.warningDocumentExpired(JobLabels.documentType(l10n, doc.type)),
            onTap: () => context.push(Routes.documents),
          ),
        for (final PartnerDocument doc in expiring)
          _WarningTile(
            color: colors.warningSoft,
            foreground: TamamSemantic.warningStrong,
            icon: Icons.schedule_rounded,
            text: l10n.warningDocumentExpiring(JobLabels.documentType(l10n, doc.type), doc.daysUntilExpiry ?? 0),
            onTap: () => context.push(Routes.documents),
          ),
        if (needsVehicle)
          _WarningTile(
            color: colors.warningSoft,
            foreground: TamamSemantic.warningStrong,
            icon: Icons.directions_car_outlined,
            text: l10n.warningNoActiveVehicle,
            onTap: () => context.push(Routes.vehicles),
          ),
      ],
    );
  }
}

class _WarningTile extends StatelessWidget {
  const _WarningTile({
    required this.color,
    required this.foreground,
    required this.icon,
    required this.text,
    required this.onTap,
  });

  final Color color;
  final Color foreground;
  final IconData icon;
  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => TamamCard(
        margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
        background: color,
        elevated: false,
        onTap: onTap,
        padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s3, vertical: TamamSpacing.s3),
        child: Row(
          children: <Widget>[
            Icon(icon, color: foreground),
            const SizedBox(width: TamamSpacing.s2),
            Expanded(child: Text(text, style: TamamType.bodySm.toTextStyle(color: foreground))),
            Icon(Icons.chevron_right_rounded, color: foreground, size: TamamSize.iconSm),
          ],
        ),
      );
}

/// The vehicle the partner is working with, with a shortcut to switch.
class ActiveVehicleChip extends ConsumerWidget {
  const ActiveVehicleChip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final Vehicle? vehicle = ref.watch(activeVehicleProvider);
    if (vehicle == null) return const SizedBox.shrink();
    return ActionChip(
      avatar: Icon(Icons.directions_car_rounded, size: TamamSize.iconSm, color: colors.primary),
      label: Text('${vehicle.title} · ${vehicle.plate}', textDirection: TextDirection.ltr),
      tooltip: l10n.vehiclesTitle,
      onPressed: () => context.push(Routes.vehicles),
    );
  }
}

/// The partner was ONLINE when the app died or went to the background; the
/// server may still be offering jobs. Ask before restarting the pipeline.
class ResumeWorkCard extends ConsumerWidget {
  const ResumeWorkCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AvailabilityState state = ref.watch(availabilityControllerProvider);
    if (!state.needsResumeConfirmation) return const SizedBox.shrink();
    final AvailabilityController controller = ref.read(availabilityControllerProvider.notifier);
    return TamamCard(
      margin: const EdgeInsets.only(bottom: TamamSpacing.s3),
      background: colors.surfaceBrandSoft,
      elevated: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(l10n.resumeWorkTitle, style: TamamType.headingSm.toTextStyle(color: colors.textPrimary)),
          const SizedBox(height: TamamSpacing.s1),
          Text(l10n.resumeWorkBody, style: TamamType.bodySm.toTextStyle(color: colors.textSecondary)),
          const SizedBox(height: TamamSpacing.s3),
          Row(
            children: <Widget>[
              Expanded(
                child: TamamButton(
                  label: l10n.resumeWorkConfirm,
                  busy: state.busy,
                  onPressed: () => unawaited(controller.confirmResume()),
                ),
              ),
              const SizedBox(width: TamamSpacing.s2),
              Expanded(
                child: TamamButton(
                  label: l10n.resumeWorkDecline,
                  variant: TamamButtonVariant.outline,
                  onPressed: state.busy ? null : () => unawaited(controller.declineResume()),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Explains an OFFLINE flip the partner did not ask for.
class InterruptionCard extends ConsumerWidget {
  const InterruptionCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AvailabilityState state = ref.watch(availabilityControllerProvider);
    final WorkSessionStopReason? reason = state.interruptedReason;
    if (reason == null) return const SizedBox.shrink();
    final AvailabilityController controller = ref.read(availabilityControllerProvider.notifier);
    final String text = switch (reason) {
      WorkSessionStopReason.permissionRevoked => l10n.interruptionPermission,
      WorkSessionStopReason.serviceDisabled => l10n.interruptionServiceDisabled,
      WorkSessionStopReason.serverOffline => l10n.interruptionServer,
      WorkSessionStopReason.sessionEnded || WorkSessionStopReason.user => l10n.interruptionGeneric,
    };
    final bool settings =
        reason == WorkSessionStopReason.permissionRevoked || reason == WorkSessionStopReason.serviceDisabled;
    return TamamCard(
      margin: const EdgeInsets.only(bottom: TamamSpacing.s3),
      background: colors.dangerSoft,
      elevated: false,
      child: Row(
        children: <Widget>[
          Icon(Icons.location_off_rounded, color: colors.danger),
          const SizedBox(width: TamamSpacing.s2),
          Expanded(child: Text(text, style: TamamType.bodySm.toTextStyle(color: TamamSemantic.dangerStrong))),
          if (settings)
            TextButton(
              onPressed: () => unawaited(
                reason == WorkSessionStopReason.serviceDisabled
                    ? controller.openDeviceLocationSettings()
                    : controller.openLocationSettings(),
              ),
              child: Text(l10n.actionOpenSettings),
            ),
          IconButton(onPressed: controller.dismissInterruption, icon: const Icon(Icons.close_rounded), tooltip: l10n.actionDismiss),
        ],
      ),
    );
  }
}

/// "Only while in use" permission: uploads pause when the app leaves the screen.
class BackgroundLimitedBanner extends ConsumerWidget {
  const BackgroundLimitedBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AvailabilityState state = ref.watch(availabilityControllerProvider);
    if (!state.isOnline || !state.backgroundLimited) return const SizedBox.shrink();
    return TamamCard(
      margin: const EdgeInsets.only(bottom: TamamSpacing.s3),
      background: colors.warningSoft,
      elevated: false,
      onTap: () => unawaited(ref.read(availabilityControllerProvider.notifier).openLocationSettings()),
      child: Row(
        children: <Widget>[
          Icon(Icons.visibility_rounded, color: colors.warning),
          const SizedBox(width: TamamSpacing.s2),
          Expanded(child: Text(l10n.backgroundLimitedBanner, style: TamamType.bodySm.toTextStyle(color: TamamSemantic.warningStrong))),
          Text(l10n.actionOpenSettings, style: TamamType.labelSm.toTextStyle(color: TamamSemantic.warningStrong)),
        ],
      ),
    );
  }
}

/// Pending offers (REST view), each tappable to open the offer sheet.
class PendingOffersList extends ConsumerWidget {
  const PendingOffersList({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final OfferQueue queue = ref.watch(offersControllerProvider);
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    if (queue.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(TamamSpacing.s1, TamamSpacing.s4, TamamSpacing.s1, TamamSpacing.s2),
          child: Text(l10n.homePendingOffers(queue.length), style: TamamType.headingMd.toTextStyle(color: colors.textPrimary)),
        ),
        for (final JobOffer offer in queue.offers)
          TamamCard(
            margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
            onTap: () => unawaited(OfferSheet.show(context)),
            child: Row(
              children: <Widget>[
                Icon(JobLabels.typeIcon(offer.job.type), color: JobLabels.typeColor(offer.job.type)),
                const SizedBox(width: TamamSpacing.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(JobLabels.type(l10n, offer.job.type), style: TamamType.headingSm.toTextStyle(color: colors.textPrimary)),
                      Text(
                        offer.job.pickup?.address.formatted ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: <Widget>[
                    MoneyText(offer.estimatedEarnings, emphasis: MoneyEmphasis.medium, color: TamamBrand.yellow700),
                    StatusPill(
                      label: l10n.durationMin(units.minutesValue(offer.etaToPickupSeconds)),
                      tone: PillTone.brand,
                      dense: true,
                    ),
                  ],
                ),
              ],
            ),
          ),
      ],
    );
  }
}
