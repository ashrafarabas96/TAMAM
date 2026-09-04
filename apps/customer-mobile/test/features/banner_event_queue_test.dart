import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
// `Headers` would clash with Dio's; only the enums are needed here.
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart' hide Headers;
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/api_client.dart';
import 'package:tamam_customer/core/storage/prefs_store.dart';
import 'package:tamam_customer/features/banners/data/banner_event_queue.dart';

/// Captures `POST /banners/events` bodies and can be told to fail, so the
/// queue's retry behaviour is observable.
class _RecordingAdapter implements HttpClientAdapter {
  _RecordingAdapter({this.failing = false});

  bool failing;
  final List<JsonMap> batches = <JsonMap>[];

  int get eventCount =>
      batches.fold(0, (int sum, JsonMap batch) => sum + (batch['events']! as List<Object?>).length);

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (failing) {
      throw DioException.connectionError(requestOptions: options, reason: 'offline');
    }
    final JsonMap? body = asJsonMap(options.data);
    if (body != null) batches.add(body);
    return ResponseBody.fromString('{"accepted":true}', 200, headers: <String, List<String>>{
      Headers.contentTypeHeader: <String>['application/json'],
    });
  }

  @override
  void close({bool force = false}) {}
}

BannerEventQueue _queue(
  _RecordingAdapter adapter,
  PrefsStore prefs, {
  int threshold = 20,
  Duration interval = const Duration(milliseconds: 40),
}) {
  final Dio dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'))..httpClientAdapter = adapter;
  return BannerEventQueue(
    api: ApiClient(dio),
    prefs: prefs,
    sessionId: 'session-abcdef123456',
    flushInterval: interval,
    flushThreshold: threshold,
  );
}

Future<PrefsStore> _prefs([Map<String, Object> initial = const <String, Object>{}]) async {
  SharedPreferences.setMockInitialValues(initial);
  return PrefsStore(await SharedPreferences.getInstance());
}

/// Waits for an asynchronous outcome instead of sleeping a fixed amount.
///
/// The flush this file exercises is asynchronous, and a flat 50ms wait passes
/// on an idle machine while failing on a busy one -- a red build that says
/// nothing about the code. Polling for the outcome removes the race without
/// slowing the test down.
Future<void> _waitUntil(
  bool Function() done, {
  Duration timeout = const Duration(seconds: 5),
}) async {
  final DateTime deadline = DateTime.now().add(timeout);
  while (!done() && DateTime.now().isBefore(deadline)) {
    await Future<void>.delayed(const Duration(milliseconds: 5));
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('BannerEventQueue', () {
    test('records one impression per banner per session', () async {
      final _RecordingAdapter adapter = _RecordingAdapter();
      final BannerEventQueue queue = _queue(adapter, await _prefs());

      queue.recordImpression(trackingToken: 'token-aaaaaaaaaa', placement: BannerPlacement.homeHero);
      queue.recordImpression(trackingToken: 'token-aaaaaaaaaa', placement: BannerPlacement.homeHero);
      queue.recordImpression(trackingToken: 'token-bbbbbbbbbb', placement: BannerPlacement.homeHero);

      expect(queue.pendingCount, 2);
      await queue.dispose();
    });

    test('still records repeated clicks — only impressions are de-duplicated', () async {
      final _RecordingAdapter adapter = _RecordingAdapter();
      final BannerEventQueue queue = _queue(adapter, await _prefs());

      queue
        ..recordClick(trackingToken: 'token-aaaaaaaaaa', placement: BannerPlacement.homeHero)
        ..recordClick(trackingToken: 'token-aaaaaaaaaa', placement: BannerPlacement.homeHero);

      expect(queue.pendingCount, 2);
      await queue.dispose();
    });

    test('drops events whose tracking token or session is too short to attribute', () async {
      final _RecordingAdapter adapter = _RecordingAdapter();
      final BannerEventQueue queue = _queue(adapter, await _prefs());

      queue.recordImpression(trackingToken: 'short', placement: BannerPlacement.homeInline);

      expect(queue.pendingCount, 0);
      await queue.dispose();
    });

    test('flushes automatically once the threshold is reached', () async {
      final _RecordingAdapter adapter = _RecordingAdapter();
      final BannerEventQueue queue = _queue(adapter, await _prefs(), threshold: 3);

      for (int i = 0; i < 3; i++) {
        queue.recordImpression(
          trackingToken: 'token-${i.toString().padLeft(10, '0')}',
          placement: BannerPlacement.homeHero,
        );
      }
      // The queue is only settled once it has both sent the batch and
      // cleared it -- waiting on the send alone still races the clear.
      await _waitUntil(() => adapter.eventCount >= 3 && queue.pendingCount == 0);

      expect(adapter.eventCount, 3);
      expect(queue.pendingCount, 0);
      await queue.dispose();
    });

    test('keeps the batch queued when the flush fails, and sends it on the next try', () async {
      final _RecordingAdapter adapter = _RecordingAdapter(failing: true);
      // No auto-flush: this test drives every flush explicitly.
      final BannerEventQueue queue = _queue(adapter, await _prefs(), threshold: 99);

      queue
        ..recordClick(trackingToken: 'token-1111111111', placement: BannerPlacement.homeHero)
        ..recordClick(trackingToken: 'token-2222222222', placement: BannerPlacement.homeHero);
      await queue.flush();

      expect(adapter.eventCount, 0);
      expect(queue.pendingCount, 2, reason: 'a failed flush must not lose events');

      adapter.failing = false;
      await queue.flush();

      expect(adapter.eventCount, 2);
      expect(queue.pendingCount, 0);
      await queue.dispose();
    });

    test('persists the backlog so it survives a restart', () async {
      SharedPreferences.setMockInitialValues(<String, Object>{});
      final SharedPreferences preferences = await SharedPreferences.getInstance();
      final PrefsStore store = PrefsStore(preferences);

      final _RecordingAdapter offline = _RecordingAdapter(failing: true);
      final BannerEventQueue first = _queue(offline, store, threshold: 99);
      first.recordImpression(trackingToken: 'token-3333333333', placement: BannerPlacement.homeHero);
      await first.dispose();

      // A brand-new queue over the same storage sees the pending event.
      final _RecordingAdapter online = _RecordingAdapter();
      final BannerEventQueue restored = _queue(online, store, threshold: 99);
      expect(restored.pendingCount, 1);

      await restored.flush();
      expect(online.eventCount, 1);
      await restored.dispose();
    });

    test('serialises an event into the shape the API validates', () {
      final BannerEvent event = BannerEvent(
        trackingToken: 'token-4444444444',
        type: BannerEventType.click,
        occurredAt: DateTime.utc(2026, 3, 1, 12),
        placement: BannerPlacement.orderTracking,
        sessionId: 'session-abcdef123456',
      );
      final JsonMap json = event.toJson();

      expect(json['type'], 'CLICK');
      expect(json['placement'], 'ORDER_TRACKING');
      expect(json['occurredAt'], '2026-03-01T12:00:00.000Z');
      expect(BannerEvent.fromJson(json).trackingToken, event.trackingToken);
    });
  });
}
