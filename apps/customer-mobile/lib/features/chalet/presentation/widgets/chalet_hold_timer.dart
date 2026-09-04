import 'dart:async';

import 'package:flutter/material.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// Counts down the hold, and says so when it runs out.
///
/// The hold is the promise that nobody can take the slot while the customer
/// pays, so the countdown is shown rather than left implicit: a customer who
/// does not know there is a clock cannot be annoyed by it, but one who is timed
/// out without warning has been treated badly.
///
/// The timer is the source of the elapsed time — it is never `DateTime.now()`
/// read from an uncancellable future — so disposing the widget really does stop
/// the work.
class ChaletHoldTimer extends StatefulWidget {
  const ChaletHoldTimer({
    required this.expiresAt,
    super.key,
    this.onExpired,
    this.now = DateTime.now,
  });

  final DateTime expiresAt;
  final VoidCallback? onExpired;

  /// Where the time comes from.
  ///
  /// Wall-clock rather than elapsed ticks, so a hold that lapses while the app
  /// is backgrounded is correct the moment it comes back — a counter that only
  /// decrements on a running timer would show four minutes left on a hold that
  /// expired ten minutes ago. Injectable so a test can drive it.
  final DateTime Function() now;

  @override
  State<ChaletHoldTimer> createState() => _ChaletHoldTimerState();
}

class _ChaletHoldTimerState extends State<ChaletHoldTimer> {
  Timer? _ticker;
  late Duration _remaining;
  bool _notified = false;

  @override
  void initState() {
    super.initState();
    _remaining = _timeLeft();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  @override
  void didUpdateWidget(ChaletHoldTimer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.expiresAt != widget.expiresAt) {
      _notified = false;
      setState(() => _remaining = _timeLeft());
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _ticker = null;
    super.dispose();
  }

  Duration _timeLeft() {
    final Duration left = widget.expiresAt.difference(widget.now());
    return left.isNegative ? Duration.zero : left;
  }

  void _tick() {
    if (!mounted) return;
    final Duration left = _timeLeft();
    setState(() => _remaining = left);
    if (left == Duration.zero && !_notified) {
      _notified = true;
      _ticker?.cancel();
      _ticker = null;
      widget.onExpired?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    final AppLocalizations l10n = context.l10n;
    final bool expired = _remaining == Duration.zero;
    // Under a minute the countdown turns urgent; it is the last chance to pay.
    final bool urgent = !expired && _remaining.inSeconds <= 60;

    final Color tint = expired
        ? colors.danger
        : urgent
            ? colors.warning
            : colors.primary;

    return Semantics(
      liveRegion: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: expired
              ? colors.dangerSoft
              : urgent
                  ? colors.warningSoft
                  : colors.surfaceBrandSoft,
          borderRadius: BorderRadius.circular(TamamRadius.card),
        ),
        child: Padding(
          padding: const EdgeInsets.all(TamamSpacing.s4),
          child: Row(
            children: <Widget>[
              Icon(expired ? Icons.timer_off_rounded : Icons.timer_rounded, color: tint),
              const SizedBox(width: TamamSpacing.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      expired ? l10n.chaletHoldExpired : l10n.chaletHoldTitle,
                      style: Theme.of(context)
                          .textTheme
                          .titleSmall
                          ?.copyWith(color: colors.textPrimary),
                    ),
                    if (!expired) ...<Widget>[
                      const SizedBox(height: TamamSpacing.s1),
                      Text(
                        l10n.chaletHoldRemaining(formatRemaining(_remaining)),
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: tint, fontWeight: FontWeight.w600),
                      ),
                    ],
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

/// `m:ss` — the shape a countdown is read in, in either language.
String formatRemaining(Duration remaining) {
  final int minutes = remaining.inMinutes;
  final int seconds = remaining.inSeconds % 60;
  return '$minutes:${seconds.toString().padLeft(2, '0')}';
}
