import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/core/realtime/realtime_providers.dart';
import 'package:tamam_customer/core/realtime/socket_client.dart';
import 'package:tamam_customer/features/jobs/data/jobs_repository.dart';
import 'package:tamam_customer/features/jobs/domain/job.dart';
import 'package:tamam_customer/features/jobs/presentation/job_providers.dart';

/// Everything the tracking screen renders.
class JobTracking {
  const JobTracking({
    required this.job,
    required this.live,
    required this.partnerPath,
    required this.realtime,
  });

  final Job job;
  final JobLiveState live;

  /// The partner's travelled path, drawn as a trail behind the marker.
  final List<GeoPoint> partnerPath;

  /// `true` while the tracking socket is connected; `false` means the screen is
  /// running on the REST polling fallback (still correct, just slower).
  final bool realtime;

  JobTracking copyWith({
    Job? job,
    JobLiveState? live,
    List<GeoPoint>? partnerPath,
    bool? realtime,
  }) =>
      JobTracking(
        job: job ?? this.job,
        live: live ?? this.live,
        partnerPath: partnerPath ?? this.partnerPath,
        realtime: realtime ?? this.realtime,
      );
}

/// Live tracking for one job.
///
/// Realtime is an optimisation, not a dependency: the socket delivers status,
/// position and ETA the moment they change, while an 8-second REST poll keeps
/// the screen correct if the socket is unavailable, blocked or reconnecting.
class JobTrackingController extends AutoDisposeFamilyAsyncNotifier<JobTracking, String> {
  static const Duration _pollInterval = Duration(seconds: 8);

  Timer? _poller;
  StreamSubscription<SocketEvent>? _events;
  StreamSubscription<SocketStatus>? _socketStatus;

  @override
  Future<JobTracking> build(String arg) async {
    final JobsRepository repository = ref.watch(jobsRepositoryProvider);
    final Job job = await repository.get(arg);

    ref.onDispose(_detach);
    if (job.isActive) unawaited(_attach(arg));

    return JobTracking(
      job: job,
      live: JobLiveState(
        jobId: job.id,
        status: job.status,
        location: job.partner?.location,
        etaToPickupSeconds: job.etaToPickupSeconds,
        etaToDestinationSeconds: job.etaToDestinationSeconds,
      ),
      partnerPath: job.isLive ? await _safePath(repository, arg) : const <GeoPoint>[],
      realtime: false,
    );
  }

  /// Pulls the authoritative job again — after a cancel, a quote decision, or a
  /// status change seen on the socket.
  Future<void> reload() async {
    final JobTracking? current = state.valueOrNull;
    try {
      final Job job = await ref.read(jobsRepositoryProvider).get(arg);
      state = AsyncValue<JobTracking>.data(
        (current ??
                JobTracking(
                  job: job,
                  live: JobLiveState(jobId: job.id, status: job.status),
                  partnerPath: const <GeoPoint>[],
                  realtime: false,
                ))
            .copyWith(job: job),
      );
      if (job.isTerminal) _detach();
      // Keep the orders list and the home banner honest about this job.
      ref.invalidate(activeJobsProvider);
    } on AppFailure catch (failure) {
      if (current == null) state = AsyncValue<JobTracking>.error(failure, StackTrace.current);
    }
  }

  Future<void> _attach(String jobId) async {
    final SocketClient socket = ref.read(trackingSocketProvider);
    _socketStatus = socket.statusChanges.listen((SocketStatus status) {
      final JobTracking? current = state.valueOrNull;
      if (current == null) return;
      state = AsyncValue<JobTracking>.data(current.copyWith(realtime: status == SocketStatus.connected));
      if (status == SocketStatus.connected) {
        socket.emit(WsEvent.subscribeJob, <String, Object?>{'jobId': jobId});
      }
    });

    _events = socket.events.listen((SocketEvent event) => _onSocketEvent(jobId, event));

    await socket.connect();
    if (socket.isConnected) socket.emit(WsEvent.subscribeJob, <String, Object?>{'jobId': jobId});

    _poller = Timer.periodic(_pollInterval, (_) => unawaited(_poll(jobId)));
  }

  void _detach() {
    _poller?.cancel();
    _poller = null;
    unawaited(_events?.cancel());
    _events = null;
    unawaited(_socketStatus?.cancel());
    _socketStatus = null;
  }

  void _onSocketEvent(String jobId, SocketEvent event) {
    final JobTracking? current = state.valueOrNull;
    if (current == null) return;
    if (readStringOr(event.data, 'jobId', jobId) != jobId) return;

    switch (event.name) {
      case WsEvent.jobLocation:
        state = AsyncValue<JobTracking>.data(
          current.copyWith(
            live: current.live.merge(JobLiveState.fromLocationEvent(event.data)),
            partnerPath: _appendPoint(current.partnerPath, event.data),
          ),
        );
      case WsEvent.jobEta:
        state = AsyncValue<JobTracking>.data(
          current.copyWith(
            live: current.live.merge(
              JobLiveState(
                jobId: jobId,
                etaToPickupSeconds: readInt(event.data, 'etaToPickupSeconds'),
                etaToDestinationSeconds: readInt(event.data, 'etaToDestinationSeconds'),
              ),
            ),
          ),
        );
      case WsEvent.jobStatus:
        final JobStatus? next = JobStatus.fromValue(readString(event.data, 'status'));
        if (next != null && next != current.job.status) unawaited(reload());
      default:
        return;
    }
  }

  /// REST fallback. Runs even while the socket is healthy (cheap, and it heals
  /// any event the socket dropped during a reconnect).
  Future<void> _poll(String jobId) async {
    final JobTracking? current = state.valueOrNull;
    if (current == null) return;
    if (current.job.isTerminal) {
      _detach();
      return;
    }
    try {
      final JobLiveState live = await ref.read(jobsRepositoryProvider).liveState(jobId);
      final JobTracking? latest = state.valueOrNull;
      if (latest == null) return;
      if (live.status != null && live.status != latest.job.status) {
        await reload();
        return;
      }
      state = AsyncValue<JobTracking>.data(latest.copyWith(live: latest.live.merge(live)));
    } on AppFailure {
      // Offline or a transient error: keep showing the last known position.
    }
  }

  Future<List<GeoPoint>> _safePath(JobsRepository repository, String jobId) async {
    try {
      return await repository.path(jobId);
    } on AppFailure {
      return const <GeoPoint>[];
    }
  }

  List<GeoPoint> _appendPoint(List<GeoPoint> path, JsonMap data) {
    final GeoPoint point = GeoPoint(
      lat: readDoubleOr(data, 'lat', 0),
      lng: readDoubleOr(data, 'lng', 0),
    );
    if (path.isNotEmpty && path.last == point) return path;
    // Bounded: the trail only needs the recent shape, not the whole trip.
    final List<GeoPoint> next = <GeoPoint>[...path, point];
    return next.length <= 200 ? next : next.sublist(next.length - 200);
  }
}

final AutoDisposeAsyncNotifierProviderFamily<JobTrackingController, JobTracking, String>
    jobTrackingProvider =
    AsyncNotifierProvider.autoDispose.family<JobTrackingController, JobTracking, String>(
  JobTrackingController.new,
);
