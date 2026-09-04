import 'package:flutter/material.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/features/chalet/domain/owner_chalet.dart';

/// Occupancy by weekday, as bars an owner can read at a glance.
///
/// "60% booked" tells an owner little. "Your Sundays are always empty" tells
/// them what to discount — which is the whole reason the breakdown exists, so
/// the quietest day is marked rather than left to be spotted.
class WeekdayOccupancyChart extends StatelessWidget {
  const WeekdayOccupancyChart({required this.days, super.key});

  final List<ChaletDayStat> days;

  @override
  Widget build(BuildContext context) {
    if (days.isEmpty) return const SizedBox.shrink();

    final TamamColors colors = context.colors;
    final int busiest = days.fold<int>(0, (int max, ChaletDayStat d) =>
        d.bookedMinutes > max ? d.bookedMinutes : max);
    final ChaletDayStat quietest = days.reduce(
      (ChaletDayStat a, ChaletDayStat b) => a.bookedMinutes <= b.bookedMinutes ? a : b,
    );
    final List<String> names = MaterialLocalizations.of(context).narrowWeekdays;

    return SizedBox(
      height: 120,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: days.map((ChaletDayStat day) {
          // An empty week must not divide by zero, and every bar keeps a
          // sliver of height so the axis still reads as seven days.
          final double fraction = busiest == 0 ? 0 : day.bookedMinutes / busiest;
          final bool isQuietest = busiest > 0 && day.dayOfWeek == quietest.dayOfWeek;

          return Expanded(
            child: Semantics(
              // One label per bar. Without container/exclude, the number and
              // the weekday letter drawn inside merge into it and a screen
              // reader announces "Sun 48% 48 S" — the same fact three times.
              container: true,
              excludeSemantics: true,
              label: '${names[day.dayOfWeek % 7]} ${day.occupancyPercent}%',
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: <Widget>[
                    Text(
                      '${day.occupancyPercent}',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: colors.textTertiary,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Expanded(
                      child: FractionallySizedBox(
                        heightFactor: fraction.clamp(0.04, 1),
                        alignment: Alignment.bottomCenter,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: isQuietest ? colors.warning : colors.primary,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const SizedBox(width: double.infinity),
                        ),
                      ),
                    ),
                    const SizedBox(height: TamamSpacing.s1),
                    Text(
                      names[day.dayOfWeek % 7],
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: isQuietest ? colors.warning : colors.textSecondary,
                            fontWeight: isQuietest ? FontWeight.w700 : FontWeight.w400,
                          ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(growable: false),
      ),
    );
  }
}

/// Occupancy by hour of the day, so an owner can see which part of the day sells.
class HourOccupancyChart extends StatelessWidget {
  const HourOccupancyChart({required this.hours, super.key});

  final List<ChaletHourStat> hours;

  @override
  Widget build(BuildContext context) {
    if (hours.isEmpty) return const SizedBox.shrink();
    final TamamColors colors = context.colors;
    final int busiest = hours.fold<int>(0, (int max, ChaletHourStat h) =>
        h.bookedMinutes > max ? h.bookedMinutes : max);

    return SizedBox(
      height: 72,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: hours.map((ChaletHourStat hour) {
          final double fraction = busiest == 0 ? 0 : hour.bookedMinutes / busiest;
          // Every third hour is labelled; twenty-four labels would be a smear.
          final bool labelled = hour.hour % 6 == 0;

          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 1),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: <Widget>[
                  Expanded(
                    child: FractionallySizedBox(
                      heightFactor: fraction.clamp(0.03, 1),
                      alignment: Alignment.bottomCenter,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: fraction == 0 ? colors.border : colors.primary,
                          borderRadius: BorderRadius.circular(2),
                        ),
                        child: const SizedBox(width: double.infinity),
                      ),
                    ),
                  ),
                  const SizedBox(height: 2),
                  SizedBox(
                    height: 12,
                    child: labelled
                        ? Text(
                            '${hour.hour}',
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  fontSize: 9,
                                  color: colors.textTertiary,
                                ),
                          )
                        : null,
                  ),
                ],
              ),
            ),
          );
        }).toList(growable: false),
      ),
    );
  }
}
