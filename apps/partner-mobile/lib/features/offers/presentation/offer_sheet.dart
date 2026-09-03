import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/countdown_ring.dart';
import 'package:tamam_partner/core/widgets/money_text.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/jobs/presentation/job_labels.dart';
import 'package:tamam_partner/features/offers/domain/job_offer.dart';
import 'package:tamam_partner/features/offers/domain/offer_countdown.dart';
import 'package:tamam_partner/features/offers/presentation/offers_controller.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// The full-screen incoming-offer sheet.
///
/// Shows the *current* offer of the queue and closes itself when the queue is
/// empty (accepted, declined or expired). The sheet cannot be swiped away: the
/// only exits are the two buttons or the deadline, so an accidental gesture
/// never loses a job.
class OfferSheet extends ConsumerStatefulWidget {
  const OfferSheet({super.key});

  /// Route name used to avoid stacking two sheets.
  static const String routeName = 'offer-sheet';

  static Future<void> show(BuildContext context) => Navigator.of(context, rootNavigator: true).push<void>(
        PageRouteBuilder<void>(
          settings: const RouteSettings(name: routeName),
          fullscreenDialog: true,
          opaque: true,
          transitionDuration: TamamMotion.durationSlow,
          pageBuilder: (BuildContext _, Animation<double> __, Animation<double> ___) => const OfferSheet(),
          transitionsBuilder: (BuildContext _, Animation<double> animation, Animation<double> __, Widget child) =>
              SlideTransition(
            position: Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero)
                .animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
            child: child,
          ),
        ),
      );

  @override
  ConsumerState<OfferSheet> createState() => _OfferSheetState();
}

class _OfferSheetState extends ConsumerState<OfferSheet> {
  Timer? _ticker;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(milliseconds: 200), (_) {
      if (mounted) setState(() => _now = DateTime.now());
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
    final OfferQueue queue = ref.watch(offersControllerProvider);
    final JobOffer? offer = queue.current;

    ref.listen<OfferQueue>(offersControllerProvider, (OfferQueue? previous, OfferQueue next) {
      if (next.failure != null && next.failure != previous?.failure) {
        AppFeedback.showFailure(context, next.failure!);
        ref.read(offersControllerProvider.notifier).clearFailure();
      }
      if (next.current == null && Navigator.of(context).canPop()) Navigator.of(context).pop();
    });

    if (offer == null) {
      return Scaffold(backgroundColor: colors.surfaceBrand, body: const SizedBox.expand());
    }

    final OfferCountdown countdown = OfferCountdown(receivedAt: offer.receivedAt, expiresAt: offer.expiresAt);
    final int seconds = countdown.secondsLabel(_now);

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: colors.surfaceBrand,
        body: SafeArea(
          child: Column(
            children: <Widget>[
              const SizedBox(height: TamamSpacing.s4),
              Text(
                l10n.offerTitle,
                style: TamamType.headingMd.toTextStyle(color: TamamBrand.purple100),
              ),
              if (queue.length > 1)
                Padding(
                  padding: const EdgeInsets.only(top: TamamSpacing.s1),
                  child: Text(
                    l10n.offerQueuePosition(queue.length),
                    style: TamamType.labelMd.toTextStyle(color: colors.accent),
                  ),
                ),
              const SizedBox(height: TamamSpacing.s4),
              CountdownRing(
                remaining: countdown.remaining(_now),
                total: countdown.total,
                size: 112,
                strokeWidth: 9,
                label: l10n.offerSecondsLeft(seconds),
              ),
              const SizedBox(height: TamamSpacing.s5),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s5),
                  child: _OfferBody(offer: offer),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(TamamSpacing.s5, TamamSpacing.s3, TamamSpacing.s5, TamamSpacing.s4),
                child: Column(
                  children: <Widget>[
                    TamamButton(
                      key: const Key('offer-accept'),
                      label: l10n.offerAccept,
                      icon: Icons.check_rounded,
                      busy: queue.responding,
                      onPressed: () => unawaited(ref.read(offersControllerProvider.notifier).accept()),
                    ),
                    const SizedBox(height: TamamSpacing.s2),
                    TextButton(
                      key: const Key('offer-decline'),
                      onPressed: queue.responding
                          ? null
                          : () => unawaited(ref.read(offersControllerProvider.notifier).decline()),
                      style: TextButton.styleFrom(
                        foregroundColor: TamamBrand.purple100,
                        minimumSize: const Size.fromHeight(TamamSize.buttonHeightLg),
                      ),
                      child: Text(l10n.offerDecline),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OfferBody extends ConsumerWidget {
  const _OfferBody({required this.offer});

  final JobOffer offer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    final Job job = offer.job;
    final JobStop? pickup = job.pickup;
    final JobStop? destination = job.destination;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        // Service line: type + urgency.
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Icon(JobLabels.typeIcon(job.type), color: colors.accent, size: TamamSize.iconLg),
            const SizedBox(width: TamamSpacing.s2),
            Text(
              JobLabels.type(l10n, job.type),
              style: TamamType.headingLg.toTextStyle(color: colors.textOnBrand),
            ),
            if (job.urgency != JobUrgency.standard) ...<Widget>[
              const SizedBox(width: TamamSpacing.s2),
              StatusPill(label: JobLabels.urgency(l10n, job.urgency), tone: PillTone.danger, dense: true),
            ],
          ],
        ),
        const SizedBox(height: TamamSpacing.s5),
        // Earnings — the decision number.
        Container(
          padding: const EdgeInsets.all(TamamSpacing.s4),
          decoration: BoxDecoration(
            color: TamamBrand.purple700,
            borderRadius: BorderRadius.circular(TamamRadius.card),
          ),
          child: Column(
            children: <Widget>[
              Text(
                l10n.offerEstimatedEarnings,
                style: TamamType.labelMd.toTextStyle(color: TamamBrand.purple200),
              ),
              const SizedBox(height: TamamSpacing.s1),
              MoneyText(
                offer.estimatedEarnings,
                color: colors.accent,
                style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: TamamSpacing.s3),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  _Metric(
                    icon: Icons.near_me_rounded,
                    value: units.isKilometres(offer.distanceToPickupMeters)
                        ? l10n.distanceKm(units.distanceValue(offer.distanceToPickupMeters))
                        : l10n.distanceM(units.distanceValue(offer.distanceToPickupMeters)),
                    label: l10n.offerToPickup,
                  ),
                  const SizedBox(width: TamamSpacing.s8),
                  _Metric(
                    icon: Icons.schedule_rounded,
                    value: l10n.durationMin(units.minutesValue(offer.etaToPickupSeconds)),
                    label: l10n.offerEta,
                  ),
                  if (job.distanceMeters != null) ...<Widget>[
                    const SizedBox(width: TamamSpacing.s8),
                    _Metric(
                      icon: Icons.route_rounded,
                      value: units.isKilometres(job.distanceMeters!)
                          ? l10n.distanceKm(units.distanceValue(job.distanceMeters!))
                          : l10n.distanceM(units.distanceValue(job.distanceMeters!)),
                      label: l10n.offerTripDistance,
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: TamamSpacing.s4),
        if (pickup != null)
          _AddressRow(
            icon: Icons.trip_origin_rounded,
            iconColor: colors.accent,
            label: job.isHomeService ? l10n.offerServiceLocation : l10n.offerPickup,
            address: pickup.address.formatted,
            detail: pickup.address.detailLine,
          ),
        if (destination != null) ...<Widget>[
          const SizedBox(height: TamamSpacing.s3),
          _AddressRow(
            icon: Icons.place_rounded,
            iconColor: TamamBrand.purple200,
            label: l10n.offerDestination,
            address: destination.address.formatted,
            detail: destination.address.detailLine,
          ),
        ],
        const SizedBox(height: TamamSpacing.s4),
        Wrap(
          spacing: TamamSpacing.s2,
          runSpacing: TamamSpacing.s2,
          alignment: WrapAlignment.center,
          children: <Widget>[
            StatusPill(
              label: JobLabels.payment(l10n, job.paymentMethod),
              tone: job.paymentMethod == PaymentMethod.cash ? PillTone.warning : PillTone.success,
              icon: job.paymentMethod == PaymentMethod.cash ? Icons.payments_rounded : Icons.credit_card_rounded,
            ),
            if (job.scheduledFor != null)
              StatusPill(
                label: units.dateTime(job.scheduledFor!),
                tone: PillTone.info,
                icon: Icons.event_rounded,
              ),
            if (job.delivery != null)
              StatusPill(
                label: job.delivery!.packageCategoryName.resolve(Localizations.localeOf(context).languageCode),
                tone: PillTone.neutral,
                icon: Icons.inventory_2_outlined,
              ),
          ],
        ),
        if (job.description != null && job.description!.isNotEmpty) ...<Widget>[
          const SizedBox(height: TamamSpacing.s4),
          Text(
            job.description!,
            textAlign: TextAlign.center,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: TamamType.bodyMd.toTextStyle(color: TamamBrand.purple100),
          ),
        ],
      ],
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.icon, required this.value, required this.label});

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Column(
      children: <Widget>[
        Icon(icon, size: TamamSize.iconSm, color: TamamBrand.purple200),
        const SizedBox(height: 2),
        Text(value, style: TamamType.headingSm.toTextStyle(color: colors.textOnBrand)),
        Text(label, style: TamamType.labelSm.toTextStyle(color: TamamBrand.purple200)),
      ],
    );
  }
}

class _AddressRow extends StatelessWidget {
  const _AddressRow({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.address,
    this.detail,
  });

  final IconData icon;
  final Color iconColor;
  final String label;
  final String address;
  final String? detail;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Icon(icon, size: TamamSize.iconMd, color: iconColor),
        const SizedBox(width: TamamSpacing.s3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(label, style: TamamType.labelSm.toTextStyle(color: TamamBrand.purple200)),
              Text(
                address,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TamamType.bodyLg.toTextStyle(color: colors.textOnBrand),
              ),
              if (detail != null)
                Text(detail!, style: TamamType.bodySm.toTextStyle(color: TamamBrand.purple100)),
            ],
          ),
        ),
      ],
    );
  }
}
