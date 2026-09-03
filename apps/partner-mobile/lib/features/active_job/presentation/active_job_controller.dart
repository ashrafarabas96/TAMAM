import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/geo.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/realtime/realtime_providers.dart';
import 'package:tamam_partner/core/realtime/socket_client.dart';
import 'package:tamam_partner/features/home/presentation/availability_controller.dart';
import 'package:tamam_partner/features/jobs/data/jobs_repository.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/jobs/presentation/jobs_providers.dart';
import 'package:tamam_partner/features/location/presentation/work_session_controller.dart';

/// The active-job screen's state: the job plus everything about the *last
/// attempted action* the screen needs to explain.
@immutable
class ActiveJobState {
  const ActiveJobState({
    required this.job,
    this.busy = false,
    this.failure,
    this.geofenceDistanceMeters,
    this.versionConflict = false,
    this.etaToPickupSeconds,
    this.etaToDestinationSeconds,
    this.socketConnected = false,
    this.justCompleted = false,
  });

  final Job job;
  final bool busy;
  final AppFailure? failure;

  /// Set when `arrive` was refused: how far the partner is from the pickup.
  final int? geofenceDistanceMeters;

  /// The server rejected a stale version; the job was refetched and the
  /// screen should ask "look again, then retry".
  final bool versionConflict;

  /// Live ETAs from `job:eta`, overriding the job's snapshot.
  final int? etaToPickupSeconds;
  final int? etaToDestinationSeconds;
  final bool socketConnected;

  /// `true` for the render right after a successful complete, so the screen
  /// opens the earnings summary once.
  final bool justCompleted;

  int? get etaPickup => etaToPickupSeconds ?? job.etaToPickupSeconds;
  int? get etaDestination => etaToDestinationSeconds ?? job.etaToDestinationSeconds;

  /// When the partner arrived — the waiting timer's origin.
  DateTime? get arrivedAt {
    for (final JobEvent event in job.events.reversed) {
      if (event.toStatus == JobStatus.partnerArrived) return event.createdAt;
    }
    return job.pickup?.arrivedAt;
  }

  ActiveJobState copyWith({
    Job? job,
    bool? busy,
    AppFailure? failure,
    bool clearFailure = false,
    int? geofenceDistanceMeters,
    bool clearGeofence = false,
    bool? versionConflict,
    int? etaToPickupSeconds,
    int? etaToDestinationSeconds,
    bool? socketConnected,
    bool? justCompleted,
  }) =>
      ActiveJobState(
        job: job ?? this.job,
        busy: busy ?? this.busy,
        failure: clearFailure ? null : (failure ?? this.failure),
        geofenceDistanceMeters: clearGeofence ? null : (geofenceDistanceMeters ?? this.geofenceDistanceMeters),
        versionConflict: versionConflict ?? this.versionConflict,
        etaToPickupSeconds: etaToPickupSeconds ?? this.etaToPickupSeconds,
        etaToDestinationSeconds: etaToDestinationSeconds ?? this.etaToDestinationSeconds,
        socketConnected: socketConnected ?? this.socketConnected,
        justCompleted: justCompleted ?? this.justCompleted,
      );
}

/// Drives one job through its transitions.
///
/// Every mutation sends the job's `version`. On `VERSION_CONFLICT` the job is
/// refetched and the screen is told to prompt for a retry — the partner sees
/// the new state (maybe the customer cancelled) before pressing again.
class ActiveJobController extends AutoDisposeFamilyAsyncNotifier<ActiveJobState, String> {
  StreamSubscription<SocketEvent>? _events;
  StreamSubscription<SocketStatus>? _status;
  SocketClient? _socket;

  @override
  Future<ActiveJobState> build(String arg) async {
    final Job job = await ref.watch(jobsRepositoryProvider).get(arg);
    ref.onDispose(_detach);
    unawaited(_attach(arg));
    return ActiveJobState(job: job, socketConnected: ref.read(trackingSocketProvider).isConnected);
  }

  JobsRepository get _repo => ref.read(jobsRepositoryProvider);

  Future<void> refresh() async {
    final ActiveJobState? current = state.valueOrNull;
    try {
      final Job job = await _repo.get(arg);
      state = AsyncValue<ActiveJobState>.data(
        (current ?? ActiveJobState(job: job)).copyWith(job: job, clearFailure: true, clearGeofence: true),
      );
      await _syncAvailability(job);
    } on AppFailure catch (failure) {
      if (current == null) {
        state = AsyncValue<ActiveJobState>.error(failure, StackTrace.current);
      } else {
        state = AsyncValue<ActiveJobState>.data(current.copyWith(failure: failure));
      }
    }
  }

  Future<bool> goEnRoute() => _run((Job job) => _repo.enRoute(job.id, version: job.version));

  Future<bool> arrive() => _run((Job job) async {
        final LocationSample? location = await _freshSample();
        if (location == null) throw const AppFailure(code: _noLocationCode, message: '');
        return _repo.arrive(job.id, version: job.version, location: location);
      });

  /// RIDE start (trip PIN), DELIVERY pickup (OTP) or HOME_SERVICE inspection.
  Future<bool> start({String? code}) => _run((Job job) async {
        final LocationSample? location = await _freshSample();
        return _repo.start(
          job.id,
          version: job.version,
          tripPin: job.isRide ? code : null,
          pickupOtp: job.isDelivery ? code : null,
          location: location,
        );
      });

  /// RIDE completion, or DELIVERY hand-over with proof.
  Future<bool> complete({ProofOfDelivery? proof}) => _run(
        (Job job) async {
          final LocationSample? location = await _freshSample();
          return _repo.complete(job.id, version: job.version, location: location, proof: proof);
        },
        completed: true,
      );

  Future<bool> startWork() => _run((Job job) => _repo.startWork(job.id, version: job.version));

  Future<bool> waitingForParts({String? note}) =>
      _run((Job job) => _repo.waitingForParts(job.id, version: job.version, note: note));

  Future<bool> resumeWork() => _run((Job job) => _repo.resumeWork(job.id, version: job.version));

  Future<bool> completeWork() => _run(
        (Job job) async {
          final LocationSample? location = await _freshSample();
          return _repo.completeWork(job.id, version: job.version, location: location);
        },
        completed: true,
      );

  Future<bool> cancel({required PartnerCancelReason reason, String? reasonText}) =>
      _run((Job job) => _repo.cancel(job.id, version: job.version, reason: reason, reasonText: reasonText));

  /// Hands the job back to dispatch; the job is no longer ours afterwards.
  Future<bool> release({required String reason}) async {
    final ActiveJobState? current = state.valueOrNull;
    if (current == null || current.busy) return false;
    state = AsyncValue<ActiveJobState>.data(current.copyWith(busy: true, clearFailure: true));
    try {
      await _repo.release(current.job.id, reason: reason);
      ref.invalidate(activeJobsProvider);
      await ref.read(availabilityControllerProvider.notifier).setCurrentJob(null);
      await refresh();
      return true;
    } on AppFailure catch (failure) {
      state = AsyncValue<ActiveJobState>.data(current.copyWith(busy: false, failure: failure));
      return false;
    }
  }

  /// Called after the quote builder submitted, so the screen reflects it.
  void applyJob(Job job) {
    final ActiveJobState? current = state.valueOrNull;
    state = AsyncValue<ActiveJobState>.data((current ?? ActiveJobState(job: job)).copyWith(job: job));
  }

  void clearFailure() {
    final ActiveJobState? current = state.valueOrNull;
    if (current == null) return;
    state = AsyncValue<ActiveJobState>.data(
      current.copyWith(clearFailure: true, clearGeofence: true, versionConflict: false),
    );
  }

  void consumeCompleted() {
    final ActiveJobState? current = state.valueOrNull;
    if (current == null || !current.justCompleted) return;
    state = AsyncValue<ActiveJobState>.data(current.copyWith(justCompleted: false));
  }

  /// The failure code used when no GPS fix could be obtained for `arrive`.
  static const String noLocationCode = _noLocationCode;

  /* ------------------------------------------------------------ internals */

  static const String _noLocationCode = 'NO_LOCATION_FIX';

  Future<bool> _run(Future<Job> Function(Job job) action, {bool completed = false}) async {
    final ActiveJobState? current = state.valueOrNull;
    if (current == null || current.busy) return false;
    state = AsyncValue<ActiveJobState>.data(
      current.copyWith(busy: true, clearFailure: true, clearGeofence: true, versionConflict: false),
    );
    try {
      final Job updated = await action(current.job);
      state = AsyncValue<ActiveJobState>.data(
        current.copyWith(job: updated, busy: false, justCompleted: completed),
      );
      ref.invalidate(activeJobsProvider);
      await _syncAvailability(updated);
      return true;
    } on AppFailure catch (failure) {
      if (failure.isVersionConflict) {
        Job latest = current.job;
        try {
          latest = await _repo.get(current.job.id);
        } on AppFailure {
          // Keep the old snapshot; the prompt still asks to look again.
        }
        state = AsyncValue<ActiveJobState>.data(
          current.copyWith(job: latest, busy: false, failure: failure, versionConflict: true),
        );
        return false;
      }
      state = AsyncValue<ActiveJobState>.data(
        current.copyWith(
          busy: false,
          failure: failure,
          geofenceDistanceMeters: geofenceDistanceMeters(failure),
        ),
      );
      return false;
    }
  }

  Future<LocationSample?> _freshSample() => ref.read(workSessionProvider.notifier).freshSample();

  Future<void> _syncAvailability(Job job) =>
      ref.read(availabilityControllerProvider.notifier).setCurrentJob(job.isActiveForPartner ? job.id : null);

  Future<void> _attach(String jobId) async {
    final SocketClient socket = ref.read(trackingSocketProvider);
    _socket = socket;
    _status = socket.statusChanges.listen((SocketStatus status) {
      final ActiveJobState? current = state.valueOrNull;
      if (current == null) return;
      state = AsyncValue<ActiveJobState>.data(current.copyWith(socketConnected: status == SocketStatus.connected));
      if (status == SocketStatus.connected) {
        socket.emit(WsEvent.subscribeJob, <String, Object?>{'jobId': jobId});
        // Anything missed while disconnected is one fetch away.
        unawaited(refresh());
      }
    });
    _events = socket.events.listen((SocketEvent event) {
      if (readString(event.data, 'jobId') != jobId) return;
      switch (event.name) {
        case WsEvent.jobStatus:
          unawaited(refresh());
        case WsEvent.jobEta:
          final ActiveJobState? current = state.valueOrNull;
          if (current == null) return;
          state = AsyncValue<ActiveJobState>.data(
            current.copyWith(
              etaToPickupSeconds: readInt(event.data, 'etaToPickupSeconds'),
              etaToDestinationSeconds: readInt(event.data, 'etaToDestinationSeconds'),
            ),
          );
      }
    });
    await socket.connect();
    if (socket.isConnected) socket.emit(WsEvent.subscribeJob, <String, Object?>{'jobId': jobId});
  }

  void _detach() {
    final SocketClient? socket = _socket;
    if (socket != null && socket.isConnected) {
      socket.emit(WsEvent.unsubscribeJob, <String, Object?>{'jobId': arg});
    }
    _socket = null;
    unawaited(_events?.cancel());
    _events = null;
    unawaited(_status?.cancel());
    _status = null;
  }
}

final AutoDisposeAsyncNotifierProviderFamily<ActiveJobController, ActiveJobState, String> activeJobProvider =
    AsyncNotifierProvider.autoDispose.family<ActiveJobController, ActiveJobState, String>(ActiveJobController.new);
