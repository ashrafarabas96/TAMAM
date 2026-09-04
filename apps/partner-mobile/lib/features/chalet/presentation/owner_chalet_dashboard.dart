import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/money_text.dart';
import 'package:tamam_partner/core/widgets/section_header.dart';
import 'package:tamam_partner/core/widgets/stat_tile.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/chalet/domain/owner_chalet.dart';
import 'package:tamam_partner/features/chalet/presentation/owner_chalet_providers.dart';
import 'package:tamam_partner/features/chalet/presentation/widgets/occupancy_chart.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// One chalet's dashboard: how it is doing, where the empty hours are, what is
/// booked, and the switches that decide how it sells.
///
/// The order is deliberate. Occupancy first because it is the question an owner
/// actually has; the gaps next because that is the part they can act on today;
/// the switches last because they are a decision, not a status.
class OwnerChaletDashboard extends ConsumerWidget {
  const OwnerChaletDashboard({required this.chaletId, super.key});

  final String chaletId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final AsyncValue<List<OwnerChalet>> chalets = ref.watch(ownerChaletsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.chaletOwnerTitle)),
      body: AsyncView<List<OwnerChalet>>(
        value: chalets,
        onRetry: () => ref.invalidate(ownerChaletsProvider),
        builder: (List<OwnerChalet> items) {
          final OwnerChalet? chalet =
              items.where((OwnerChalet c) => c.id == chaletId).firstOrNull;
          if (chalet == null) {
            return Center(child: Text(l10n.chaletOwnerEmpty));
          }
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(ownerChaletsProvider);
              ref.invalidate(chaletOccupancyProvider(chaletId));
              ref.invalidate(chaletBookingsProvider(chaletId));
            },
            child: ListView(
              padding: const EdgeInsets.all(TamamSpacing.s4),
              children: <Widget>[
                _OccupancyBlock(chaletId: chaletId),
                const SizedBox(height: TamamSpacing.s5),
                _GapsBlock(chaletId: chaletId),
                const SizedBox(height: TamamSpacing.s5),
                _BookingsBlock(chaletId: chaletId),
                const SizedBox(height: TamamSpacing.s5),
                _AutomationBlock(chalet: chalet),
                const SizedBox(height: TamamSpacing.s6),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _OccupancyBlock extends ConsumerWidget {
  const _OccupancyBlock({required this.chaletId});

  final String chaletId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final AsyncValue<ChaletOccupancy> occupancy = ref.watch(chaletOccupancyProvider(chaletId));

    return AsyncView<ChaletOccupancy>(
      value: occupancy,
      onRetry: () => ref.invalidate(chaletOccupancyProvider(chaletId)),
      builder: (ChaletOccupancy data) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: StatTile(
                  value: l10n.chaletOccupancyValue(data.occupancyPercent),
                  label: l10n.chaletOccupancy,
                  icon: Icons.pie_chart_outline_rounded,
                ),
              ),
              const SizedBox(width: TamamSpacing.s3),
              Expanded(
                child: StatTile(
                  value: '${data.bookingCount}',
                  label: l10n.chaletBookingsCount,
                  icon: Icons.event_available_rounded,
                ),
              ),
              const SizedBox(width: TamamSpacing.s3),
              Expanded(
                child: StatTile(
                  value: '${data.cancelledCount}',
                  label: l10n.chaletCancelledCount,
                  icon: Icons.event_busy_rounded,
                  // Cancellations are shown in their own tile rather than
                  // folded into occupancy, where they would be invisible.
                  tone: data.cancelledCount > 0 ? context.colors.warning : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: TamamSpacing.s3),
          TamamCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(child: Text(l10n.chaletRevenue)),
                    MoneyText(data.revenue),
                  ],
                ),
                const SizedBox(height: TamamSpacing.s2),
                Row(
                  children: <Widget>[
                    Expanded(child: Text(l10n.chaletAverageRate)),
                    MoneyText(data.averageHourlyRate),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: TamamSpacing.s4),
          SectionHeader(title: l10n.chaletByWeekday),
          WeekdayOccupancyChart(days: data.byDayOfWeek),
          const SizedBox(height: TamamSpacing.s4),
          SectionHeader(title: l10n.chaletByHour),
          HourOccupancyChart(hours: data.byHourOfDay),
        ],
      ),
    );
  }
}

class _GapsBlock extends ConsumerWidget {
  const _GapsBlock({required this.chaletId});

  final String chaletId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final ChaletGapQuery query = ChaletGapQuery(chaletId: chaletId, date: DateTime.now());
    final AsyncValue<List<ChaletGap>> gaps = ref.watch(chaletGapsProvider(query));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        SectionHeader(title: l10n.chaletGapsTitle),
        Text(
          l10n.chaletGapsBody,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: TamamSpacing.s3),
        AsyncView<List<ChaletGap>>(
          value: gaps,
          onRetry: () => ref.invalidate(chaletGapsProvider(query)),
          isEmpty: (List<ChaletGap> items) => items.isEmpty,
          emptyTitle: l10n.chaletGapsEmpty,
          emptyIcon: Icons.check_circle_outline_rounded,
          builder: (List<ChaletGap> items) => Column(
            children: items
                .map((ChaletGap gap) => TamamCard(
                      margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
                      child: Row(
                        children: <Widget>[
                          Icon(Icons.hourglass_empty_rounded, color: colors.warning),
                          const SizedBox(width: TamamSpacing.s3),
                          Expanded(
                            child: Text(
                              '${_time(context, gap.startAt)} — ${_time(context, gap.endAt)}',
                            ),
                          ),
                          Text(
                            l10n.chaletGapDuration(gap.availableMinutes),
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: colors.textSecondary),
                          ),
                        ],
                      ),
                    ))
                .toList(growable: false),
          ),
        ),
      ],
    );
  }
}

class _BookingsBlock extends ConsumerWidget {
  const _BookingsBlock({required this.chaletId});

  final String chaletId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final AsyncValue<List<OwnerBooking>> bookings = ref.watch(chaletBookingsProvider(chaletId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        SectionHeader(title: l10n.chaletBookingsTitle),
        AsyncView<List<OwnerBooking>>(
          value: bookings,
          onRetry: () => ref.invalidate(chaletBookingsProvider(chaletId)),
          isEmpty: (List<OwnerBooking> items) => items.isEmpty,
          emptyTitle: l10n.chaletBookingsEmpty,
          emptyIcon: Icons.event_note_outlined,
          builder: (List<OwnerBooking> items) => Column(
            children: items
                .map((OwnerBooking booking) => TamamCard(
                      margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Row(
                            children: <Widget>[
                              Expanded(
                                child: Text(
                                  '${_time(context, booking.startAt)} — '
                                  '${_time(context, booking.endAt)}',
                                  style: Theme.of(context).textTheme.titleSmall,
                                ),
                              ),
                              // Where the booking came from, so an owner can
                              // tell their own phone bookings from TAMAM's.
                              StatusPill(
                                label: booking.isExternal
                                    ? l10n.chaletSourceManual
                                    : l10n.chaletSourceTamam,
                                tone: booking.isExternal ? PillTone.neutral : PillTone.brand,
                                dense: true,
                              ),
                            ],
                          ),
                          const SizedBox(height: TamamSpacing.s1),
                          Row(
                            children: <Widget>[
                              Expanded(
                                child: Text(
                                  booking.guestName ?? booking.bookingNumber,
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                        color: context.colors.textSecondary,
                                      ),
                                ),
                              ),
                              MoneyText(booking.total),
                            ],
                          ),
                        ],
                      ),
                    ))
                .toList(growable: false),
          ),
        ),
      ],
    );
  }
}

class _AutomationBlock extends ConsumerStatefulWidget {
  const _AutomationBlock({required this.chalet});

  final OwnerChalet chalet;

  @override
  ConsumerState<_AutomationBlock> createState() => _AutomationBlockState();
}

class _AutomationBlockState extends ConsumerState<_AutomationBlock> {
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final OwnerChalet chalet = widget.chalet;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        SectionHeader(title: l10n.chaletAutomationTitle),
        TamamCard(
          child: Column(
            children: <Widget>[
              _Switch(
                title: l10n.chaletSmartPricing,
                body: l10n.chaletSmartPricingBody,
                value: chalet.smartPricingEnabled,
                enabled: !_saving,
                onChanged: (bool on) => unawaited(_set('smartPricingEnabled', on)),
              ),
              _Switch(
                title: l10n.chaletGapFiller,
                body: l10n.chaletGapFillerBody,
                value: chalet.gapFillerEnabled,
                enabled: !_saving,
                onChanged: (bool on) => unawaited(_set('gapFillerEnabled', on)),
              ),
              _Switch(
                title: l10n.chaletLastMinute,
                body: l10n.chaletLastMinuteBody,
                value: chalet.lastMinutePricingEnabled,
                enabled: !_saving,
                onChanged: (bool on) => unawaited(_set('lastMinutePricingEnabled', on)),
              ),
              _Switch(
                title: l10n.chaletInstantBookingSetting,
                body: l10n.chaletInstantBookingBody,
                value: chalet.instantBookingEnabled,
                enabled: !_saving,
                onChanged: (bool on) => unawaited(_set('instantBookingEnabled', on)),
              ),
            ],
          ),
        ),
        const SizedBox(height: TamamSpacing.s2),
        // The floor is restated next to the switches, because it is what makes
        // turning Smart Pricing on safe: the platform cannot undercut it.
        Row(
          children: <Widget>[
            Icon(Icons.shield_outlined, size: 16, color: context.colors.textTertiary),
            const SizedBox(width: TamamSpacing.s2),
            Expanded(
              child: Text(
                l10n.chaletFloorNotice(
                  '${chalet.minimumHourlyRate.amount / 100} ${chalet.minimumHourlyRate.currency}',
                ),
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: context.colors.textTertiary),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _set(String key, bool value) async {
    setState(() => _saving = true);
    try {
      await ref
          .read(ownerChaletsProvider.notifier)
          .setAutomation(widget.chalet.id, <String, bool>{key: value});
    } on AppFailure catch (failure) {
      if (!mounted) return;
      AppFeedback.showFailure(context, failure);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

class _Switch extends StatelessWidget {
  const _Switch({
    required this.title,
    required this.body,
    required this.value,
    required this.onChanged,
    required this.enabled,
  });

  final String title;
  final String body;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) => SwitchListTile.adaptive(
        contentPadding: EdgeInsets.zero,
        title: Text(title, style: Theme.of(context).textTheme.titleSmall),
        subtitle: Text(
          body,
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: context.colors.textSecondary),
        ),
        value: value,
        onChanged: enabled ? onChanged : null,
      );
}

String _time(BuildContext context, DateTime at) => MaterialLocalizations.of(context)
    .formatTimeOfDay(TimeOfDay.fromDateTime(at.toLocal()));
