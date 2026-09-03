import 'dart:async';

/// A registry of "stop everything" callbacks the session runs on sign-out.
///
/// The partner app keeps work running outside the widget tree (location stream,
/// foreground service, sockets). Those must stop the moment a session ends —
/// including an involuntary end such as a revoked token — so this registry lets
/// feature code hook into the session without `core` depending on `features`.
class SessionTeardown {
  final List<Future<void> Function()> _callbacks = <Future<void> Function()>[];

  /// Registers [callback]; returns a function that unregisters it again.
  void Function() register(Future<void> Function() callback) {
    _callbacks.add(callback);
    return () => _callbacks.remove(callback);
  }

  /// Runs every callback, ignoring individual failures: one stubborn subsystem
  /// must never prevent the others from shutting down.
  Future<void> run() async {
    for (final Future<void> Function() callback in List<Future<void> Function()>.of(_callbacks)) {
      try {
        await callback();
      } on Object {
        continue;
      }
    }
  }
}
