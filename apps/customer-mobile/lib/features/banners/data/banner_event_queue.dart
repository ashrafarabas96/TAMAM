import 'dart:async';

import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/api_client.dart';
import 'package:tamam_customer/core/network/api_paths.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/core/storage/prefs_store.dart';

/// One queued analytics event.
class BannerEvent {
  const BannerEvent({
    required this.trackingToken,
    required this.type,
    required this.occurredAt,
    required this.placement,
    required this.sessionId,
  });

  factory BannerEvent.fromJson(JsonMap json) => BannerEvent(
        trackingToken: readStringOr(json, 'trackingToken', ''),
        type: BannerEventType.fromValue(readString(json, 'type')) ?? BannerEventType.impression,
        occurredAt: readDateTimeOr(json, 'occurredAt', DateTime.now()),
        placement: BannerPlacement.fromValue(readString(json, 'placement')) ?? BannerPlacement.homeHero,
        sessionId: readStringOr(json, 'sessionId', ''),
      );

  final String trackingToken;
  final BannerEventType type;
  final DateTime occurredAt;
  final BannerPlacement placement;
  final String sessionId;

  bool get isValid => trackingToken.length >= 10 && sessionId.length >= 8;

  JsonMap toJson() => <String, Object?>{
        'trackingToken': trackingToken,
        'type': type.value,
        'occurredAt': toIsoUtc(occurredAt),
        'placement': placement.value,
        'sessionId': sessionId,
      };
}

/// Batches banner impressions, clicks and dismissals and ships them to
/// `POST /banners/events`.
///
/// Guarantees that matter for reporting quality:
///  * events survive app restarts (persisted after every mutation);
///  * a flush that fails puts the batch back at the front of the queue;
///  * an impression is recorded at most once per banner per app session;
///  * the queue is bounded, so a long offline stretch cannot grow without limit.
class BannerEventQueue {
  BannerEventQueue({
    required ApiClient api,
    required PrefsStore prefs,
    required String sessionId,
    Duration flushInterval = const Duration(seconds: 10),
    int flushThreshold = 20,
  })  : _api = api,
        _prefs = prefs,
        _sessionId = sessionId,
        _flushInterval = flushInterval,
        _flushThreshold = flushThreshold {
    _restore();
  }

  /// The server accepts at most 200 events per request.
  static const int _batchSize = 100;

  /// Hard ceiling on the backlog; the oldest events are dropped first.
  static const int _maxQueued = 400;

  final ApiClient _api;
  final PrefsStore _prefs;
  final String _sessionId;
  final Duration _flushInterval;
  final int _flushThreshold;

  final List<BannerEvent> _queue = <BannerEvent>[];
  final Set<String> _impressionsThisSession = <String>{};
  Timer? _timer;
  bool _flushing = false;

  int get pendingCount => _queue.length;

  /// Records an impression once per banner per session (spec: ≥50 % visible for
  /// ≥1 s is enforced by the widget; de-duplication is enforced here).
  void recordImpression({required String trackingToken, required BannerPlacement placement}) {
    if (!_impressionsThisSession.add(trackingToken)) return;
    _enqueue(BannerEventType.impression, trackingToken, placement);
  }

  void recordClick({required String trackingToken, required BannerPlacement placement}) =>
      _enqueue(BannerEventType.click, trackingToken, placement);

  void recordDismiss({required String trackingToken, required BannerPlacement placement}) =>
      _enqueue(BannerEventType.dismiss, trackingToken, placement);

  /// Sends everything queued. Called on the timer, at the threshold, and when
  /// the app goes to the background.
  Future<void> flush() async {
    if (_flushing || _queue.isEmpty) return;
    _flushing = true;
    try {
      while (_queue.isNotEmpty) {
        final List<BannerEvent> batch = _queue.take(_batchSize).toList(growable: false);
        try {
          await _api.postObject(
            ApiPaths.bannerEvents,
            body: <String, Object?>{
              'events': batch.map((BannerEvent e) => e.toJson()).toList(growable: false),
            },
          );
        } on AppFailure {
          // Keep the batch; the next flush retries it.
          return;
        }
        _queue.removeRange(0, batch.length);
        await _persist();
      }
    } finally {
      _flushing = false;
    }
  }

  Future<void> dispose() async {
    _timer?.cancel();
    _timer = null;
    await _persist();
  }

  void _enqueue(BannerEventType type, String trackingToken, BannerPlacement placement) {
    final BannerEvent event = BannerEvent(
      trackingToken: trackingToken,
      type: type,
      occurredAt: DateTime.now(),
      placement: placement,
      sessionId: _sessionId,
    );
    if (!event.isValid) return;
    _queue.add(event);
    if (_queue.length > _maxQueued) _queue.removeRange(0, _queue.length - _maxQueued);
    unawaited(_persist());

    if (_queue.length >= _flushThreshold) {
      unawaited(flush());
    } else {
      _scheduleFlush();
    }
  }

  void _scheduleFlush() {
    _timer?.cancel();
    _timer = Timer(_flushInterval, () => unawaited(flush()));
  }

  void _restore() {
    for (final JsonMap json in _prefs.getJsonList(PrefsStore.keyBannerEventQueue)) {
      final BannerEvent event = BannerEvent.fromJson(json);
      if (event.isValid) _queue.add(event);
    }
    if (_queue.isNotEmpty) _scheduleFlush();
  }

  Future<void> _persist() => _prefs.setJsonList(
        PrefsStore.keyBannerEventQueue,
        _queue.map((BannerEvent e) => e.toJson()).toList(growable: false),
      );
}
