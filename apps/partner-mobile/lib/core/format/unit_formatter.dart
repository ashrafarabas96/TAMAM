import 'package:intl/intl.dart';

/// Locale-aware formatting for dates, durations and distances.
///
/// All human-facing wording comes from the ARB catalogue; this class only
/// produces the numeric parts and the patterns `intl` already localises.
class UnitFormatter {
  UnitFormatter(this.localeName)
      : _dayMonth = DateFormat('d MMM', localeName),
        _dayMonthYear = DateFormat('d MMM y', localeName),
        _time = DateFormat.Hm(localeName),
        _weekdayTime = DateFormat('EEEE • HH:mm', localeName),
        _number = NumberFormat.decimalPattern(localeName);

  final String localeName;
  final DateFormat _dayMonth;
  final DateFormat _dayMonthYear;
  final DateFormat _time;
  final DateFormat _weekdayTime;
  final NumberFormat _number;

  String date(DateTime value) => _dayMonth.format(value);

  String dateWithYear(DateTime value) => _dayMonthYear.format(value);

  String time(DateTime value) => _time.format(value);

  String weekdayTime(DateTime value) => _weekdayTime.format(value);

  /// `12 Mar • 18:40`
  String dateTime(DateTime value) => '${_dayMonth.format(value)} • ${_time.format(value)}';

  String number(num value) => _number.format(value);

  /// `12` (minutes) — the caller appends the localised unit.
  String minutesValue(int seconds) => _number.format((seconds / 60).round().clamp(1, 1 << 30));

  /// `1.4` for 1,400 m, `640` for 640 m. Pair with [isKilometres].
  String distanceValue(int meters) =>
      isKilometres(meters) ? NumberFormat('#0.#', localeName).format(meters / 1000) : _number.format(meters);

  bool isKilometres(int meters) => meters >= 1000;

  /// Splits an ETA into hours + minutes so the caller can pick the right plural.
  ({int hours, int minutes}) splitDuration(int seconds) {
    final int totalMinutes = (seconds / 60).round();
    return (hours: totalMinutes ~/ 60, minutes: totalMinutes % 60);
  }
}
