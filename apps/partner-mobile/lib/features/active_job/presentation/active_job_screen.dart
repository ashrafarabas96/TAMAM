import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/env/app_env.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/maps/location_service.dart';
import 'package:tamam_partner/core/maps/map_view.dart';
import 'package:tamam_partner/core/maps/navigation_launcher.dart';
import 'package:tamam_partner/core/maps/polyline_codec.dart';
import 'package:tamam_partner/core/models/geo.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/sheet_scaffold.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/active_job/domain/job_action.dart';
import 'package:tamam_partner/features/active_job/presentation/active_job_controller.dart';
import 'package:tamam_partner/features/active_job/presentation/widgets/cancel_job_sheet.dart';
import 'package:tamam_partner/features/active_job/presentation/widgets/completion_sheets.dart';
import 'package:tamam_partner/features/active_job/presentation/widgets/customer_card.dart';
import 'package:tamam_partner/features/active_job/presentation/widgets/proof_of_delivery_sheet.dart';
import 'package:tamam_partner/features/active_job/presentation/widgets/start_code_sheet.dart';
import 'package:tamam_partner/features/jobs/data/jobs_repository.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/jobs/presentation/job_labels.dart';
import 'package:tamam_partner/features/location/presentation/location_providers.dart';
import 'package:tamam_partner/features/location/presentation/work_session_controller.dart';
import 'package:tamam_partner/features/quotes/presentation/widgets/quote_summary_card.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// The working screen: map on top, status-driven action panel below.
///
/// One primary button at a time (see `JobActions.primaryFor`); everything
/// else — navigate, chat, call, cancel, release, pause for parts, change
/// order — is secondary and only shown when the status allows it.
class ActiveJobScreen extends ConsumerStatefulWidget {
  const ActiveJobScreen({required this.jobId, super.key});

  final String jobId;

  @override
  ConsumerState<ActiveJobScreen> createState() => _ActiveJobScreenState();
}

class _ActiveJobScreenState extends ConsumerState<ActiveJobScreen> {
  final MapController _map = MapController();
  bool _fitted = false;
  Future<bool> Function()? _lastAction;

  @override
  void dispose() {
    _map.dispose();
    super.dispose();
  }

  ActiveJobController get _controller => ref.read(activeJobProvider(widget.jobId).notifier);

  Future<void> _perform(Future<bool> Function() action) async {
    _lastAction = action;
    await action();
  }

  Future<void> _onPrimary(PartnerJobAction action, Job job) async {
    final AppLocalizations l10n = context.l10n;
    switch (action) {
      case PartnerJobAction.goEnRoute:
        await _perform(_controller.goEnRoute);
      case PartnerJobAction.arrive:
        await _perform(_controller.arrive);
      case PartnerJobAction.startRide:
      case PartnerJobAction.pickUpPackage:
        if (!JobActions.needsCode(action, job)) {
          await _perform(_controller.start);
          return;
        }
        await _askCodeAndStart(job, action);
      case PartnerJobAction.startInspection:
        await _perform(_controller.start);
      case PartnerJobAction.completeRide:
        final bool confirmed = await AppFeedback.confirm(
          context,
          title: l10n.jobActionCompleteRide,
          message: l10n.completeRideConfirm,
          confirmLabel: l10n.jobActionCompleteRide,
        );
        if (confirmed) await _perform(_controller.complete);
      case PartnerJobAction.deliverPackage:
        await _askProofAndComplete(job);
      case PartnerJobAction.submitQuote:
        if (mounted) await context.push(Routes.quoteBuilder(job.id));
      case PartnerJobAction.startWork:
        await _perform(_controller.startWork);
      case PartnerJobAction.completeWork:
        final bool confirmed = await CompleteWorkSheet.show(context, job: job);
        if (confirmed) await _perform(_controller.completeWork);
      case PartnerJobAction.resumeWork:
        await _perform(_controller.resumeWork);
      case PartnerJobAction.rateCustomer:
        if (mounted) context.push(Routes.rateCustomer(job.id));
      case PartnerJobAction.awaitQuoteDecision:
      case PartnerJobAction.awaitCustomerConfirmation:
      case PartnerJobAction.none:
        break;
    }
  }

  Future<void> _askCodeAndStart(Job job, PartnerJobAction action, {String? errorText}) async {
    final AppLocalizations l10n = context.l10n;
    final bool ride = action == PartnerJobAction.startRide;
    final String? code = await StartCodeSheet.show(
      context,
      title: ride ? l10n.tripPinTitle : l10n.pickupOtpTitle,
      subtitle: ride ? l10n.tripPinSubtitle : l10n.pickupOtpSubtitle,
      errorText: errorText,
    );
    if (code == null) return;
    await _perform(() => _controller.start(code: code));
    final AppFailure? failure = _lastFailure;
    if (failure != null &&
        mounted &&
        (failure.code == ErrorCode.tripPinInvalid || failure.code == ErrorCode.pickupOtpInvalid)) {
      _controller.clearFailure();
      await _askCodeAndStart(job, action, errorText: localizedFailure(l10n, failure));
    }
  }

  Future<void> _askProofAndComplete(Job job, {String? errorText}) async {
    final ProofOfDelivery? proof = await ProofOfDeliverySheet.show(context, job: job, errorText: errorText);
    if (proof == null) return;
    await _perform(() => _controller.complete(proof: proof));
    final AppFailure? failure = _lastFailure;
    if (failure != null && failure.code == ErrorCode.deliveryOtpInvalid && mounted) {
      _controller.clearFailure();
      await _askProofAndComplete(job, errorText: localizedFailure(context.l10n, failure));
    }
  }

  AppFailure? get _lastFailure => ref.read(activeJobProvider(widget.jobId)).valueOrNull?.failure;

  Future<void> _cancel(ActiveJobState state) async {
    final Job job = state.job;
    final bool arrived = job.hasArrived && !job.hasStarted;
    final AppFailure? previous = state.failure;
    final String? blocked = previous != null && previous.code == ErrorCode.invalidStateTransition ? previous.message : null;
    final CancelDecision? decision = await CancelJobSheet.show(context, arrived: arrived, noShowBlockedMessage: blocked);
    if (decision == null) return;
    await _perform(() => _controller.cancel(reason: decision.reason, reasonText: decision.text));
    final AppFailure? failure = _lastFailure;
    if (failure != null && failure.code == ErrorCode.invalidStateTransition && decision.reason.requiresWaitingTimeout && mounted) {
      // The server said "too early": reopen with the option greyed out and its message.
      await _cancel(ref.read(activeJobProvider(widget.jobId)).valueOrNull ?? state);
    }
  }

  Future<void> _release() async {
    final String? reason = await ReleaseJobSheet.show(context);
    if (reason == null) return;
    final bool ok = await _controller.release(reason: reason);
    if (ok && mounted) {
      AppFeedback.showMessage(context, context.l10n.releaseJobDone, icon: Icons.undo_rounded);
      context.go(Routes.home);
    }
  }

  Future<void> _navigate(Job job) async {
    final JobStop? target = job.currentTarget;
    if (target == null) return;
    final NavigationApp? app = await SheetScaffold.show<NavigationApp>(
      context,
      (BuildContext sheet) => SheetScaffold(
        title: sheet.l10n.navigateWith,
        scrollable: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            ListTile(
              leading: const Icon(Icons.map_rounded),
              title: Text(sheet.l10n.navigateGoogleMaps),
              onTap: () => Navigator.of(sheet).pop(NavigationApp.googleMaps),
            ),
            ListTile(
              leading: const Icon(Icons.alt_route_rounded),
              title: Text(sheet.l10n.navigateWaze),
              onTap: () => Navigator.of(sheet).pop(NavigationApp.waze),
            ),
          ],
        ),
      ),
    );
    if (app == null) return;
    final bool opened = await NavigationLauncher.open(target.point, app: app);
    if (!opened && mounted) {
      AppFeedback.showMessage(context, context.l10n.navigateUnavailable, icon: Icons.map_outlined);
    }
  }

  void _fitMap(Job job, GeoPoint? me) {
    if (_fitted) return;
    final List<LatLng> points = <LatLng>[
      if (me != null) me.toLatLng(),
      for (final JobStop stop in job.stops) stop.address.toLatLng(),
    ];
    if (points.isEmpty) return;
    _fitted = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      MapView.fitPoints(_map, points, padding: const EdgeInsets.fromLTRB(48, 96, 48, 48));
    });
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AsyncValue<ActiveJobState> value = ref.watch(activeJobProvider(widget.jobId));

    ref.listen<AsyncValue<ActiveJobState>>(activeJobProvider(widget.jobId), (AsyncValue<ActiveJobState>? _, AsyncValue<ActiveJobState> next) {
      final ActiveJobState? state = next.valueOrNull;
      if (state == null) return;
      if (state.justCompleted) {
        _controller.consumeCompleted();
        unawaited(CompletionSummarySheet.show(context, job: state.job));
      }
    });

    return Scaffold(
      backgroundColor: colors.background,
      body: AsyncView<ActiveJobState>(
        value: value,
        onRetry: () => ref.invalidate(activeJobProvider(widget.jobId)),
        builder: (ActiveJobState state) {
          final Job job = state.job;
          final PartnerJobAction action = JobActions.primaryFor(job);
          final JobSecondaryActions secondary = JobActions.secondaryFor(job);
          final WorkSessionState session = ref.watch(workSessionProvider);
          final GeoPoint? me = session.lastSample == null
              ? ref.watch(lastKnownPointProvider)
              : GeoPoint(lat: session.lastSample!.lat, lng: session.lastSample!.lng);
          _fitMap(job, me);

          return Column(
            children: <Widget>[
              Expanded(
                flex: 5,
                child: _JobMap(job: job, me: me, heading: session.lastSample?.heading, controller: _map, state: state),
              ),
              Expanded(
                flex: 6,
                child: _ActionPanel(
                  state: state,
                  action: action,
                  secondary: secondary,
                  onPrimary: () => unawaited(_onPrimary(action, job)),
                  onRetry: _lastAction == null ? null : () => unawaited(_perform(_lastAction!)),
                  onNavigate: () => unawaited(_navigate(job)),
                  onCancel: () => unawaited(_cancel(state)),
                  onRelease: () => unawaited(_release()),
                  onWaitingForParts: () => unawaited(_perform(_controller.waitingForParts)),
                  onChangeOrder: () => context.push('${Routes.quoteBuilder(job.id)}?kind=change'),
                  onDismissFailure: _controller.clearFailure,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _JobMap extends ConsumerWidget {
  const _JobMap({
    required this.job,
    required this.me,
    required this.heading,
    required this.controller,
    required this.state,
  });

  final Job job;
  final GeoPoint? me;
  final double? heading;
  final MapController controller;
  final ActiveJobState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AppEnv env = ref.watch(appEnvProvider);
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    final JobStop? pickup = job.pickup;
    final JobStop? destination = job.destination;
    final int? eta = job.hasStarted ? state.etaDestination : state.etaPickup;

    return Stack(
      children: <Widget>[
        MapView(
          controller: controller,
          tileUrlTemplate: env.mapTileUrlTemplate,
          attribution: env.mapAttribution,
          center: (me ?? pickup?.point ?? LocationService.fallbackCenter).toLatLng(),
          zoom: 14,
          route: PolylineCodec.decode(job.routePolyline),
          markers: <MapMarkerSpec>[
            if (me != null) MapMarkerSpec(point: me!.toLatLng(), kind: MapMarkerKind.partner, headingDegrees: heading),
            if (pickup != null) MapMarkerSpec(point: pickup.address.toLatLng(), kind: MapMarkerKind.pickup),
            if (destination != null)
              MapMarkerSpec(point: destination.address.toLatLng(), kind: MapMarkerKind.destination),
          ],
        ),
        Positioned(
          top: MediaQuery.paddingOf(context).top + TamamSpacing.s2,
          left: TamamSpacing.s3,
          right: TamamSpacing.s3,
          child: Row(
            children: <Widget>[
              Material(
                color: colors.surface,
                shape: const CircleBorder(),
                elevation: 2,
                child: IconButton(
                  tooltip: l10n.actionBack,
                  onPressed: () => context.canPop() ? context.pop() : context.go(Routes.home),
                  icon: Icon(Icons.arrow_back_rounded, color: colors.textPrimary),
                ),
              ),
              const Spacer(),
              StatusPill.forJobStatus(status: job.status, label: JobLabels.status(l10n, job.status)),
              if (eta != null) ...<Widget>[
                const SizedBox(width: TamamSpacing.s2),
                StatusPill(
                  label: l10n.durationMin(units.minutesValue(eta)),
                  tone: PillTone.brand,
                  icon: Icons.schedule_rounded,
                ),
              ],
            ],
          ),
        ),
        if (!state.socketConnected)
          Positioned(
            bottom: TamamSpacing.s3,
            right: TamamSpacing.s3,
            child: StatusPill(label: l10n.realtimeReconnecting, tone: PillTone.warning, icon: Icons.sync_rounded, dense: true),
          ),
      ],
    );
  }
}

class _ActionPanel extends ConsumerStatefulWidget {
  const _ActionPanel({
    required this.state,
    required this.action,
    required this.secondary,
    required this.onPrimary,
    required this.onRetry,
    required this.onNavigate,
    required this.onCancel,
    required this.onRelease,
    required this.onWaitingForParts,
    required this.onChangeOrder,
    required this.onDismissFailure,
  });

  final ActiveJobState state;
  final PartnerJobAction action;
  final JobSecondaryActions secondary;
  final VoidCallback onPrimary;
  final VoidCallback? onRetry;
  final VoidCallback onNavigate;
  final VoidCallback onCancel;
  final VoidCallback onRelease;
  final VoidCallback onWaitingForParts;
  final VoidCallback onChangeOrder;
  final VoidCallback onDismissFailure;

  @override
  ConsumerState<_ActionPanel> createState() => _ActionPanelState();
}

class _ActionPanelState extends ConsumerState<_ActionPanel> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final ActiveJobState state = widget.state;
    final Job job = state.job;
    final bool waiting = job.hasArrived && !job.hasStarted && !job.isTerminal;
    final DateTime? arrivedAt = state.arrivedAt;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(TamamRadius.sheet)),
        boxShadow: TamamElevation.sheet,
      ),
      child: SafeArea(
        top: false,
        child: Column(
          children: <Widget>[
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(TamamSpacing.s4, TamamSpacing.s4, TamamSpacing.s4, TamamSpacing.s2),
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Icon(JobLabels.typeIcon(job.type), color: JobLabels.typeColor(job.type)),
                      const SizedBox(width: TamamSpacing.s2),
                      Expanded(
                        child: Text(
                          JobLabels.type(l10n, job.type),
                          style: TamamType.headingMd.toTextStyle(color: colors.textPrimary),
                        ),
                      ),
                      Text(job.number, textDirection: TextDirection.ltr, style: TamamType.labelMd.toTextStyle(color: colors.textTertiary)),
                    ],
                  ),
                  if (waiting && arrivedAt != null)
                    Padding(
                      padding: const EdgeInsets.only(top: TamamSpacing.s2),
                      child: Row(
                        children: <Widget>[
                          Icon(Icons.hourglass_bottom_rounded, size: TamamSize.iconSm, color: colors.warning),
                          const SizedBox(width: TamamSpacing.s1),
                          Text(
                            l10n.jobWaitingSince(_elapsed(arrivedAt)),
                            style: TamamType.labelMd.toTextStyle(color: TamamSemantic.warningStrong),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: TamamSpacing.s3),
                  CustomerCard(job: job),
                  const SizedBox(height: TamamSpacing.s3),
                  Divider(color: colors.border),
                  for (final JobStop stop in job.stops)
                    _StopRow(stop: stop, isCurrent: stop.id == job.currentTarget?.id, job: job),
                  if (job.delivery?.deliveryNotes != null && job.delivery!.deliveryNotes!.isNotEmpty)
                    _NoteBox(icon: Icons.sticky_note_2_outlined, text: job.delivery!.deliveryNotes!),
                  if (job.description != null && job.description!.isNotEmpty && job.isHomeService)
                    _NoteBox(icon: Icons.description_outlined, text: job.description!),
                  if (job.activeQuote != null) ...<Widget>[
                    const SizedBox(height: TamamSpacing.s3),
                    QuoteSummaryCard(quote: job.activeQuote!),
                  ],
                  if (state.failure != null) _FailureBox(state: state, onRetry: widget.onRetry, onDismiss: widget.onDismissFailure),
                  const SizedBox(height: TamamSpacing.s2),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(TamamSpacing.s4, 0, TamamSpacing.s4, TamamSpacing.s3),
              child: Column(
                children: <Widget>[
                  if (JobActions.isPassive(widget.action))
                    _PassiveBox(action: widget.action, job: job)
                  else
                    TamamButton(
                      label: _primaryLabel(l10n, widget.action),
                      icon: _primaryIcon(widget.action),
                      busy: state.busy,
                      onPressed: widget.onPrimary,
                    ),
                  const SizedBox(height: TamamSpacing.s2),
                  Row(
                    children: <Widget>[
                      if (widget.secondary.canNavigate)
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: widget.onNavigate,
                            icon: const Icon(Icons.navigation_rounded),
                            label: Text(l10n.jobNavigate),
                          ),
                        ),
                      if (widget.secondary.canPauseForParts) ...<Widget>[
                        const SizedBox(width: TamamSpacing.s2),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: state.busy ? null : widget.onWaitingForParts,
                            icon: const Icon(Icons.pause_circle_outline_rounded),
                            label: Text(l10n.jobActionWaitingForParts),
                          ),
                        ),
                      ],
                      if (widget.secondary.canChangeOrder) ...<Widget>[
                        const SizedBox(width: TamamSpacing.s2),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: widget.onChangeOrder,
                            icon: const Icon(Icons.post_add_rounded),
                            label: Text(l10n.jobActionChangeOrder),
                          ),
                        ),
                      ],
                      if (widget.secondary.canCancel || widget.secondary.canRelease) ...<Widget>[
                        const SizedBox(width: TamamSpacing.s2),
                        PopupMenuButton<String>(
                          tooltip: l10n.actionMore,
                          icon: Icon(Icons.more_horiz_rounded, color: colors.textSecondary),
                          onSelected: (String key) {
                            if (key == 'cancel') widget.onCancel();
                            if (key == 'release') widget.onRelease();
                          },
                          itemBuilder: (BuildContext _) => <PopupMenuEntry<String>>[
                            if (widget.secondary.canRelease)
                              PopupMenuItem<String>(value: 'release', child: Text(l10n.releaseJobTitle)),
                            if (widget.secondary.canCancel)
                              PopupMenuItem<String>(
                                value: 'cancel',
                                child: Text(l10n.cancelJobTitle, style: TextStyle(color: colors.danger)),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                  if (state.versionConflict)
                    Padding(
                      padding: const EdgeInsets.only(top: TamamSpacing.s2),
                      child: Text(
                        l10n.jobVersionConflictHint,
                        textAlign: TextAlign.center,
                        style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _elapsed(DateTime since) {
    final Duration d = DateTime.now().difference(since);
    final int minutes = d.inMinutes;
    final int seconds = d.inSeconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  String _primaryLabel(AppLocalizations l10n, PartnerJobAction action) => switch (action) {
        PartnerJobAction.goEnRoute => l10n.jobActionEnRoute,
        PartnerJobAction.arrive => l10n.jobActionArrive,
        PartnerJobAction.startRide => l10n.jobActionStartRide,
        PartnerJobAction.pickUpPackage => l10n.jobActionPickedUp,
        PartnerJobAction.startInspection => l10n.jobActionStartInspection,
        PartnerJobAction.completeRide => l10n.jobActionCompleteRide,
        PartnerJobAction.deliverPackage => l10n.jobActionDeliver,
        PartnerJobAction.submitQuote => l10n.jobActionSubmitQuote,
        PartnerJobAction.startWork => l10n.jobActionStartWork,
        PartnerJobAction.completeWork => l10n.jobActionCompleteWork,
        PartnerJobAction.resumeWork => l10n.jobActionResumeWork,
        PartnerJobAction.rateCustomer => l10n.completionRateCustomer,
        PartnerJobAction.awaitQuoteDecision ||
        PartnerJobAction.awaitCustomerConfirmation ||
        PartnerJobAction.none =>
          '',
      };

  IconData _primaryIcon(PartnerJobAction action) => switch (action) {
        PartnerJobAction.goEnRoute => Icons.directions_car_rounded,
        PartnerJobAction.arrive => Icons.flag_rounded,
        PartnerJobAction.startRide => Icons.play_arrow_rounded,
        PartnerJobAction.pickUpPackage => Icons.inventory_2_rounded,
        PartnerJobAction.startInspection => Icons.search_rounded,
        PartnerJobAction.completeRide => Icons.check_circle_rounded,
        PartnerJobAction.deliverPackage => Icons.task_alt_rounded,
        PartnerJobAction.submitQuote => Icons.request_quote_rounded,
        PartnerJobAction.startWork => Icons.build_rounded,
        PartnerJobAction.completeWork => Icons.check_circle_rounded,
        PartnerJobAction.resumeWork => Icons.play_circle_rounded,
        PartnerJobAction.rateCustomer => Icons.star_rounded,
        _ => Icons.circle,
      };
}

class _PassiveBox extends StatelessWidget {
  const _PassiveBox({required this.action, required this.job});

  final PartnerJobAction action;
  final Job job;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final String text = switch (action) {
      PartnerJobAction.awaitQuoteDecision => l10n.jobPassiveAwaitQuote,
      PartnerJobAction.awaitCustomerConfirmation => l10n.jobPassiveAwaitConfirmation,
      _ => job.isCancelled ? l10n.jobPassiveCancelled : l10n.jobPassiveNothing,
    };
    return Container(
      padding: const EdgeInsets.all(TamamSpacing.s3),
      decoration: BoxDecoration(
        color: job.isCancelled ? colors.dangerSoft : colors.surfaceBrandSoft,
        borderRadius: BorderRadius.circular(TamamRadius.md),
      ),
      child: Row(
        children: <Widget>[
          if (!job.isTerminal)
            SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: colors.primary))
          else
            Icon(Icons.info_outline_rounded, color: job.isCancelled ? colors.danger : colors.primary),
          const SizedBox(width: TamamSpacing.s3),
          Expanded(child: Text(text, style: TamamType.bodyMd.toTextStyle(color: colors.textPrimary))),
        ],
      ),
    );
  }
}

class _FailureBox extends StatelessWidget {
  const _FailureBox({required this.state, required this.onRetry, required this.onDismiss});

  final ActiveJobState state;
  final VoidCallback? onRetry;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final AppFailure failure = state.failure!;
    final String message;
    if (failure.code == ActiveJobController.noLocationCode) {
      message = l10n.locationUnavailable;
    } else if (state.geofenceDistanceMeters != null) {
      message = l10n.arriveTooFar(state.geofenceDistanceMeters!);
    } else if (state.versionConflict) {
      message = l10n.errorVersionConflict;
    } else {
      message = localizedFailure(l10n, failure);
    }
    return Container(
      margin: const EdgeInsets.only(top: TamamSpacing.s3),
      padding: const EdgeInsets.all(TamamSpacing.s3),
      decoration: BoxDecoration(color: colors.dangerSoft, borderRadius: BorderRadius.circular(TamamRadius.md)),
      child: Row(
        children: <Widget>[
          Icon(Icons.error_outline_rounded, color: colors.danger),
          const SizedBox(width: TamamSpacing.s2),
          Expanded(child: Text(message, style: TamamType.bodySm.toTextStyle(color: TamamSemantic.dangerStrong))),
          if (state.versionConflict && onRetry != null)
            TextButton(onPressed: onRetry, child: Text(l10n.actionRetry))
          else
            IconButton(onPressed: onDismiss, icon: const Icon(Icons.close_rounded), tooltip: l10n.actionDismiss),
        ],
      ),
    );
  }
}

class _StopRow extends StatelessWidget {
  const _StopRow({required this.stop, required this.isCurrent, required this.job});

  final JobStop stop;
  final bool isCurrent;
  final Job job;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final (IconData icon, Color color, String label) = switch (stop.kind) {
      JobStopKind.pickup => (Icons.trip_origin_rounded, colors.mapPickup, l10n.offerPickup),
      JobStopKind.dropoff => (Icons.place_rounded, colors.mapDestination, l10n.offerDestination),
      JobStopKind.serviceLocation => (Icons.home_repair_service_rounded, colors.mapPickup, l10n.offerServiceLocation),
      JobStopKind.waypoint => (Icons.more_horiz_rounded, colors.textTertiary, l10n.offerWaypoint),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: TamamSpacing.s2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, color: color, size: TamamSize.iconMd),
          const SizedBox(width: TamamSpacing.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Text(label, style: TamamType.labelSm.toTextStyle(color: colors.textTertiary)),
                    if (isCurrent) ...<Widget>[
                      const SizedBox(width: TamamSpacing.s1),
                      StatusPill(label: l10n.jobCurrentTarget, tone: PillTone.brand, dense: true),
                    ],
                  ],
                ),
                Text(
                  stop.address.formatted,
                  style: TamamType.bodyMd.toTextStyle(color: colors.textPrimary).copyWith(
                        fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w400,
                      ),
                ),
                if (stop.address.detailLine != null)
                  Text(stop.address.detailLine!, style: TamamType.bodySm.toTextStyle(color: colors.textSecondary)),
                if (stop.contactName != null && stop.contactName!.isNotEmpty)
                  Text(
                    stop.contactPhone == null ? stop.contactName! : '${stop.contactName!} · ${stop.contactPhone!}',
                    style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                  ),
                if (stop.notes != null && stop.notes!.isNotEmpty)
                  Text(stop.notes!, style: TamamType.bodySm.toTextStyle(color: colors.textTertiary)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NoteBox extends StatelessWidget {
  const _NoteBox({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Container(
      margin: const EdgeInsets.only(top: TamamSpacing.s2),
      padding: const EdgeInsets.all(TamamSpacing.s3),
      decoration: BoxDecoration(color: colors.surfaceAlt, borderRadius: BorderRadius.circular(TamamRadius.md)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, size: TamamSize.iconSm, color: colors.textSecondary),
          const SizedBox(width: TamamSpacing.s2),
          Expanded(child: Text(text, style: TamamType.bodySm.toTextStyle(color: colors.textSecondary))),
        ],
      ),
    );
  }
}
