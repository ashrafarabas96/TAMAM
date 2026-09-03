import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

/// A single, boolean view of connectivity for the whole app.
///
/// `connectivity_plus` reports *interfaces*, not reachability, so this is used
/// only to fail fast and to show the offline banner — a request is still the
/// authority on whether the API is reachable.
class ConnectivityService {
  ConnectivityService(this._connectivity) {
    _subscription = _connectivity.onConnectivityChanged.listen(_onResults);
    unawaited(_prime());
  }

  final Connectivity _connectivity;
  final StreamController<bool> _controller = StreamController<bool>.broadcast();
  StreamSubscription<List<ConnectivityResult>>? _subscription;
  bool _online = true;

  /// Last known state; optimistic until the first platform answer arrives.
  bool get isOnline => _online;

  /// Emits on every transition (and once with the initial value).
  Stream<bool> get onStatusChanged => _controller.stream;

  Future<bool> refresh() async {
    _onResults(await _connectivity.checkConnectivity());
    return _online;
  }

  Future<void> _prime() async {
    try {
      await refresh();
    } on Object {
      // A platform that cannot answer is treated as online; requests will tell us.
      _online = true;
    }
  }

  void _onResults(List<ConnectivityResult> results) {
    final bool next = results.any((ConnectivityResult r) => r != ConnectivityResult.none);
    _online = next;
    if (!_controller.isClosed) _controller.add(next);
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    _subscription = null;
    await _controller.close();
  }
}
