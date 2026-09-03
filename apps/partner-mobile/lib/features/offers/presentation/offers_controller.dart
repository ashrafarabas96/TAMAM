import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/geo.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/realtime/realtime_providers.dart';
import 'package:tamam_partner/core/realtime/socket_client.dart';
import 'package:tamam_partner/core/session/session_state.dart';
import 'package:tamam_partner/features/home/presentation/availability_controller.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/jobs/presentation/jobs_providers.dart';
import 'package:tamam_partner/features/location/presentation/work_session_controller.dart';
import 'package:tamam_partner/features/offers/data/offers_repository.dart';
import 'package:tamam_partner/features/offers/domain/job_offer.dart';

final Provider<OffersRepository> offersRepositoryProvider =
    Provider<OffersRepository>((Ref ref) => OffersRepository(ref.watch(apiClientProvider)));

/// The offers waiting for an answer, oldest first.
@immutable
class OfferQueue {
  const OfferQueue({
    this.offers = const <JobOffer>[],
    this.responding = false,
    this.failure,
    this.acceptedJob,
  });

  final List<JobOffer> offers;
  final bool responding;

  /// The last accept/decline failure (expired, already assigned, network).
  final AppFailure? failure;

  /// Set right after a successful accept; the shell navigates to it once.
  final Job? acceptedJob;

  JobOffer? get current => offers.isEmpty ? null : offers.first;
  int get length => offers.length;
  bool get isEmpty => offers.isEmpty;

  OfferQueue copyWith({
    List<JobOffer>? offers,
    bool? responding,
    AppFailure? failure,
    bool clearFailure = false,
    Job? acceptedJob,
    bool clearAccepted = false,
  }) =>
      OfferQueue(
        offers: offers ?? this.offers,
        responding: responding ?? this.responding,
        failure: clearFailure ? null : (failure ?? this.failure),
        acceptedJob: clearAccepted ? null : (acceptedJob ?? this.acceptedJob),
      );
}

/// Receives offers from the socket (`job:offer` / `job:offer:expired`), keeps
/// the REST list in sync as a fallback, and answers them.
///
/// Several offers can be open at once (dispatch waves overlap); they are shown
/// one at a time in arrival order. Expiry is enforced locally every second so
/// a sheet never lingers past its deadline even if the socket drops.
class OffersController extends Notifier<OfferQueue> {
  StreamSubscription<SocketEvent>? _events;
  StreamSubscription<SocketStatus>? _status;
  Timer? _expiryTicker;

  @override
  OfferQueue build() {
    ref.listen<SessionState>(sessionControllerProvider, (SessionState? previous, SessionState next) {
      if (next.canWork && previous?.canWork != true) {
        unawaited(_attach());
        unawaited(refresh());
      } else if (!next.isAuthenticated) {
        _detach();
        state = const OfferQueue();
      }
    });
    if (ref.read(sessionControllerProvider).canWork) {
      unawaited(_attach());
      unawaited(refresh());
    }
    _expiryTicker = Timer.periodic(const Duration(seconds: 1), (_) => _purgeExpired());
    ref.onDispose(() {
      _detach();
      _expiryTicker?.cancel();
    });
    return const OfferQueue();
  }

  /// Merges `GET /partners/me/offers` into the queue (never drops a socket
  /// offer that REST has not caught up with yet).
  Future<void> refresh() async {
    if (!ref.read(sessionControllerProvider).canWork) return;
    if (!ref.read(availabilityControllerProvider).isOnline) return;
    try {
      final List<JobOffer> remote = await ref.read(offersRepositoryProvider).pending();
      final Map<String, JobOffer> merged = <String, JobOffer>{
        for (final JobOffer o in state.offers) o.assignmentId: o,
      };
      for (final JobOffer o in remote) {
        merged.putIfAbsent(o.assignmentId, () => o);
      }
      final List<JobOffer> next = merged.values.where((JobOffer o) => !o.isExpired()).toList()
        ..sort((JobOffer a, JobOffer b) => a.receivedAt.compareTo(b.receivedAt));
      state = state.copyWith(offers: next);
    } on AppFailure {
      // The socket remains the primary channel; polling is best effort.
    }
  }

  /// Accepts the current offer. On success the accepted job is exposed for
  /// navigation and the queue is cleared: dispatch cancels sibling offers.
  Future<bool> accept() => _respond(accept: true);

  Future<bool> decline() => _respond(accept: false);

  /// Removes an offer the partner let expire (or a stale one) without a call.
  void dismiss(String assignmentId) {
    state = state.copyWith(
      offers: state.offers.where((JobOffer o) => o.assignmentId != assignmentId).toList(growable: false),
    );
  }

  void consumeAccepted() => state = state.copyWith(clearAccepted: true);

  void clearFailure() => state = state.copyWith(clearFailure: true);

  Future<bool> _respond({required bool accept}) async {
    final JobOffer? offer = state.current;
    if (offer == null || state.responding) return false;
    state = state.copyWith(responding: true, clearFailure: true);
    try {
      final LocationSample? location = accept ? await ref.read(workSessionProvider.notifier).freshSample() : null;
      final Job? job = await ref.read(offersRepositoryProvider).respond(
            assignmentId: offer.assignmentId,
            accept: accept,
            location: location,
          );
      if (accept && job != null) {
        state = OfferQueue(acceptedJob: job);
        ref.invalidate(activeJobsProvider);
        await ref.read(availabilityControllerProvider.notifier).setCurrentJob(job.id);
      } else {
        dismiss(offer.assignmentId);
        state = state.copyWith(responding: false);
      }
      return true;
    } on AppFailure catch (failure) {
      // A taken or expired offer is gone whatever the partner wanted.
      final bool gone = failure.code == ErrorCode.offerExpired || failure.code == ErrorCode.jobAlreadyAssigned;
      state = state.copyWith(
        responding: false,
        failure: failure,
        offers: gone
            ? state.offers.where((JobOffer o) => o.assignmentId != offer.assignmentId).toList(growable: false)
            : null,
      );
      return false;
    }
  }

  Future<void> _attach() async {
    _detach();
    final SocketClient socket = ref.read(trackingSocketProvider);
    _events = socket.events.listen((SocketEvent event) {
      switch (event.name) {
        case WsEvent.jobOffer:
          _push(JobOffer.fromJson(event.data));
        case WsEvent.jobOfferExpired:
          final String? assignmentId = readString(event.data, 'assignmentId');
          final String? jobId = readString(event.data, 'jobId');
          state = state.copyWith(
            offers: state.offers
                .where((JobOffer o) => o.assignmentId != assignmentId && (jobId == null || o.job.id != jobId))
                .toList(growable: false),
          );
      }
    });
    _status = socket.statusChanges.listen((SocketStatus status) {
      // Anything that arrived while disconnected is picked up over REST.
      if (status == SocketStatus.connected) unawaited(refresh());
    });
    await socket.connect();
  }

  void _detach() {
    unawaited(_events?.cancel());
    _events = null;
    unawaited(_status?.cancel());
    _status = null;
  }

  void _push(JobOffer offer) {
    if (offer.assignmentId.isEmpty || offer.isExpired()) return;
    if (state.offers.any((JobOffer o) => o.assignmentId == offer.assignmentId)) return;
    state = state.copyWith(offers: <JobOffer>[...state.offers, offer]);
  }

  void _purgeExpired() {
    if (state.offers.isEmpty) return;
    final DateTime now = DateTime.now();
    final List<JobOffer> live = state.offers.where((JobOffer o) => !o.isExpired(now)).toList(growable: false);
    if (live.length != state.offers.length) state = state.copyWith(offers: live);
  }
}

final NotifierProvider<OffersController, OfferQueue> offersControllerProvider =
    NotifierProvider<OffersController, OfferQueue>(OffersController.new);
