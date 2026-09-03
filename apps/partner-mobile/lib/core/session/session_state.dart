import 'package:flutter/foundation.dart';
import 'package:tamam_partner/core/session/user.dart';

/// Where the app is in the sign-in lifecycle.
enum AuthStatus {
  /// Tokens have not been read from secure storage yet — the splash is showing.
  unknown,
  signedOut,

  /// Signed in, but the partner profile is not approved yet: the app shows the
  /// onboarding wizard or the review/rejection status screen.
  onboarding,
  signedIn,
}

/// Root auth state that `go_router` redirects on.
@immutable
class SessionState {
  const SessionState({
    required this.status,
    this.user,
    this.signedOutReason,
  });

  const SessionState.unknown()
      : status = AuthStatus.unknown,
        user = null,
        signedOutReason = null;

  final AuthStatus status;
  final User? user;

  /// Set when the session ended without the partner asking (token revoked,
  /// account suspended); the sign-in screen explains why.
  final SignedOutReason? signedOutReason;

  bool get isAuthenticated => status == AuthStatus.signedIn || status == AuthStatus.onboarding;
  bool get isResolved => status != AuthStatus.unknown;

  /// `true` only when the partner may work: approved profile, active account.
  bool get canWork => status == AuthStatus.signedIn;

  SessionState copyWith({AuthStatus? status, User? user, SignedOutReason? signedOutReason, bool clearUser = false}) =>
      SessionState(
        status: status ?? this.status,
        user: clearUser ? null : (user ?? this.user),
        signedOutReason: signedOutReason,
      );
}

/// Why an active session ended.
enum SignedOutReason { expired, suspended, revoked, userRequested }
