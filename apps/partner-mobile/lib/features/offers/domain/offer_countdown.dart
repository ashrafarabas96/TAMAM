/// The arithmetic behind the countdown ring, kept free of widgets and timers
/// so it can be pinned down by a unit test.
///
/// The ring's *total* is the window this device actually had — from the
/// moment the offer arrived to `expiresAt` — not the server's nominal TTL.
/// An offer that reached the phone late (push delay, reconnect) therefore
/// starts with a partially drained ring instead of promising time the partner
/// does not have.
class OfferCountdown {
  const OfferCountdown({required this.receivedAt, required this.expiresAt});

  final DateTime receivedAt;
  final DateTime expiresAt;

  /// The full window the ring represents. Never negative.
  Duration get total {
    final Duration window = expiresAt.difference(receivedAt);
    return window.isNegative ? Duration.zero : window;
  }

  /// Time left at [now], clamped at zero.
  Duration remaining(DateTime now) {
    final Duration left = expiresAt.difference(now);
    return left.isNegative ? Duration.zero : left;
  }

  bool isExpired(DateTime now) => remaining(now) == Duration.zero;

  /// 1.0 with the whole window left, 0.0 at expiry.
  double progress(DateTime now) {
    final int totalMs = total.inMilliseconds;
    if (totalMs <= 0) return 0;
    return (remaining(now).inMilliseconds / totalMs).clamp(0.0, 1.0);
  }

  /// Whole seconds shown inside the ring — rounded *up* so the last second
  /// reads "1", never a premature "0" while the offer is still acceptable.
  int secondsLabel(DateTime now) {
    final int ms = remaining(now).inMilliseconds;
    if (ms <= 0) return 0;
    return (ms + 999) ~/ 1000;
  }

  /// The ring turns red in the last [urgentWindow].
  bool isUrgent(DateTime now, {Duration urgentWindow = const Duration(seconds: 5)}) =>
      !isExpired(now) && remaining(now) <= urgentWindow;
}
