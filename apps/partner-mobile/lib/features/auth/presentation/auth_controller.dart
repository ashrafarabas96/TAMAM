import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/device/device_info.dart';
import 'package:tamam_partner/core/device/push_token_provider.dart';
import 'package:tamam_partner/core/network/app_failure.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/features/auth/data/auth_repository.dart';

final Provider<AuthRepository> authRepositoryProvider =
    Provider<AuthRepository>((Ref ref) => AuthRepository(ref.watch(apiClientProvider)));

/// State of the phone + OTP flow.
class AuthFlowState {
  const AuthFlowState({
    this.phone,
    this.challenge,
    this.busy = false,
    this.failure,
    this.verified = false,
  });

  final String? phone;
  final OtpChallenge? challenge;
  final bool busy;
  final AppFailure? failure;

  /// Set once `verifyOtp` succeeded and the session was stored.
  final bool verified;

  AuthFlowState copyWith({
    String? phone,
    OtpChallenge? challenge,
    bool? busy,
    AppFailure? failure,
    bool? verified,
    bool clearFailure = false,
  }) =>
      AuthFlowState(
        phone: phone ?? this.phone,
        challenge: challenge ?? this.challenge,
        busy: busy ?? this.busy,
        failure: clearFailure ? null : (failure ?? this.failure),
        verified: verified ?? this.verified,
      );
}

/// Drives OTP request, resend and verification.
///
/// The screens stay declarative: they render [AuthFlowState] and call these
/// methods; no networking or token handling lives in a widget. Where the
/// partner lands afterwards (wizard, review screen or home) is decided by the
/// router from the session's `verificationStatus`.
class AuthController extends Notifier<AuthFlowState> {
  @override
  AuthFlowState build() => const AuthFlowState();

  /// Requests a code. Returns `true` when the OTP screen should be shown.
  Future<bool> requestOtp(String phone) async {
    state = state.copyWith(busy: true, phone: phone, clearFailure: true);
    try {
      final OtpChallenge challenge = await ref.read(authRepositoryProvider).requestOtp(
            phone: phone,
            language: ref.read(localeControllerProvider).languageCode,
          );
      state = state.copyWith(busy: false, challenge: challenge, verified: false);
      return true;
    } on Object catch (error) {
      state = state.copyWith(busy: false, failure: asFailure(error));
      return false;
    }
  }

  /// Re-requests a code for the phone already in state.
  Future<bool> resend() async {
    final String? phone = state.phone;
    if (phone == null) return false;
    return requestOtp(phone);
  }

  /// Verifies the code and installs the session. Returns `true` on success.
  Future<bool> verify(String code) async {
    final String? phone = state.phone;
    if (phone == null) return false;
    state = state.copyWith(busy: true, clearFailure: true);
    try {
      final DeviceProfile device = await ref.read(deviceProfileHolderProvider).get();
      final PushTokenProvider push = ref.read(pushTokenProviderProvider);
      final AuthSessionResult result = await ref.read(authRepositoryProvider).verifyOtp(
            phone: phone,
            code: code,
            device: device,
            language: ref.read(localeControllerProvider).languageCode,
            pushToken: await push.token(),
          );
      await ref.read(sessionControllerProvider.notifier).completeSignIn(
            tokens: result.tokens,
            user: result.user,
          );
      // Flags are per-user (rollout targeting), so re-read them for this session.
      ref.read(featureFlagsProvider.notifier).reload();
      state = state.copyWith(busy: false, verified: true);
      return true;
    } on Object catch (error) {
      state = state.copyWith(busy: false, failure: asFailure(error));
      return false;
    }
  }

  void clearFailure() => state = state.copyWith(clearFailure: true);

  /// Resets the flow when the partner edits their phone number.
  void reset() => state = const AuthFlowState();
}

final NotifierProvider<AuthController, AuthFlowState> authControllerProvider =
    NotifierProvider<AuthController, AuthFlowState>(AuthController.new);
