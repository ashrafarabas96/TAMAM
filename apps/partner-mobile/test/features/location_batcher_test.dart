import 'package:flutter_test/flutter_test.dart';
import 'package:tamam_partner/core/models/geo.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/features/location/domain/location_batcher.dart';

LocationSample _sample(DateTime at, {double accuracy = 10}) =>
    LocationSample(lat: 31.9038, lng: 35.2034, accuracy: accuracy, timestamp: at);

/// The batcher decides what is worth putting on the radio while a shift runs.
/// Getting it wrong burns the partner's battery or gets samples rejected, so
/// every rule is pinned down here.
void main() {
  final DateTime now = DateTime.utc(2026, 3, 12, 18, 40, 0);

  group('add', () {
    test('keeps a fresh, accurate sample', () {
      final LocationBatcher batcher = LocationBatcher();

      expect(batcher.add(_sample(now), now: now), isTrue);
      expect(batcher.length, 1);
      expect(batcher.isNotEmpty, isTrue);
    });

    test('drops a sample older than maxAge — the server rejects it anyway', () {
      final LocationBatcher batcher = LocationBatcher(maxAge: const Duration(seconds: 60));

      expect(batcher.add(_sample(now.subtract(const Duration(seconds: 61))), now: now), isFalse);
      expect(batcher.isEmpty, isTrue);
    });

    test('keeps a sample exactly at the age limit', () {
      final LocationBatcher batcher = LocationBatcher(maxAge: const Duration(seconds: 60));

      expect(batcher.add(_sample(now.subtract(const Duration(seconds: 60))), now: now), isTrue);
    });

    test('drops an inaccurate sample rather than jittering the customer map', () {
      final LocationBatcher batcher = LocationBatcher(maxAccuracyMeters: 150);

      expect(batcher.add(_sample(now, accuracy: 151), now: now), isFalse);
      expect(batcher.add(_sample(now, accuracy: 150), now: now), isTrue);
    });

    test('drops a replayed timestamp', () {
      final LocationBatcher batcher = LocationBatcher();

      expect(batcher.add(_sample(now), now: now), isTrue);
      expect(batcher.add(_sample(now), now: now), isFalse);
      expect(batcher.length, 1);
    });

    test('bounds the queue by dropping the oldest, keeping the freshest fix', () {
      final LocationBatcher batcher = LocationBatcher(maxQueued: 3, maxAge: const Duration(hours: 1));
      for (int i = 0; i < 6; i++) {
        batcher.add(_sample(now.subtract(Duration(seconds: 10 - i))), now: now);
      }

      expect(batcher.length, 3);
      // The newest sample survived; the oldest did not.
      expect(batcher.latest!.timestamp, now.subtract(const Duration(seconds: 5)));
    });
  });

  group('take', () {
    test('returns oldest first and empties what it took', () {
      final LocationBatcher batcher = LocationBatcher(maxAge: const Duration(hours: 1));
      for (int i = 3; i >= 1; i--) {
        batcher.add(_sample(now.subtract(Duration(seconds: i))), now: now);
      }

      final List<LocationSample> batch = batcher.take(now: now);

      expect(batch.length, 3);
      expect(batch.first.timestamp, now.subtract(const Duration(seconds: 3)));
      expect(batch.last.timestamp, now.subtract(const Duration(seconds: 1)));
      expect(batcher.isEmpty, isTrue);
    });

    test('never exceeds maxBatch, which the API caps at 50', () {
      final LocationBatcher batcher = LocationBatcher(maxBatch: 2, maxAge: const Duration(hours: 1));
      for (int i = 0; i < 5; i++) {
        batcher.add(_sample(now.subtract(Duration(seconds: 5 - i))), now: now);
      }

      expect(batcher.take(now: now).length, 2);
      expect(batcher.length, 3);
    });

    test('discards samples that went stale while queued', () {
      final LocationBatcher batcher = LocationBatcher(maxAge: const Duration(seconds: 60));
      batcher.add(_sample(now), now: now);

      // Two minutes later nothing in the queue is worth sending.
      expect(batcher.take(now: now.add(const Duration(minutes: 2))), isEmpty);
      expect(batcher.isEmpty, isTrue);
    });

    test('is empty when there is nothing to send', () {
      expect(LocationBatcher().take(now: now), isEmpty);
    });

    test('rejects a batch size the API would not accept', () {
      expect(() => LocationBatcher(maxBatch: 0), throwsA(isA<AssertionError>()));
      expect(() => LocationBatcher(maxBatch: 51), throwsA(isA<AssertionError>()));
    });
  });

  group('requeue', () {
    test('puts a failed batch back at the front so ordering survives', () {
      final LocationBatcher batcher = LocationBatcher(maxAge: const Duration(hours: 1));
      batcher.add(_sample(now.subtract(const Duration(seconds: 3))), now: now);
      final List<LocationSample> failed = batcher.take(now: now);

      batcher.add(_sample(now), now: now);
      batcher.requeue(failed);

      final List<LocationSample> batch = batcher.take(now: now);
      expect(batch.first.timestamp, now.subtract(const Duration(seconds: 3)));
      expect(batch.last.timestamp, now);
    });

    test('drops from the old end when a requeue overflows the queue', () {
      final LocationBatcher batcher = LocationBatcher(maxQueued: 2, maxAge: const Duration(hours: 1));
      batcher.add(_sample(now), now: now);

      batcher.requeue(<LocationSample>[
        _sample(now.subtract(const Duration(seconds: 9))),
        _sample(now.subtract(const Duration(seconds: 8))),
      ]);

      expect(batcher.length, 2);
      expect(batcher.latest!.timestamp, now);
    });
  });

  group('persistence', () {
    test('survives a process death through toJson/restore', () {
      final LocationBatcher batcher = LocationBatcher(maxAge: const Duration(hours: 1));
      batcher.add(_sample(now.subtract(const Duration(seconds: 2))), now: now);
      batcher.add(_sample(now), now: now);

      final List<JsonMap> snapshot = batcher.toJson();
      final LocationBatcher restored = LocationBatcher(maxAge: const Duration(hours: 1))..restore(snapshot);

      expect(restored.length, 2);
      expect(restored.take(now: now).length, 2);
    });

    test('clear empties the queue', () {
      final LocationBatcher batcher = LocationBatcher()..add(_sample(now), now: now);
      batcher.clear();

      expect(batcher.isEmpty, isTrue);
      expect(batcher.latest, isNull);
    });
  });

  group('TrackingCadence', () {
    test('uploads far more often on a job than while idle', () {
      const TrackingCadence cadence = TrackingCadence();

      expect(cadence.intervalFor(activeJob: false), 20);
      expect(cadence.intervalFor(activeJob: true), 4);
    });

    test('moves the distance filter with the mode — the real battery lever', () {
      const TrackingCadence cadence = TrackingCadence();

      expect(cadence.distanceFilterFor(activeJob: false), 25);
      expect(cadence.distanceFilterFor(activeJob: true), 10);
    });

    test('accepts a slower server interval while idle', () {
      final TrackingCadence cadence = const TrackingCadence().withServerInterval(45);

      expect(cadence.intervalFor(activeJob: false), 45);
    });

    test('never lets a slow server setting delay an active job', () {
      final TrackingCadence cadence = const TrackingCadence().withServerInterval(60);

      // On a job the built-in 4 s wins, so a customer never waits on config.
      expect(cadence.intervalFor(activeJob: true), 4);
    });

    test('lets the server speed up an active job within the safety bounds', () {
      final TrackingCadence cadence = const TrackingCadence().withServerInterval(3);

      expect(cadence.intervalFor(activeJob: true), 3);
    });

    test('clamps an out-of-range server interval', () {
      expect(const TrackingCadence().withServerInterval(1).serverIntervalSeconds,
          TrackingCadence.minIntervalSeconds);
      expect(const TrackingCadence().withServerInterval(9999).serverIntervalSeconds,
          TrackingCadence.maxIntervalSeconds);
    });

    test('falls back to the defaults when the server has not spoken', () {
      final TrackingCadence cadence = const TrackingCadence().withServerInterval(null);

      expect(cadence.serverIntervalSeconds, isNull);
      expect(cadence.intervalFor(activeJob: false), 20);
    });
  });
}
