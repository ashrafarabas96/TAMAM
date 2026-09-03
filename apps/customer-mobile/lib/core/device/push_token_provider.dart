/// Push registration is kept behind an interface so the app compiles and runs
/// without a Firebase project, and so the messaging SDK never leaks into
/// feature code.
///
/// Wiring FCM (see README → "Push notifications"):
///  1. add `firebase_core` + `firebase_messaging`, run `flutterfire configure`;
///  2. implement [PushTokenProvider] with `FirebaseMessaging.instance`
///     (`requestPermission`, `getToken`, `onTokenRefresh`);
///  3. override `pushTokenProviderProvider` in `main.dart` with it.
abstract interface class PushTokenProvider {
  /// Asks the OS for notification permission. Returns whether it was granted.
  Future<bool> requestPermission();

  /// The current registration token, or `null` when unavailable/denied.
  Future<String?> token();

  /// Emits whenever the platform rotates the token.
  Stream<String> get onTokenRefresh;
}

/// The default implementation: no messaging SDK, no token, no permission prompt.
///
/// Every caller already treats a null token as "push not available", so the app
/// behaves correctly (in-app notifications only) until FCM is configured.
class NoopPushTokenProvider implements PushTokenProvider {
  const NoopPushTokenProvider();

  @override
  Future<bool> requestPermission() async => false;

  @override
  Future<String?> token() async => null;

  @override
  Stream<String> get onTokenRefresh => const Stream<String>.empty();
}
