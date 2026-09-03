import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/device/device_metrics.dart';
import 'package:tamam_partner/core/maps/location_service.dart';
import 'package:tamam_partner/core/models/geo.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/realtime/realtime_providers.dart';
import 'package:tamam_partner/core/realtime/socket_client.dart';
import 'package:tamam_partner/core/storage/prefs_store.dart';
import 'package:tamam_partner/features/account/data/partner_repository.dart';
import 'package:tamam_partner/features/account/presentation/partner_providers.dart';
import 'package:tamam_partner/features/location/data/foreground_service.dart';
import 'package:tamam_partner/features/location/domain/location_batcher.dart';
import 'package:tamam_partner/features/location/presentation/location_providers.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Why a work session stopped — the home screen turns each into a sentence.
enum WorkSessionStopReason {
  /// The partner tapped OFFLINE (or was never online).
  user,

  /// The OS revoked (or the partner downgraded) the location permission.
  permissionRevoked,

  /// Device location services were switched off.
  serviceDisabled,

  /// The account signed out; everything was torn down.
  sessionEnded,

  /// The server marked the partner OFFLINE (missed heartbeats, admin action).
  serverOffline,
}

/// What the location pipeline is doing right now.
@immutable
class WorkSessionState {
  const WorkSessionState({
    this.running = false,
    this.backgroundCapable = false,
    this.activeJobId,
    this.lastSample,
    this.lastUploadAt,
    this.lastHeartbeatAt,
    this.pendingSamples = 0,
    this.intervalSeconds = 20,
    this.socketConnected = false,
    this.stopReason,
  });

  final bool running;

  /// `true` only with "always" permission; otherwise uploads stop when the app
  /// leaves the screen and the home banner says so.
  final bool backgroundCapable;
  final String? activeJobId;
  final LocationSample? lastSample;
  final DateTime? lastUploadAt;
  final DateTime? lastHeartbeatAt;
  final int pendingSamples;
  final int intervalSeconds;
  final bool socketConnected;
  final WorkSessionStopReason? stopReason;

  WorkSessionState copyWith({
    bool? running,
    bool? backgroundCapable,
    String? activeJobId,
    bool clearActiveJob = false,
    LocationSample? lastSample,
    DateTime? lastUploadAt,
    DateTime? lastHeartbeatAt,
    int? pendingSamples,
    int? intervalSeconds,
    bool? socketConnected,
    WorkSessionStopReason? stopReason,
    bool clearStopReason = false,
  }) =>
      WorkSessionState(
        running: running ?? this.running,
        backgroundCapable: backgroundCapable ?? this.backgroundCapable,
        activeJobId: clearActiveJob ? null : (activeJobId ?? this.activeJobId),
        lastSample: lastSample ?? this.lastSample,
        lastUploadAt: lastUploadAt ?? this.lastUploadAt,
        lastHeartbeatAt: lastHeartbeatAt ?? this.lastHeartbeatAt,
        pendingSamples: pendingSamples ?? this.pendingSamples,
        intervalSeconds: intervalSeconds ?? this.intervalSeconds,
        socketConnected: socketConnected ?? this.socketConnected,
        stopReason: clearStopReason ? null : (stopReason ?? this.stopReason),
      );
}

/// The continuous location + heartbeat pipeline that runs while ONLINE.
///
/// Battery budget (documented for ops):
///  * the OS stream is distance-filtered (25 m idle / 10 m on a job), so a
///    parked partner produces no samples and no radio traffic;
///  * uploads are batched on a timer — 20 s idle, 4 s on a job by default,
///    retuned live by `tracking:config` — and go over the socket when it is
///    up, over `POST /partners/me/location` otherwise;
///  * the heartbeat is a separate 30 s timer (server-adjustable) carrying
///    battery level and network type; a heartbeat answer of OFFLINE stops the
///    session, because the server is the source of truth for availability.
///
/// The controller never decides *whether* the partner is online — that is the
/// availability controller's job; this one only runs the pipeline it is told
/// to run, and reports why it had to stop.
class WorkSessionController extends Notifier<WorkSessionState> {
  static const Duration _defaultHeartbeat = Duration(seconds: 30);

  final LocationBatcher _batcher = LocationBatcher();
  TrackingCadence _cadence = const TrackingCadence();
  Duration _heartbeatInterval = _defaultHeartbeat;

  StreamSubscription<LocationSample>? _stream;
  StreamSubscription<JsonMap>? _config;
  StreamSubscription<SocketStatus>? _socketStatus;
  Timer? _uploadTimer;
  Timer? _heartbeatTimer;
  bool _flushing = false;

  /// Invoked when the pipeline stops for a reason the partner did not choose,
  /// so the availability controller can mirror it to the server and explain.
  void Function(WorkSessionStopReason reason)? onInvoluntaryStop;

  @override
  WorkSessionState build() {
    final PrefsStore prefs = ref.read(prefsStoreProvider);
    final int? saved = prefs.getInt(PrefsStore.keyTrackingInterval);
    _cadence = _cadence.withServerInterval(saved);
    _batcher.restore(prefs.getJsonList(PrefsStore.keyLocationQueue));

    final void Function() unregister =
        ref.read(sessionTeardownProvider).register(() => stop(WorkSessionStopReason.sessionEnded));
    ref.onDispose(() {
      unregister();
      _tearDownTimers();
      unawaited(_stream?.cancel());
      unawaited(_config?.cancel());
      unawaited(_socketStatus?.cancel());
    });
    return WorkSessionState(intervalSeconds: _cadence.intervalFor(activeJob: false));
  }

  LocationService get _location => ref.read(locationServiceProvider);
  PartnerRepository get _partners => ref.read(partnerRepositoryProvider);
  SocketClient get _socket => ref.read(trackingSocketProvider);

  /// Starts (or restarts) the pipeline. Returns `false` when location is not
  /// usable at all — the caller must not report ONLINE in that case.
  Future<bool> start({String? activeJobId, int? heartbeatIntervalSeconds}) async {
    final LocationAvailability availability = await _location.status();
    if (!availability.isUsable) {
      state = state.copyWith(
        running: false,
        stopReason: availability == LocationAvailability.serviceDisabled
            ? WorkSessionStopReason.serviceDisabled
            : WorkSessionStopReason.permissionRevoked,
      );
      return false;
    }
    if (heartbeatIntervalSeconds != null && heartbeatIntervalSeconds >= 10) {
      _heartbeatInterval = Duration(seconds: heartbeatIntervalSeconds);
    }

    await _stream?.cancel();
    state = state.copyWith(
      running: true,
      backgroundCapable: availability.isBackgroundCapable,
      activeJobId: activeJobId,
      clearActiveJob: activeJobId == null,
      clearStopReason: true,
      intervalSeconds: _cadence.intervalFor(activeJob: activeJobId != null),
    );

    await _startForegroundService();
    await _attachSocket();
    _subscribeStream();
    _restartTimers();
    unawaited(_heartbeat());
    return true;
  }

  /// Switches cadence when a job is accepted or finished.
  Future<void> setActiveJob(String? jobId) async {
    if (state.activeJobId == jobId) return;
    state = state.copyWith(activeJobId: jobId, clearActiveJob: jobId == null);
    if (!state.running) return;
    // Flush what we have under the old job id before re-labelling batches.
    await _flush();
    _subscribeStream();
    _restartTimers();
    await _updateNotification();
  }

  /// Stops everything, persisting any unsent samples for the next session.
  Future<void> stop(WorkSessionStopReason reason) async {
    _tearDownTimers();
    await _stream?.cancel();
    _stream = null;
    if (state.running && reason == WorkSessionStopReason.user) {
      // A last, best-effort upload so the customer's map ends where we are.
      await _flush();
    }
    await _persistQueue();
    await WorkForegroundService.stop();
    state = state.copyWith(
      running: false,
      clearActiveJob: true,
      pendingSamples: _batcher.length,
      stopReason: reason,
    );
  }

  /// Re-checks permission after the app returns to the foreground; a revoked
  /// permission stops the session and reports it.
  Future<void> reconcilePermissions() async {
    if (!state.running) return;
    final LocationAvailability availability = await _location.status();
    if (availability.isUsable) {
      if (availability.isBackgroundCapable != state.backgroundCapable) {
        state = state.copyWith(backgroundCapable: availability.isBackgroundCapable);
        _subscribeStream();
      }
      return;
    }
    await _stopInvoluntarily(
      availability == LocationAvailability.serviceDisabled
          ? WorkSessionStopReason.serviceDisabled
          : WorkSessionStopReason.permissionRevoked,
    );
  }

  /// A fresh sample for the calls that require one (arrive / start / complete),
  /// preferring the live stream so no extra GPS fix is requested.
  Future<LocationSample?> freshSample() async {
    final LocationSample? last = state.lastSample;
    if (last != null && DateTime.now().toUtc().difference(last.timestamp.toUtc()) < const Duration(seconds: 15)) {
      return last;
    }
    final LocationSample? sample = await _location.currentSample();
    if (sample != null) _accept(sample);
    return sample;
  }

  /* ------------------------------------------------------------ internals */

  void _subscribeStream() {
    unawaited(_stream?.cancel());
    final bool active = state.activeJobId != null;
    _stream = _location
        .watch(
          distanceFilterMeters: _cadence.distanceFilterFor(activeJob: active),
          background: state.backgroundCapable,
        )
        .listen(_accept, onError: _onStreamError, cancelOnError: false);
  }

  void _accept(LocationSample sample) {
    _batcher.add(sample);
    state = state.copyWith(lastSample: sample, pendingSamples: _batcher.length);
    ref.read(lastKnownPointProvider.notifier).state = GeoPoint(lat: sample.lat, lng: sample.lng);
  }

  Future<void> _onStreamError(Object error) async {
    final LocationAvailability availability = await _location.status();
    if (availability.isUsable) return; // transient plugin error; the stream stays up
    await _stopInvoluntarily(
      availability == LocationAvailability.serviceDisabled
          ? WorkSessionStopReason.serviceDisabled
          : WorkSessionStopReason.permissionRevoked,
    );
  }

  Future<void> _stopInvoluntarily(WorkSessionStopReason reason) async {
    if (!state.running) return;
    await stop(reason);
    onInvoluntaryStop?.call(reason);
  }

  void _restartTimers() {
    _tearDownTimers();
    final int seconds = _cadence.intervalFor(activeJob: state.activeJobId != null);
    state = state.copyWith(intervalSeconds: seconds);
    _uploadTimer = Timer.periodic(Duration(seconds: seconds), (_) => unawaited(_flush()));
    _heartbeatTimer = Timer.periodic(_heartbeatInterval, (_) => unawaited(_heartbeat()));
  }

  void _tearDownTimers() {
    _uploadTimer?.cancel();
    _uploadTimer = null;
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  Future<void> _flush() async {
    if (_flushing) return;
    _flushing = true;
    try {
      final List<LocationSample> batch = _batcher.take();
      if (batch.isEmpty) return;
      final String? jobId = state.activeJobId;
      if (_socket.isConnected) {
        _socket.emit(WsEvent.partnerLocation, <String, Object?>{
          'samples': batch.map((LocationSample s) => s.toJson()).toList(growable: false),
          if (jobId != null) 'jobId': jobId,
        });
      } else {
        try {
          await _partners.pushLocations(batch, jobId: jobId);
        } on AppFailure catch (failure) {
          // Validation rejections (stale / impossible movement) are final for
          // those samples; a network failure keeps them for the next tick.
          if (failure.isNetwork) _batcher.requeue(batch);
          return;
        }
      }
      state = state.copyWith(lastUploadAt: DateTime.now(), pendingSamples: _batcher.length);
    } finally {
      _flushing = false;
    }
  }

  Future<void> _heartbeat() async {
    if (!state.running) return;
    final DeviceMetrics metrics = await ref.read(deviceMetricsReaderProvider).read();
    try {
      final HeartbeatResult result = await _partners.heartbeat(
        location: state.lastSample,
        batteryPercent: metrics.batteryPercent,
        networkType: metrics.networkType,
      );
      state = state.copyWith(lastHeartbeatAt: DateTime.now());
      if (result.heartbeatIntervalSeconds >= 10 &&
          result.heartbeatIntervalSeconds != _heartbeatInterval.inSeconds) {
        _heartbeatInterval = Duration(seconds: result.heartbeatIntervalSeconds);
        _restartTimers();
      }
      if (result.status == AvailabilityStatus.offline) {
        await _stopInvoluntarily(WorkSessionStopReason.serverOffline);
      } else if (result.currentJobId != state.activeJobId) {
        // The server knows about a job we did not (e.g. accepted from another
        // device); mirror it so the cadence is right.
        await setActiveJob(result.currentJobId);
      }
    } on AppFailure catch (failure) {
      if (failure.code == ErrorCode.partnerNotApproved || failure.code == ErrorCode.forbidden) {
        await _stopInvoluntarily(WorkSessionStopReason.serverOffline);
      }
      // Network blips: the next tick retries; the server tolerates a few misses.
    }
  }

  Future<void> _attachSocket() async {
    await _config?.cancel();
    await _socketStatus?.cancel();
    _config = _socket.on(PartnerWsEvent.trackingConfig).listen((JsonMap data) {
      final int? seconds = readInt(data, 'intervalSeconds');
      if (seconds == null) return;
      _cadence = _cadence.withServerInterval(seconds);
      unawaited(ref.read(prefsStoreProvider).setInt(PrefsStore.keyTrackingInterval, seconds));
      if (state.running) _restartTimers();
    });
    _socketStatus = _socket.statusChanges.listen((SocketStatus status) {
      state = state.copyWith(socketConnected: status == SocketStatus.connected);
    });
    await _socket.connect();
    state = state.copyWith(socketConnected: _socket.isConnected);
  }

  Future<void> _persistQueue() =>
      ref.read(prefsStoreProvider).setJsonList(PrefsStore.keyLocationQueue, _batcher.toJson());

  Future<void> _startForegroundService() async {
    final AppLocalizations l10n = await _l10n();
    await WorkForegroundService.start(
      title: l10n.foregroundNotificationTitle,
      content: state.activeJobId == null ? l10n.foregroundNotificationIdle : l10n.foregroundNotificationOnJob,
    );
  }

  Future<void> _updateNotification() async {
    final AppLocalizations l10n = await _l10n();
    await WorkForegroundService.update(
      title: l10n.foregroundNotificationTitle,
      content: state.activeJobId == null ? l10n.foregroundNotificationIdle : l10n.foregroundNotificationOnJob,
    );
  }

  Future<AppLocalizations> _l10n() => AppLocalizations.delegate.load(ref.read(localeControllerProvider));
}

final NotifierProvider<WorkSessionController, WorkSessionState> workSessionProvider =
    NotifierProvider<WorkSessionController, WorkSessionState>(WorkSessionController.new);
