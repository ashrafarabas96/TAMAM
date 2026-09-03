import 'package:tamam_partner/core/models/geo.dart';
import 'package:tamam_partner/core/models/json.dart';

/// Accumulates GPS samples between uploads and hands them out in batches the
/// API accepts (`locationBatchSchema`: 1..50 samples).
///
/// Pure Dart on purpose: the rules that decide what is worth sending are the
/// ones most likely to burn battery or get samples rejected, so they live here
/// where a unit test can pin them down.
///
/// Rules:
///  * samples older than [maxAge] are dropped — the server rejects them with
///    `STALE_LOCATION` anyway, and re-sending old points wastes radio;
///  * samples with accuracy worse than [maxAccuracyMeters] are dropped — the
///    server ignores them and they only make the customer's map jitter;
///  * duplicate timestamps are dropped (the OS occasionally replays a fix);
///  * the queue is bounded by [maxQueued]; when full the oldest sample goes,
///    because the freshest position is always the most valuable one.
class LocationBatcher {
  LocationBatcher({
    this.maxBatch = 50,
    this.maxAge = const Duration(seconds: 60),
    this.maxAccuracyMeters = 150,
    this.maxQueued = 200,
  }) : assert(maxBatch >= 1 && maxBatch <= 50, 'the API accepts 1..50 samples per batch');

  final int maxBatch;
  final Duration maxAge;
  final double maxAccuracyMeters;
  final int maxQueued;

  final List<LocationSample> _queue = <LocationSample>[];

  int get length => _queue.length;
  bool get isEmpty => _queue.isEmpty;
  bool get isNotEmpty => _queue.isNotEmpty;

  /// The newest sample held, if any — what the heartbeat sends as `location`.
  LocationSample? get latest => _queue.isEmpty ? null : _queue.last;

  /// Adds a sample; returns `true` when it was kept.
  bool add(LocationSample sample, {DateTime? now}) {
    final DateTime clock = (now ?? DateTime.now()).toUtc();
    if (clock.difference(sample.timestamp.toUtc()) > maxAge) return false;
    if (sample.accuracy > maxAccuracyMeters) return false;
    for (final LocationSample existing in _queue) {
      if (existing.timestamp.isAtSameMomentAs(sample.timestamp)) return false;
    }
    _queue.add(sample);
    while (_queue.length > maxQueued) {
      _queue.removeAt(0);
    }
    return true;
  }

  /// Removes and returns the next batch (oldest first), skipping anything that
  /// went stale while waiting. Empty when nothing is worth sending.
  List<LocationSample> take({DateTime? now}) {
    final DateTime clock = (now ?? DateTime.now()).toUtc();
    _queue.removeWhere((LocationSample s) => clock.difference(s.timestamp.toUtc()) > maxAge);
    if (_queue.isEmpty) return const <LocationSample>[];
    final int count = _queue.length < maxBatch ? _queue.length : maxBatch;
    final List<LocationSample> batch = _queue.sublist(0, count);
    _queue.removeRange(0, count);
    return batch;
  }

  /// Puts a failed batch back at the front so ordering is preserved; anything
  /// beyond [maxQueued] is dropped from the *old* end.
  void requeue(List<LocationSample> batch) {
    _queue.insertAll(0, batch);
    while (_queue.length > maxQueued) {
      _queue.removeAt(0);
    }
  }

  void clear() => _queue.clear();

  /// Snapshot for persistence across a process death.
  List<JsonMap> toJson() => _queue.map((LocationSample s) => s.toJson()).toList(growable: false);

  /// Restores a snapshot; stale entries are discarded on the next [take].
  void restore(List<JsonMap> raw) {
    for (final JsonMap json in raw) {
      _queue.add(LocationSample.fromJson(json));
    }
    while (_queue.length > maxQueued) {
      _queue.removeAt(0);
    }
  }
}

/// How often the app uploads and how eagerly it listens, per work mode.
///
/// The server pushes `tracking:config { intervalSeconds }` for the current
/// mode on connect; these defaults cover the gap until it arrives and the case
/// where a job is accepted mid-session (the server does not re-push then).
class TrackingCadence {
  const TrackingCadence({
    this.idleIntervalSeconds = 20,
    this.activeIntervalSeconds = 4,
    this.idleDistanceFilterMeters = 25,
    this.activeDistanceFilterMeters = 10,
    this.serverIntervalSeconds,
  });

  /// Upload interval while online without a job (server default: 20 s).
  final int idleIntervalSeconds;

  /// Upload interval while on a job (server default: 4 s).
  final int activeIntervalSeconds;

  /// Metres the device must move before the OS wakes the stream — the real
  /// battery lever: a parked partner produces almost no samples.
  final int idleDistanceFilterMeters;
  final int activeDistanceFilterMeters;

  /// The last `tracking:config` value; applies to whichever mode was active
  /// when it arrived, and is never allowed to exceed the built-in defaults for
  /// an active job so a customer never waits on a slow server setting.
  final int? serverIntervalSeconds;

  static const int minIntervalSeconds = 2;
  static const int maxIntervalSeconds = 120;

  int intervalFor({required bool activeJob}) {
    final int base = activeJob ? activeIntervalSeconds : idleIntervalSeconds;
    final int? server = serverIntervalSeconds;
    if (server == null) return base;
    final int effective = activeJob ? (server < base ? server : base) : server;
    return effective.clamp(minIntervalSeconds, maxIntervalSeconds);
  }

  int distanceFilterFor({required bool activeJob}) =>
      activeJob ? activeDistanceFilterMeters : idleDistanceFilterMeters;

  TrackingCadence withServerInterval(int? seconds) => TrackingCadence(
        idleIntervalSeconds: idleIntervalSeconds,
        activeIntervalSeconds: activeIntervalSeconds,
        idleDistanceFilterMeters: idleDistanceFilterMeters,
        activeDistanceFilterMeters: activeDistanceFilterMeters,
        serverIntervalSeconds: seconds == null ? null : seconds.clamp(minIntervalSeconds, maxIntervalSeconds),
      );
}
