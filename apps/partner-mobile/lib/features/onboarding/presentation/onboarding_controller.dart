import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';
import 'package:tamam_partner/features/account/presentation/partner_providers.dart';
import 'package:tamam_partner/features/onboarding/data/onboarding_repository.dart';
import 'package:tamam_partner/features/onboarding/domain/onboarding_step.dart';

final Provider<OnboardingRepository> onboardingRepositoryProvider =
    Provider<OnboardingRepository>((Ref ref) => OnboardingRepository(ref.watch(apiClientProvider)));

/// The terms version the app ships with; sent on submit so the server records
/// exactly what the partner agreed to.
const String kPartnerTermsVersion = '1.0';

@immutable
class OnboardingState {
  const OnboardingState({
    required this.profile,
    required this.step,
    this.busy = false,
    this.failure,
    this.submitted = false,
  });

  /// The server's copy — the single source of truth for what is saved.
  final PartnerProfile? profile;
  final OnboardingStep step;
  final bool busy;
  final AppFailure? failure;

  /// `true` right after a successful submit; the wizard hands over to status.
  final bool submitted;

  List<PartnerRoleType> get roles => profile?.roles ?? const <PartnerRoleType>[];

  List<OnboardingStep> get steps => OnboardingFlow.stepsFor(roles);

  int get stepIndex {
    final int index = steps.indexOf(step);
    return index < 0 ? 0 : index;
  }

  int get stepCount => steps.length;

  bool get isFirst => stepIndex == 0;

  OnboardingState copyWith({
    PartnerProfile? profile,
    OnboardingStep? step,
    bool? busy,
    AppFailure? failure,
    bool clearFailure = false,
    bool? submitted,
  }) =>
      OnboardingState(
        profile: profile ?? this.profile,
        step: step ?? this.step,
        busy: busy ?? this.busy,
        failure: clearFailure ? null : (failure ?? this.failure),
        submitted: submitted ?? this.submitted,
      );
}

/// Drives the resumable wizard.
///
/// Each `saveX` posts its step and stores the profile the server returns, so
/// the wizard's idea of progress is never a local guess. Navigation only moves
/// forward once the server accepted the step.
class OnboardingController extends AsyncNotifier<OnboardingState> {
  @override
  Future<OnboardingState> build() async {
    PartnerProfile? profile;
    try {
      profile = await ref.watch(partnerRepositoryProvider).me();
    } on AppFailure catch (failure) {
      // A partner with no profile row yet starts at step 1 rather than an error.
      if (!failure.isNotFound) rethrow;
    }
    return OnboardingState(profile: profile, step: OnboardingFlow.resumeAt(profile));
  }

  OnboardingRepository get _repo => ref.read(onboardingRepositoryProvider);

  /// Jumps to a step the partner already completed (the stepper header).
  void goTo(OnboardingStep step) {
    final OnboardingState? current = state.valueOrNull;
    if (current == null || current.busy) return;
    if (!OnboardingFlow.appliesTo(step, current.roles)) return;
    state = AsyncValue<OnboardingState>.data(current.copyWith(step: step, clearFailure: true));
  }

  bool back() {
    final OnboardingState? current = state.valueOrNull;
    if (current == null || current.busy) return false;
    final OnboardingStep? previous = OnboardingFlow.previous(current.step, current.roles);
    if (previous == null) return false;
    state = AsyncValue<OnboardingState>.data(current.copyWith(step: previous, clearFailure: true));
    return true;
  }

  Future<bool> savePersonal(PersonalInfoInput input) =>
      _save(() => _repo.savePersonal(input), from: OnboardingStep.personal);

  Future<bool> saveRoles(List<PartnerRoleType> roles) =>
      _save(() => _repo.saveRoles(roles), from: OnboardingStep.roles);

  Future<bool> saveSkills({
    required List<String> categoryIds,
    List<String> skills = const <String>[],
    int? yearsOfExperience,
  }) =>
      _save(
        () => _repo.saveSkills(categoryIds: categoryIds, skills: skills, yearsOfExperience: yearsOfExperience),
        from: OnboardingStep.skills,
      );

  Future<bool> saveVehicle(JsonMap vehicle) => _save(() => _repo.saveVehicle(vehicle), from: OnboardingStep.vehicle);

  Future<bool> saveZones(List<String> zoneIds) => _save(() => _repo.saveZones(zoneIds), from: OnboardingStep.zones);

  /// Uploads one document record; the wizard stays on the documents step until
  /// every required type has been provided.
  Future<bool> addDocument({
    required DocumentType type,
    required String mediaId,
    String? number,
    String? issuedAt,
    String? expiresAt,
  }) async {
    final OnboardingState? current = state.valueOrNull;
    if (current == null || current.busy) return false;
    state = AsyncValue<OnboardingState>.data(current.copyWith(busy: true, clearFailure: true));
    try {
      await _repo.addDocument(
        type: type,
        mediaId: mediaId,
        number: number,
        issuedAt: issuedAt,
        expiresAt: expiresAt,
      );
      final PartnerProfile profile = await ref.read(partnerRepositoryProvider).me();
      ref.invalidate(partnerProfileProvider);
      state = AsyncValue<OnboardingState>.data(current.copyWith(profile: profile, busy: false));
      return true;
    } on AppFailure catch (failure) {
      state = AsyncValue<OnboardingState>.data(current.copyWith(busy: false, failure: failure));
      return false;
    }
  }

  /// Moves off the documents step once everything required is uploaded.
  bool advanceFromDocuments() {
    final OnboardingState? current = state.valueOrNull;
    if (current == null) return false;
    final OnboardingStep? next = OnboardingFlow.next(OnboardingStep.documents, current.roles);
    state = AsyncValue<OnboardingState>.data(
      current.copyWith(step: next ?? OnboardingStep.review, clearFailure: true),
    );
    return true;
  }

  Future<bool> submit() async {
    final OnboardingState? current = state.valueOrNull;
    if (current == null || current.busy) return false;
    state = AsyncValue<OnboardingState>.data(current.copyWith(busy: true, clearFailure: true));
    try {
      final PartnerProfile profile = await _repo.submit(acceptedTermsVersion: kPartnerTermsVersion);
      ref.invalidate(partnerProfileProvider);
      // The session drives the router: a submitted file is "under review".
      unawaited(ref.read(sessionControllerProvider.notifier).refreshUser());
      state = AsyncValue<OnboardingState>.data(
        current.copyWith(profile: profile, busy: false, submitted: true),
      );
      return true;
    } on AppFailure catch (failure) {
      state = AsyncValue<OnboardingState>.data(current.copyWith(busy: false, failure: failure));
      return false;
    }
  }

  void clearFailure() {
    final OnboardingState? current = state.valueOrNull;
    if (current == null) return;
    state = AsyncValue<OnboardingState>.data(current.copyWith(clearFailure: true));
  }

  Future<bool> _save(Future<PartnerProfile> Function() action, {required OnboardingStep from}) async {
    final OnboardingState? current = state.valueOrNull;
    if (current == null || current.busy) return false;
    state = AsyncValue<OnboardingState>.data(current.copyWith(busy: true, clearFailure: true));
    try {
      final PartnerProfile profile = await action();
      ref.invalidate(partnerProfileProvider);
      final OnboardingStep? next = OnboardingFlow.next(from, profile.roles);
      state = AsyncValue<OnboardingState>.data(
        current.copyWith(profile: profile, busy: false, step: next ?? OnboardingStep.review),
      );
      return true;
    } on AppFailure catch (failure) {
      state = AsyncValue<OnboardingState>.data(current.copyWith(busy: false, failure: failure));
      return false;
    }
  }
}

final AsyncNotifierProvider<OnboardingController, OnboardingState> onboardingProvider =
    AsyncNotifierProvider<OnboardingController, OnboardingState>(OnboardingController.new);
