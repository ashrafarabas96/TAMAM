import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/session/session_repository.dart';
import 'package:tamam_customer/core/session/session_state.dart';
import 'package:tamam_customer/core/session/user.dart';
import 'package:tamam_customer/core/storage/prefs_store.dart';
import 'package:tamam_customer/core/storage/secure_token_store.dart';

/// Owns "who is signed in" for the whole app.
///
/// The router listens to this notifier, so every redirect (splash → onboarding
/// → sign-in → home) is a consequence of a single state value rather than
/// navigation scattered across screens.
class SessionController extends Notifier<SessionState> {
  @override
  SessionState build() => const SessionState.unknown();

  SecureTokenStore get _tokens => ref.read(secureTokenStoreProvider);
  SessionRepository get _repository => ref.read(sessionRepositoryProvider);
  PrefsStore get _prefs => ref.read(prefsStoreProvider);

  /// Reads persisted tokens and resolves the profile. Called once from the
  /// splash screen; failures degrade to "signed out" rather than blocking.
  Future<void> bootstrap() async {
    final AuthTokens? tokens = await _tokens.read();
    if (tokens == null) {
      state = const SessionState(status: AuthStatus.signedOut);
      return;
    }
    try {
      final User user = await _repository.me();
      _apply(user);
    } on AppFailure catch (failure) {
      if (failure.isNetwork) {
        // Offline start: keep the session, let screens show their offline state.
        state = const SessionState(status: AuthStatus.signedIn);
        return;
      }
      await _forceSignOut(_reasonFor(failure));
    }
  }

  /// Called by the OTP flow once `POST /auth/otp/verify` succeeded.
  Future<void> completeSignIn({required AuthTokens tokens, required User user}) async {
    await _tokens.write(tokens);
    _apply(user);
  }

  /// Re-reads `GET /me` after a profile edit or a language change.
  Future<void> refreshUser() async {
    if (!state.isAuthenticated) return;
    try {
      _apply(await _repository.me());
    } on AppFailure catch (failure) {
      if (!failure.isNetwork && !failure.isAuth) rethrow;
    }
  }

  /// Applies a user object the caller already fetched (e.g. `PATCH /me`).
  void setUser(User user) => _apply(user);

  /// Explicit sign-out from the account screen.
  Future<void> signOut({bool allDevices = false}) async {
    try {
      await _repository.logout(all: allDevices);
    } on AppFailure {
      // The local session is cleared regardless — the server session expires anyway.
    }
    await _forceSignOut(SignedOutReason.userRequested);
  }

  /// Invoked by the auth interceptor when a refresh definitively failed.
  Future<void> handleTokensLost() => _forceSignOut(SignedOutReason.expired);

  Future<void> _forceSignOut(SignedOutReason reason) async {
    await _tokens.clear();
    await _prefs.clearUserScopedData();
    state = SessionState(status: AuthStatus.signedOut, signedOutReason: reason);
  }

  void _apply(User user) {
    if (user.isSuspended) {
      unawaited(_forceSignOut(SignedOutReason.suspended));
      return;
    }
    state = SessionState(
      status: user.needsName ? AuthStatus.needsProfile : AuthStatus.signedIn,
      user: user,
    );
  }

  SignedOutReason _reasonFor(AppFailure failure) {
    switch (failure.code) {
      case ErrorCode.accountSuspended:
        return SignedOutReason.suspended;
      case ErrorCode.tokenRevoked:
        return SignedOutReason.revoked;
      default:
        return SignedOutReason.expired;
    }
  }
}
