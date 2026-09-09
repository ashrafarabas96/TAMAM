import 'dart:async';

import 'package:flutter/material.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/tamam_pressable.dart';
import 'package:tamam_customer/features/jobs/presentation/job_labels.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// The three visit windows a scheduled service can be booked into.
const List<String> kServiceTimeSlots = <String>[
  'MORNING',
  'AFTERNOON',
  'EVENING'
];

/// The hour a visit window opens, used to turn a day plus a window into the
/// moment the platform dispatches for.
int serviceSlotStartHour(String slot) => switch (slot) {
      'AFTERNOON' => 13,
      'EVENING' => 17,
      _ => 9,
    };

/// "When do you want the service?" — now, or at a booked time.
///
/// This replaces the old "urgent service" entry on the home screen: instant
/// is a way of asking for any service, so it belongs inside the order, next to
/// the alternative, rather than as a category of its own. Which of the two
/// choices appear is the operator's decision per category; when only one is
/// allowed the picker still shows it, so the customer knows how this service
/// is delivered instead of wondering where the other option went.
class ServiceTimingPicker extends StatelessWidget {
  const ServiceTimingPicker({
    required this.allowsInstant,
    required this.allowsScheduled,
    required this.preferredDate,
    required this.preferredTimeSlot,
    required this.onChanged,
    super.key,
  });

  final bool allowsInstant;
  final bool allowsScheduled;

  /// `yyyy-MM-dd` when a visit is booked; null means "now".
  final String? preferredDate;

  /// One of [kServiceTimeSlots] when a visit is booked.
  final String? preferredTimeSlot;

  /// Called with nothing for "now", or with a day and a window.
  final void Function({String? date, String? slot}) onChanged;

  bool get _scheduled => preferredDate != null;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        // IntrinsicHeight gives the stretch a finite height to stretch to, so
        // the two cards match even when one caption wraps; without it a Row
        // inside a scrolling column has no height to offer.
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Expanded(
                child: _TimingCard(
                  key: const Key('service-timing-instant'),
                  icon: Icons.bolt_rounded,
                  tint: TamamServiceColors.urgent,
                  title: l10n.serviceWhenNow,
                  caption: l10n.serviceWhenNowCaption,
                  selected: !_scheduled,
                  enabled: allowsInstant,
                  onTap: () => onChanged(),
                ),
              ),
              const SizedBox(width: TamamSpacing.s3),
              Expanded(
                child: _TimingCard(
                  key: const Key('service-timing-scheduled'),
                  icon: Icons.event_available_rounded,
                  tint: colors.primary,
                  title: l10n.serviceWhenScheduled,
                  caption: l10n.serviceWhenScheduledCaption,
                  selected: _scheduled,
                  enabled: allowsScheduled,
                  onTap: () => unawaited(_pickDate(context)),
                ),
              ),
            ],
          ),
        ),
        if (!allowsInstant || !allowsScheduled)
          Padding(
            padding: const EdgeInsets.only(top: TamamSpacing.s2),
            child: Text(
              allowsInstant
                  ? l10n.serviceInstantOnly
                  : l10n.serviceScheduledOnly,
              style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
            ),
          ),
        if (_scheduled) ...<Widget>[
          const SizedBox(height: TamamSpacing.s3),
          Row(
            children: <Widget>[
              Icon(Icons.calendar_today_rounded,
                  size: TamamSize.iconSm, color: colors.textSecondary),
              const SizedBox(width: TamamSpacing.s2),
              Text(
                preferredDate!,
                textDirection: TextDirection.ltr,
                style: TamamType.labelMd.toTextStyle(color: colors.textPrimary),
              ),
              const SizedBox(width: TamamSpacing.s2),
              TextButton(
                onPressed: () => unawaited(_pickDate(context)),
                child: Text(l10n.serviceWhenChangeDay),
              ),
            ],
          ),
          Wrap(
            spacing: TamamSpacing.s2,
            runSpacing: TamamSpacing.s2,
            children: kServiceTimeSlots
                .map(
                  (String slot) => ChoiceChip(
                    label: Text(JobLabels.timeSlot(l10n, slot)),
                    selected: preferredTimeSlot == slot,
                    onSelected: (bool _) =>
                        onChanged(date: preferredDate, slot: slot),
                  ),
                )
                .toList(growable: false),
          ),
        ],
      ],
    );
  }

  Future<void> _pickDate(BuildContext context) async {
    final DateTime now = DateTime.now();
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 60)),
    );
    if (picked == null) return;
    onChanged(
      date: picked.toIso8601String().substring(0, 10),
      slot: preferredTimeSlot ?? kServiceTimeSlots.first,
    );
  }
}

class _TimingCard extends StatelessWidget {
  const _TimingCard({
    required this.icon,
    required this.tint,
    required this.title,
    required this.caption,
    required this.selected,
    required this.enabled,
    required this.onTap,
    super.key,
  });

  final IconData icon;
  final Color tint;
  final String title;
  final String caption;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final Color border = selected ? colors.primary : colors.border;
    return Semantics(
      selected: selected,
      enabled: enabled,
      button: true,
      label: title,
      child: Opacity(
        opacity: enabled ? 1 : 0.45,
        child: TamamPressable(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(TamamRadius.card),
          child: AnimatedContainer(
            duration: TamamMotion.durationFast,
            padding: const EdgeInsets.all(TamamSpacing.s3),
            decoration: BoxDecoration(
              color: selected ? colors.surfaceBrandSoft : colors.surface,
              borderRadius: BorderRadius.circular(TamamRadius.card),
              border: Border.all(color: border, width: selected ? 1.5 : 1),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Container(
                  width: 36,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: tint.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(TamamRadius.sm),
                  ),
                  child: Icon(icon, color: tint, size: TamamSize.iconMd),
                ),
                const SizedBox(height: TamamSpacing.s2),
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TamamType.labelLg.toTextStyle(
                    color: selected ? colors.primaryInk : colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  caption,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style:
                      TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
