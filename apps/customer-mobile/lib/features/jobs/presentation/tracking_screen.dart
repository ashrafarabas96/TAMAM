import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:share_plus/share_plus.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/format/unit_formatter.dart';
import 'package:tamam_customer/core/maps/location_service.dart';
import 'package:tamam_customer/core/maps/map_view.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/core/widgets/async_view.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/banners/presentation/widgets/placement_banner.dart';
import 'package:tamam_customer/features/jobs/data/jobs_repository.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/domain/quote.dart';
import 'package:tamam_customer/features/jobs/presentation/job_providers.dart';
import 'package:tamam_customer/features/jobs/presentation/job_tracking_controller.dart';
import 'package:tamam_customer/features/jobs/presentation/widgets/cancel_sheet.dart';
import 'package:tamam_customer/features/jobs/presentation/widgets/fare_option_card.dart';
import 'package:tamam_customer/features/jobs/presentation/widgets/partner_card.dart';
import 'package:tamam_customer/features/jobs/presentation/widgets/quote_sheet.dart';
import 'package:tamam_customer/features/jobs/presentation/widgets/status_stepper.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Live job tracking: a map with the partner's position and a Getir-style sheet
/// carrying status, the partner card, PIN/OTP, safety actions and — for home
/// services — the quote and work-confirmation steps.
class TrackingScreen extends ConsumerStatefulWidget {
  const TrackingScreen({required this.jobId, super.key});

  final String jobId;

  @override
  ConsumerState<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends ConsumerState<TrackingScreen> {
  final MapController _map = MapController();
  bool _quotePrompted = false;

  @override
  void dispose() {
    _map.dispose();
    super.dispose();
  }

  /// Opens the quote sheet automatically the first time a decision is pending —
  /// the customer should not have to hunt for it.
  void _maybePromptQuote(Job job) {
    if (_quotePrompted || !job.awaitsQuoteDecision) return;
    final Quote? quote = job.activeQuote;
    if (quote == null) return;
    _quotePrompted = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(QuoteSheet.show(context, job: job, quote: quote));
    });
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final AsyncValue<JobTracking> tracking = ref.watch(jobTrackingProvider(widget.jobId));

    return Scaffold(
      backgroundColor: context.colors.background,
      appBar: AppBar(
        title: Text(l10n.trackingTitle),
        actions: <Widget>[
          IconButton(
            tooltip: l10n.trackingSupport,
            icon: const Icon(Icons.support_agent_rounded),
            onPressed: () => context.push(Routes.support),
          ),
        ],
      ),
      body: AsyncView<JobTracking>(
        value: tracking,
        onRetry: () => ref.invalidate(jobTrackingProvider(widget.jobId)),
        builder: (JobTracking data) {
          _maybePromptQuote(data.job);
          return _TrackingBody(tracking: data, map: _map);
        },
      ),
    );
  }
}

class _TrackingBody extends ConsumerWidget {
  const _TrackingBody({required this.tracking, required this.map});

  final JobTracking tracking;
  final MapController map;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final Job job = tracking.job;
    final GeoPoint? partnerPoint = tracking.live.location;
    final LatLng center = partnerPoint?.toLatLng() ??
        job.pickup?.address.toLatLng() ??
        LocationService.fallbackCenter.toLatLng();

    final bool showMap = job.type != JobType.homeService || job.isLive;

    return Column(
      children: <Widget>[
        if (showMap)
          Expanded(
            flex: 4,
            child: MapView(
              controller: map,
              tileUrlTemplate: ref.watch(appEnvProvider).mapTileUrlTemplate,
              attribution: ref.watch(appEnvProvider).mapAttribution,
              center: center,
              route: tracking.partnerPath.map((GeoPoint p) => p.toLatLng()).toList(growable: false),
              markers: <MapMarkerSpec>[
                if (job.pickup != null)
                  MapMarkerSpec(point: job.pickup!.address.toLatLng(), kind: MapMarkerKind.pickup),
                if (job.destination != null)
                  MapMarkerSpec(
                    point: job.destination!.address.toLatLng(),
                    kind: MapMarkerKind.destination,
                  ),
                if (partnerPoint != null)
                  MapMarkerSpec(
                    point: partnerPoint.toLatLng(),
                    kind: MapMarkerKind.partner,
                    headingDegrees: tracking.live.heading,
                  ),
              ],
            ),
          ),
        Expanded(
          flex: showMap ? 6 : 10,
          child: _TrackingSheet(tracking: tracking),
        ),
      ],
    );
  }
}

class _TrackingSheet extends ConsumerWidget {
  const _TrackingSheet({required this.tracking});

  final JobTracking tracking;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final Job job = tracking.job;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(TamamRadius.sheet)),
        boxShadow: TamamElevation.sheet,
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          TamamSpacing.s5,
          TamamSpacing.s5,
          TamamSpacing.s5,
          TamamSpacing.s6,
        ),
        children: <Widget>[
          JobStatusStepper(type: job.type, status: job.status),
          if (!tracking.realtime && job.isActive)
            Padding(
              padding: const EdgeInsets.only(top: TamamSpacing.s2),
              child: Text(
                l10n.trackingPollingFallback,
                style: TamamType.labelSm.toTextStyle(color: colors.textTertiary),
              ),
            ),
          const SizedBox(height: TamamSpacing.s4),
          _EtaRow(tracking: tracking),
          if (job.status == JobStatus.noPartnerAvailable) ...<Widget>[
            const SizedBox(height: TamamSpacing.s4),
            _NoPartnerCard(job: job),
          ],
          if (job.partner != null) ...<Widget>[
            const SizedBox(height: TamamSpacing.s4),
            TamamCard(
              child: PartnerCard(
                partner: job.partner!,
                chatEnabled: ref.watch(featureFlagsValueProvider).hasChat,
                onChat: () => context.push(Routes.jobChat(job.id)),
              ),
            ),
          ],
          if (job.awaitsQuoteDecision && job.activeQuote != null) ...<Widget>[
            const SizedBox(height: TamamSpacing.s4),
            _QuoteBanner(job: job, quote: job.activeQuote!),
          ],
          if (job.awaitsWorkConfirmation) ...<Widget>[
            const SizedBox(height: TamamSpacing.s4),
            _ConfirmWorkCard(job: job),
          ],
          if (job.tripPin != null && job.tripPinRequired) ...<Widget>[
            const SizedBox(height: TamamSpacing.s4),
            _CodeCard(title: l10n.trackingTripPin, code: job.tripPin!, hint: l10n.trackingTripPinHint),
          ],
          if (job.deliveryOtp != null && job.deliveryOtpRequired) ...<Widget>[
            const SizedBox(height: TamamSpacing.s4),
            _CodeCard(
              title: l10n.trackingDeliveryOtp,
              code: job.deliveryOtp!,
              hint: l10n.trackingDeliveryOtpHint,
            ),
          ],
          const SizedBox(height: TamamSpacing.s4),
          const PlacementBanner(
            placement: BannerPlacement.orderTracking,
            padding: EdgeInsets.symmetric(vertical: TamamSpacing.s2),
            dismissible: true,
          ),
          const SizedBox(height: TamamSpacing.s4),
          _StopsSummary(job: job),
          const SizedBox(height: TamamSpacing.s4),
          _PriceSummary(job: job),
          const SizedBox(height: TamamSpacing.s5),
          _Actions(job: job),
        ],
      ),
    );
  }
}

class _EtaRow extends ConsumerWidget {
  const _EtaRow({required this.tracking});

  final JobTracking tracking;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    final Job job = tracking.job;
    final int? eta = tracking.live.etaToPickupSeconds ?? tracking.live.etaToDestinationSeconds;

    if (eta == null || eta <= 0 || job.isTerminal) {
      return Text(
        job.isTerminal ? l10n.trackingFinished : l10n.trackingEtaUnknown,
        style: TamamType.bodyMd.toTextStyle(color: context.colors.textSecondary),
      );
    }

    return Row(
      children: <Widget>[
        Icon(Icons.schedule_rounded, size: TamamSize.iconMd, color: context.colors.primary),
        const SizedBox(width: TamamSpacing.s2),
        Text(
          l10n.trackingEta(units.minutesValue(eta)),
          style: TamamType.headingSm.toTextStyle(color: context.colors.textPrimary),
        ),
      ],
    );
  }
}

class _NoPartnerCard extends ConsumerStatefulWidget {
  const _NoPartnerCard({required this.job});

  final Job job;

  @override
  ConsumerState<_NoPartnerCard> createState() => _NoPartnerCardState();
}

class _NoPartnerCardState extends ConsumerState<_NoPartnerCard> {
  bool _busy = false;

  Future<void> _retry() async {
    setState(() => _busy = true);
    try {
      await ref.read(jobsRepositoryProvider).retryDispatch(widget.job.id);
      await ref.read(jobTrackingProvider(widget.job.id).notifier).reload();
    } on Object catch (error) {
      if (mounted) AppFeedback.showFailure(context, asFailure(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return TamamCard(
      background: context.colors.warningSoft,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            l10n.trackingNoPartnerTitle,
            style: TamamType.headingSm.toTextStyle(color: TamamSemantic.warningStrong),
          ),
          const SizedBox(height: TamamSpacing.s1),
          Text(
            l10n.trackingNoPartnerBody,
            style: TamamType.bodySm.toTextStyle(color: TamamSemantic.warningStrong),
          ),
          const SizedBox(height: TamamSpacing.s3),
          TamamButton(
            label: l10n.trackingRetryDispatch,
            busy: _busy,
            onPressed: () => unawaited(_retry()),
          ),
        ],
      ),
    );
  }
}

class _QuoteBanner extends StatelessWidget {
  const _QuoteBanner({required this.job, required this.quote});

  final Job job;
  final Quote quote;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return TamamCard(
      background: context.colors.surfaceBrandSoft,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  quote.isChangeOrder ? l10n.quoteChangeOrderTitle : l10n.quoteReadyTitle,
                  style: TamamType.headingSm.toTextStyle(color: context.colors.primary),
                ),
              ),
              MoneyText(quote.total, emphasis: MoneyEmphasis.medium),
            ],
          ),
          const SizedBox(height: TamamSpacing.s3),
          TamamButton(
            label: l10n.quoteReview,
            onPressed: () => unawaited(QuoteSheet.show(context, job: job, quote: quote)),
          ),
        ],
      ),
    );
  }
}

class _ConfirmWorkCard extends ConsumerStatefulWidget {
  const _ConfirmWorkCard({required this.job});

  final Job job;

  @override
  ConsumerState<_ConfirmWorkCard> createState() => _ConfirmWorkCardState();
}

class _ConfirmWorkCardState extends ConsumerState<_ConfirmWorkCard> {
  bool _busy = false;

  Future<void> _confirm() async {
    final AppLocalizations l10n = context.l10n;
    final bool ok = await AppFeedback.confirm(
      context,
      title: l10n.workConfirmTitle,
      message: l10n.workConfirmBody,
      confirmLabel: l10n.workConfirmCta,
    );
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(jobsRepositoryProvider).confirmWork(
            widget.job.id,
            version: widget.job.version,
          );
      await ref.read(jobTrackingProvider(widget.job.id).notifier).reload();
    } on Object catch (error) {
      if (mounted) AppFeedback.showFailure(context, asFailure(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return TamamCard(
      background: context.colors.successSoft,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            l10n.workCompletedTitle,
            style: TamamType.headingSm.toTextStyle(color: TamamSemantic.successStrong),
          ),
          const SizedBox(height: TamamSpacing.s1),
          Text(
            l10n.workCompletedBody,
            style: TamamType.bodySm.toTextStyle(color: TamamSemantic.successStrong),
          ),
          const SizedBox(height: TamamSpacing.s3),
          TamamButton(
            label: l10n.workConfirmCta,
            busy: _busy,
            onPressed: () => unawaited(_confirm()),
          ),
        ],
      ),
    );
  }
}

/// Trip PIN / delivery OTP, drawn large so it can be read at arm's length.
class _CodeCard extends StatelessWidget {
  const _CodeCard({required this.title, required this.code, required this.hint});

  final String title;
  final String code;
  final String hint;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return TamamCard(
      background: colors.surfaceBrand,
      child: Column(
        children: <Widget>[
          Text(
            title,
            style: TamamType.labelMd.toTextStyle(color: TamamBrand.purple100),
          ),
          const SizedBox(height: TamamSpacing.s1),
          Text(
            code,
            textDirection: TextDirection.ltr,
            style: TamamType.displayLg.toTextStyle(color: colors.accent).copyWith(letterSpacing: 8),
          ),
          Text(
            hint,
            textAlign: TextAlign.center,
            style: TamamType.bodySm.toTextStyle(color: TamamBrand.purple100),
          ),
        ],
      ),
    );
  }
}

class _StopsSummary extends StatelessWidget {
  const _StopsSummary({required this.job});

  final Job job;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    if (job.stops.isEmpty) return const SizedBox.shrink();
    return TamamCard(
      elevated: false,
      background: colors.surfaceAlt,
      child: Column(
        children: <Widget>[
          for (final JobStop stop in job.stops)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: TamamSpacing.s1),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Icon(
                    stop.kind == JobStopKind.dropoff ? Icons.place_rounded : Icons.trip_origin_rounded,
                    size: TamamSize.iconMd,
                    color: stop.kind == JobStopKind.dropoff ? colors.mapDestination : colors.mapPickup,
                  ),
                  const SizedBox(width: TamamSpacing.s3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          stop.address.formatted,
                          style: TamamType.bodyMd.toTextStyle(color: colors.textPrimary),
                        ),
                        if (stop.address.detailLine != null)
                          Text(
                            stop.address.detailLine!,
                            style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _PriceSummary extends StatelessWidget {
  const _PriceSummary({required this.job});

  final Job job;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    if (job.breakdown.isEmpty && job.displayTotal == null) return const SizedBox.shrink();
    return TamamCard(
      elevated: false,
      background: context.colors.surfaceAlt,
      child: FareBreakdownList(
        lines: job.breakdown,
        total: job.displayTotal == null
            ? null
            : Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      job.finalTotal != null ? l10n.checkoutTotal : l10n.trackingEstimatedTotal,
                      style: TamamType.headingSm.toTextStyle(color: context.colors.textPrimary),
                    ),
                  ),
                  MoneyText(job.displayTotal!),
                ],
              ),
      ),
    );
  }
}

class _Actions extends ConsumerWidget {
  const _Actions({required this.job});

  final Job job;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final bool canShare = ref.watch(featureFlagsValueProvider).hasShareTrip && job.isLive;
    final bool canSos = ref.watch(featureFlagsValueProvider).hasSos && job.isLive;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (job.canRate) ...<Widget>[
          TamamButton(
            label: l10n.ratingCta,
            onPressed: () => context.push(Routes.jobRating(job.id)),
          ),
          const SizedBox(height: TamamSpacing.s2),
          TamamButton(
            label: l10n.receiptCta,
            variant: TamamButtonVariant.outline,
            onPressed: () => context.push(Routes.jobReceipt(job.id)),
          ),
          const SizedBox(height: TamamSpacing.s2),
        ],
        Row(
          children: <Widget>[
            if (canShare)
              Expanded(
                child: _ActionTile(
                  icon: Icons.ios_share_rounded,
                  label: l10n.trackingShare,
                  onTap: () => unawaited(_share(context, ref)),
                ),
              ),
            if (canSos) ...<Widget>[
              if (canShare) const SizedBox(width: TamamSpacing.s2),
              Expanded(
                child: _ActionTile(
                  icon: Icons.emergency_share_rounded,
                  label: l10n.trackingSos,
                  danger: true,
                  onTap: () => unawaited(_sos(context, ref)),
                ),
              ),
            ],
            if (job.isTerminal) ...<Widget>[
              if (canShare || canSos) const SizedBox(width: TamamSpacing.s2),
              Expanded(
                child: _ActionTile(
                  icon: Icons.gavel_rounded,
                  label: l10n.disputeOpen,
                  onTap: () => context.push(Routes.jobDispute(job.id)),
                ),
              ),
            ],
          ],
        ),
        if (job.canCancel) ...<Widget>[
          const SizedBox(height: TamamSpacing.s3),
          TamamButton(
            label: l10n.cancelTitle,
            variant: TamamButtonVariant.ghost,
            onPressed: () => unawaited(CancelJobSheet.show(context, job: job)),
          ),
        ],
      ],
    );
  }

  Future<void> _share(BuildContext context, WidgetRef ref) async {
    final AppLocalizations l10n = context.l10n;
    try {
      final ShareLink link = await ref.read(jobsRepositoryProvider).share(job.id);
      await Share.share(l10n.trackingShareMessage(link.url), subject: l10n.trackingShare);
    } on Object catch (error) {
      if (context.mounted) AppFeedback.showFailure(context, asFailure(error));
    }
  }

  Future<void> _sos(BuildContext context, WidgetRef ref) async {
    final AppLocalizations l10n = context.l10n;
    final bool confirmed = await AppFeedback.confirm(
      context,
      title: l10n.sosTitle,
      message: l10n.sosBody,
      confirmLabel: l10n.sosConfirm,
      destructive: true,
    );
    if (!confirmed) return;
    final GeoPoint point = await ref.read(locationServiceProvider).current() ??
        job.pickup?.address.point ??
        LocationService.fallbackCenter;
    try {
      await ref.read(jobsRepositoryProvider).sos(job.id, location: point);
      if (context.mounted) {
        AppFeedback.showMessage(context, l10n.sosSent, icon: Icons.check_circle_rounded);
      }
    } on Object catch (error) {
      if (context.mounted) AppFeedback.showFailure(context, asFailure(error));
    }
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.danger = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final Color tint = danger ? colors.danger : colors.primary;
    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(TamamRadius.md),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: TamamSpacing.s3),
          decoration: BoxDecoration(
            color: danger ? colors.dangerSoft : colors.surfaceBrandSoft,
            borderRadius: BorderRadius.circular(TamamRadius.md),
          ),
          child: Column(
            children: <Widget>[
              Icon(icon, color: tint, size: TamamSize.iconMd),
              const SizedBox(height: 2),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TamamType.labelSm.toTextStyle(color: tint),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
