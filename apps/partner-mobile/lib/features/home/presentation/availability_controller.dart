import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/maps/location_service.dart';
import 'package:tamam_partner/core/models/geo.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/session/session_state.dart';
import 'package:tamam_partner/core/storage/prefs_store.dart';
import 'package:tamam_partner/features/account/data/partner_repository.dart';
import 'package:tamam_partner/features/account/presentation/partner_providers.dart';
import 'package:tamam_partner/features/location/presentation/location_providers.dart';
import 'package:tamam_partner/features/location/presentation/work_session_controller.dart';

/// Why the partner cannot go (or stay) online, in terms the UI can explain
/// and offer a fix for.
enum AvailabilityBlocker {
  /// Profile not approved, or suspended.
  notApproved,

  /// One or more required documents expired; `expiredDocumentTypes` says which.
  expiredDocuments,

  /// A DRIVER/COURIER role is active without an approved active vehicle.
  noVehicle,

  /// Location permission missing or downgraded.
  locationPermission,

  /// Location services are switched off at the OS level.
  locationServiceDisabled,

  /// A job is in progress; OFFLINE must wait.
  activeJob,
}

@immutable
class AvailabilityState {
  const AvailabilityState({
    this.loaded = false,
    this.status = AvailabilityStatus.offline,
    this.activeRoles = const <PartnerRoleType>[],
    this.activeVehicleId,
    this.currentJobId,
    this.busy = false,
    this.failure,
    this.blocker,
    this.expiredDocumentTypes = const <String>[],
    this.needsResumeConfirmation = false,
    this.interruptedReason,
    this.backgroundLimited = false,
  });

  /// `false` until the first `GET /partners/me/availability` answered.
  final bool loaded;

  /// The server's answer — never set optimistically.
  final AvailabilityStatus status;
  final List<PartnerRoleType> activeRoles;
  final String? activeVehicleId;
  final String? currentJobId;
  final bool busy;
  final AppFailure? failure;
  final AvailabilityBlocker? blocker;
  final List<String> expiredDocumentTypes;

  /// The app was restarted or resumed while the server still lists the
  /// partner ONLINE but no location pipeline is running: ask before resuming.
  final bool needsResumeConfirmation;

  /// The pipeline stopped without the partner asking; explains the flip to OFFLINE.
  final WorkSessionStopReason? interruptedReason;

  /// Online with only "while in use" permission: uploads pause off-screen.
  final bool backgroundLimited;

  bool get isOnline => status == AvailabilityStatus.online || status == AvailabilityStatus.busy;
  bool get isBusy => status == AvailabilityStatus.busy;

  AvailabilityState copyWith({
    bool? loaded,
    AvailabilityStatus? status,
    List<PartnerRoleType>? activeRoles,
    String? activeVehicleId,
    bool clearVehicle = false,
    String? currentJobId,
    bool clearJob = false,
    bool? busy,
    AppFailure? failure,
    bool clearFailure = false,
    AvailabilityBlocker? blocker,
    bool clearBlocker = false,
    List<String>? expiredDocumentTypes,
    bool? needsResumeConfirmation,
    WorkSessionStopReason? interruptedReason,
    bool clearInterrupted = false,
    bool? backgroundLimited,
  }) =>
      AvailabilityState(
        loaded: loaded ?? this.loaded,
        status: status ?? this.status,
        activeRoles: activeRoles ?? this.activeRoles,
        activeVehicleId: clearVehicle ? null : (activeVehicleId ?? this.activeVehicleId),
        currentJobId: clearJob ? null : (currentJobId ?? this.currentJobId),
        busy: busy ?? this.busy,
        failure: clearFailure ? null : (failure ?? this.failure),
        blocker: clearBlocker ? null : (blocker ?? this.blocker),
        expiredDocumentTypes: expiredDocumentTypes ?? this.expiredDocumentTypes,
        needsResumeConfirmation: needsResumeConfirmation ?? this.needsResumeConfirmation,
        interruptedReason: clearInterrupted ? null : (interruptedReason ?? this.interruptedReason),
        backgroundLimited: backgroundLimited ?? this.backgroundLimited,
      );
}

/// Owns the ONLINE/OFFLINE decision.
///
/// Every transition is a round-trip to `PUT /partners/me/availability`; the
/// toggle in the header shows the server's answer, never a local guess. Going
/// online also starts the work session (location + heartbeat); going offline
/// stops it. A session that dies on its own (permission revoked, server
/// timeout) is mirrored back to the server and explained on the home screen.
class AvailabilityController extends Notifier<AvailabilityState> {
  @override
  AvailabilityState build() {
    ref.listen<SessionState>(sessionControllerProvider, (SessionState? previous, SessionState next) {
      if (previous?.isAuthenticated == true && !next.isAuthenticated) {
        state = const AvailabilityState(loaded: true);
      } else if (next.canWork && previous?.canWork != true) {
        unawaited(load());
      }
    });
    ref.read(workSessionProvider.notifier).onInvoluntaryStop = _onSessionInterrupted;
    if (ref.read(sessionControllerProvider).canWork) unawaited(load());
    return const AvailabilityState();
  }

  PartnerRepository get _partners => ref.read(partnerRepositoryProvider);
  LocationService get _location => ref.read(locationServiceProvider);
  PrefsStore get _prefs => ref.read(prefsStoreProvider);
  WorkSessionController get _session => ref.read(workSessionProvider.notifier);

  /// Reads the server state. If the server still lists us ONLINE from an
  /// earlier process, the partner is asked before the pipeline restarts.
  Future<void> load() async {
    try {
      final PartnerAvailability remote = await _partners.availability();
      final bool pipelineRunning = ref.read(workSessionProvider).running;
      state = state.copyWith(
        loaded: true,
        status: remote.status,
        activeRoles: remote.activeRoles,
        activeVehicleId: remote.activeVehicleId,
        clearVehicle: remote.activeVehicleId == null,
        currentJobId: remote.currentJobId,
        clearJob: remote.currentJobId == null,
        needsResumeConfirmation: remote.isOnline && !pipelineRunning,
        clearFailure: true,
      );
    } on AppFailure catch (failure) {
      // Offline start: remember the last roles so the sheet is pre-filled.
      state = state.copyWith(loaded: true, activeRoles: _savedRoles(), failure: failure.isNetwork ? null : failure);
    }
  }

  /// The roles the partner last worked as — the sheet's default selection.
  List<PartnerRoleType> preferredRoles(List<PartnerRoleType> available) {
    final List<PartnerRoleType> saved = state.activeRoles.isNotEmpty ? state.activeRoles : _savedRoles();
    final List<PartnerRoleType> usable = saved.where(available.contains).toList(growable: false);
    return usable.isEmpty ? available : usable;
  }

  /// Requests the permissions ONLINE needs. Returns the resulting state so the
  /// sheet can explain "always" vs "while in use" before the toggle flips.
  Future<LocationAvailability> ensureLocationPermission() async {
    final LocationAvailability result = await _location.requestAlways();
    switch (result) {
      case LocationAvailability.granted:
      case LocationAvailability.grantedAlways:
        state = state.copyWith(clearBlocker: true, clearFailure: true);
      case LocationAvailability.denied:
      case LocationAvailability.deniedForever:
        state = state.copyWith(blocker: AvailabilityBlocker.locationPermission);
      case LocationAvailability.serviceDisabled:
        state = state.copyWith(blocker: AvailabilityBlocker.locationServiceDisabled);
    }
    return result;
  }

  /// Goes ONLINE with the chosen roles (and vehicle for DRIVER/COURIER).
  Future<bool> goOnline({required List<PartnerRoleType> roles, String? vehicleId}) async {
    if (state.busy) return false;
    state = state.copyWith(busy: true, clearFailure: true, clearBlocker: true, clearInterrupted: true);

    final LocationAvailability permission = await ensureLocationPermission();
    if (!permission.isUsable) {
      state = state.copyWith(busy: false);
      return false;
    }

    final LocationSample? sample = await _location.currentSample();
    if (sample != null) {
      ref.read(lastKnownPointProvider.notifier).state = GeoPoint(lat: sample.lat, lng: sample.lng);
    }

    try {
      final PartnerAvailability remote = await _partners.setAvailability(
        status: AvailabilityStatus.online,
        location: sample,
        activeVehicleId: vehicleId,
        activeRoles: roles,
      );
      await _prefs.setBool(PrefsStore.keyWasOnline, value: true);
      await _prefs.setStringList(
        PrefsStore.keyActiveRoles,
        roles.map((PartnerRoleType r) => r.value).toList(growable: false),
      );
      final bool started = await _session.start(
        activeJobId: remote.currentJobId,
        heartbeatIntervalSeconds: remote.heartbeatIntervalSeconds,
      );
      if (!started) {
        // Permission vanished between the check and the stream: undo server-side.
        await _setOfflineQuietly();
        state = state.copyWith(busy: false, blocker: AvailabilityBlocker.locationPermission);
        return false;
      }
      state = state.copyWith(
        busy: false,
        status: remote.status,
        activeRoles: remote.activeRoles,
        activeVehicleId: remote.activeVehicleId,
        clearVehicle: remote.activeVehicleId == null,
        currentJobId: remote.currentJobId,
        clearJob: remote.currentJobId == null,
        needsResumeConfirmation: false,
        backgroundLimited: !ref.read(workSessionProvider).backgroundCapable,
      );
      ref.invalidate(partnerProfileProvider);
      return true;
    } on AppFailure catch (failure) {
      state = state.copyWith(
        busy: false,
        failure: failure,
        blocker: _blockerFor(failure),
        expiredDocumentTypes: expiredDocumentTypes(failure),
      );
      return false;
    }
  }

  /// Goes OFFLINE. Refused by the server while a job is in progress.
  Future<bool> goOffline() async {
    if (state.busy) return false;
    state = state.copyWith(busy: true, clearFailure: true, clearBlocker: true);
    try {
      final PartnerAvailability remote = await _partners.setAvailability(status: AvailabilityStatus.offline);
      await _session.stop(WorkSessionStopReason.user);
      await _prefs.setBool(PrefsStore.keyWasOnline, value: false);
      state = state.copyWith(
        busy: false,
        status: remote.status,
        currentJobId: remote.currentJobId,
        clearJob: remote.currentJobId == null,
        needsResumeConfirmation: false,
        clearInterrupted: true,
      );
      return true;
    } on AppFailure catch (failure) {
      state = state.copyWith(
        busy: false,
        failure: failure,
        blocker: failure.code == ErrorCode.partnerNotAvailable ? AvailabilityBlocker.activeJob : _blockerFor(failure),
      );
      return false;
    }
  }

  /// The partner confirmed "resume work" after a restart.
  Future<bool> confirmResume() async {
    final List<PartnerRoleType> roles = state.activeRoles.isNotEmpty ? state.activeRoles : _savedRoles();
    return goOnline(roles: roles, vehicleId: state.activeVehicleId);
  }

  /// The partner declined to resume: the server must not keep offering jobs.
  Future<void> declineResume() async {
    state = state.copyWith(needsResumeConfirmation: false);
    await goOffline();
  }

  /// Called on app resume: re-checks permission and reconciles with the server.
  Future<void> reconcileAfterResume() async {
    if (!ref.read(sessionControllerProvider).canWork) return;
    await _session.reconcilePermissions();
    await load();
    if (state.isOnline && ref.read(workSessionProvider).running) {
      state = state.copyWith(backgroundLimited: !ref.read(workSessionProvider).backgroundCapable);
    }
  }

  /// Keeps the cadence in step with the job the partner is on.
  Future<void> setCurrentJob(String? jobId) async {
    state = state.copyWith(currentJobId: jobId, clearJob: jobId == null);
    if (ref.read(workSessionProvider).running) await _session.setActiveJob(jobId);
  }

  void clearFailure() => state = state.copyWith(clearFailure: true, clearBlocker: true);

  void dismissInterruption() => state = state.copyWith(clearInterrupted: true);

  Future<void> openLocationSettings() => _location.openAppSettings();

  Future<void> openDeviceLocationSettings() => _location.openLocationSettings();

  /* ------------------------------------------------------------ internals */

  void _onSessionInterrupted(WorkSessionStopReason reason) {
    unawaited(_setOfflineQuietly());
    unawaited(_prefs.setBool(PrefsStore.keyWasOnline, value: false));
    state = state.copyWith(
      status: AvailabilityStatus.offline,
      clearJob: true,
      interruptedReason: reason,
      blocker: switch (reason) {
        WorkSessionStopReason.permissionRevoked => AvailabilityBlocker.locationPermission,
        WorkSessionStopReason.serviceDisabled => AvailabilityBlocker.locationServiceDisabled,
        _ => null,
      },
    );
  }

  Future<void> _setOfflineQuietly() async {
    try {
      await _partners.setAvailability(status: AvailabilityStatus.offline);
    } on AppFailure {
      // Best effort: the server's heartbeat timeout will flip us anyway.
    }
  }

  List<PartnerRoleType> _savedRoles() => _prefs
      .getStringList(PrefsStore.keyActiveRoles)
      .map(PartnerRoleType.fromValue)
      .whereType<PartnerRoleType>()
      .toList(growable: false);

  AvailabilityBlocker? _blockerFor(AppFailure failure) {
    if (failure.code != ErrorCode.partnerNotApproved) return null;
    if (expiredDocumentTypes(failure).isNotEmpty) return AvailabilityBlocker.expiredDocuments;
    final String message = failure.message.toLowerCase();
    if (message.contains('vehicle')) return AvailabilityBlocker.noVehicle;
    return AvailabilityBlocker.notApproved;
  }
}

final NotifierProvider<AvailabilityController, AvailabilityState> availabilityControllerProvider =
    NotifierProvider<AvailabilityController, AvailabilityState>(AvailabilityController.new);
