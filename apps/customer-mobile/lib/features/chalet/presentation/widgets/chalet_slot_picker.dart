import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/features/chalet/domain/chalet.dart';
import 'package:tamam_customer/features/chalet/domain/chalet_booking.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Picks a start time from the ones the server said are workable.
///
/// The list is not computed here. The server returned start times that already
/// account for other bookings, owner blocks, opening hours, the chalet's own
/// booking grid and the cleaning that follows every stay — so every chip shown
/// is a time that will actually be accepted. Working any of that out on the
/// phone would mean a second implementation of the rules, and the one that
/// drifts is always the one the customer sees.
class ChaletSlotPicker extends ConsumerWidget {
  const ChaletSlotPicker({
    required this.availability,
    required this.scheduling,
    required this.selectedStart,
    required this.onSelect,
    super.key,
  });

  final ChaletAvailability availability;
  final ChaletScheduling scheduling;
  final DateTime? selectedStart;
  final ValueChanged<DateTime> onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final TamamColors colors = context.colors;
    final AppLocalizations l10n = context.l10n;

    if (availability.startTimes.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: TamamSpacing.s6),
        child: Column(
          children: <Widget>[
            Icon(Icons.event_busy_rounded, size: 40, color: colors.textTertiary),
            const SizedBox(height: TamamSpacing.s3),
            Text(
              l10n.chaletNoTimesToday,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(color: colors.textPrimary),
            ),
            const SizedBox(height: TamamSpacing.s1),
            Text(
              l10n.chaletNoTimesBody,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Wrap(
          spacing: TamamSpacing.s2,
          runSpacing: TamamSpacing.s2,
          children: availability.startTimes
              .map((DateTime at) => _TimeChip(
                    at: at,
                    selected: selectedStart == at,
                    onTap: () => onSelect(at),
                  ))
              .toList(growable: false),
        ),
        if (scheduling.cleaningDurationMinutes > 0) ...<Widget>[
          const SizedBox(height: TamamSpacing.s3),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(Icons.cleaning_services_rounded, size: 16, color: colors.textTertiary),
              const SizedBox(width: TamamSpacing.s2),
              Expanded(
                child: Text(
                  l10n.chaletCleaningNote(scheduling.cleaningDurationMinutes),
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: colors.textTertiary),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _TimeChip extends StatelessWidget {
  const _TimeChip({required this.at, required this.selected, required this.onTap});

  final DateTime at;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final TimeOfDay time = TimeOfDay.fromDateTime(at.toLocal());
    final String label = MaterialLocalizations.of(context).formatTimeOfDay(time);

    return Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: selected ? colors.primary : colors.surfaceAlt,
        borderRadius: BorderRadius.circular(TamamRadius.pill),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(TamamRadius.pill),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: TamamSpacing.s4,
              vertical: TamamSpacing.s2,
            ),
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: selected ? colors.textOnBrand : colors.textPrimary,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Picks how long the stay is, from the durations the chalet allows.
class ChaletDurationPicker extends StatelessWidget {
  const ChaletDurationPicker({
    required this.scheduling,
    required this.selectedMinutes,
    required this.onSelect,
    super.key,
  });

  final ChaletScheduling scheduling;
  final int selectedMinutes;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: scheduling.selectableDurations.length,
        separatorBuilder: (_, __) => const SizedBox(width: TamamSpacing.s2),
        itemBuilder: (BuildContext context, int index) {
          final int minutes = scheduling.selectableDurations[index];
          final bool selected = minutes == selectedMinutes;
          return Semantics(
            button: true,
            selected: selected,
            child: Material(
              color: selected ? colors.primary : colors.surfaceAlt,
              borderRadius: BorderRadius.circular(TamamRadius.pill),
              child: InkWell(
                onTap: () => onSelect(minutes),
                borderRadius: BorderRadius.circular(TamamRadius.pill),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s4),
                  child: Center(
                    child: Text(
                      formatDuration(context, minutes),
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            color: selected ? colors.textOnBrand : colors.textPrimary,
                          ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// "4 hours" / "4½ hours" — the half is spelled rather than shown as 4.5.
String formatDuration(BuildContext context, int minutes) {
  final AppLocalizations l10n = context.l10n;
  final int hours = minutes ~/ 60;
  final int rest = minutes % 60;
  if (rest == 0) return l10n.chaletDurationHours('$hours');
  if (rest == 30) return l10n.chaletDurationHoursAndHalf('$hours');
  return '$hours:${rest.toString().padLeft(2, '0')}';
}
