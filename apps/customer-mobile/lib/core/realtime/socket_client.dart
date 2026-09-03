import 'dart:async';

import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:tamam_customer/core/models/json.dart';

/// One event received from a namespace.
class SocketEvent {
  const SocketEvent(this.name, this.data);

  final String name;
  final JsonMap data;
}

/// Connection state exposed to the UI, so a screen can show "reconnecting…"
/// and fall back to REST polling.
enum SocketStatus { idle, connecting, connected, disconnected, unauthorized }

/// A thin, testable wrapper around one Socket.IO namespace.
///
/// Realtime is always an *optimisation* in this app: every screen that uses it
/// also polls REST, so a dropped socket degrades quality, never correctness.
class SocketClient {
  SocketClient({
    required String baseUrl,
    required String namespace,
    required Future<String?> Function() accessToken,
    List<String> listenTo = const <String>[],
  })  : _url = '$baseUrl$namespace',
        _accessToken = accessToken,
        _listenTo = listenTo;

  final String _url;
  final Future<String?> Function() _accessToken;
  final List<String> _listenTo;

  final StreamController<SocketEvent> _events = StreamController<SocketEvent>.broadcast();
  final StreamController<SocketStatus> _status = StreamController<SocketStatus>.broadcast();

  io.Socket? _socket;
  SocketStatus _current = SocketStatus.idle;

  Stream<SocketEvent> get events => _events.stream;

  Stream<SocketStatus> get statusChanges => _status.stream;

  SocketStatus get status => _current;

  bool get isConnected => _current == SocketStatus.connected;

  /// Events for one name only — the shape every listener actually wants.
  Stream<JsonMap> on(String event) =>
      _events.stream.where((SocketEvent e) => e.name == event).map((SocketEvent e) => e.data);

  /// Connects (idempotently). Without a token the socket is not opened at all:
  /// the gateway would reject the handshake anyway.
  Future<void> connect() async {
    if (_socket != null) return;
    final String? token = await _accessToken();
    if (token == null || token.isEmpty) {
      _emitStatus(SocketStatus.unauthorized);
      return;
    }
    _emitStatus(SocketStatus.connecting);

    final io.Socket socket = io.io(
      _url,
      io.OptionBuilder()
          .setTransports(<String>['websocket'])
          .disableAutoConnect()
          .enableReconnection()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(8000)
          .setAuth(<String, dynamic>{'token': token})
          .build(),
    );

    socket
      ..onConnect((Object? _) => _emitStatus(SocketStatus.connected))
      ..onDisconnect((Object? _) => _emitStatus(SocketStatus.disconnected))
      ..onConnectError((Object? _) => _emitStatus(SocketStatus.disconnected))
      ..onError((Object? _) => _emitStatus(SocketStatus.disconnected));

    for (final String event in _listenTo) {
      socket.on(event, (Object? data) => _push(event, data));
    }

    _socket = socket;
    socket.connect();
  }

  /// Re-authenticates after a token refresh: the handshake carries the token, so
  /// the only way to apply a new one is a fresh connection.
  Future<void> reconnectWithFreshToken() async {
    await disconnect();
    await connect();
  }

  void emit(String event, JsonMap payload) => _socket?.emit(event, payload);

  Future<void> disconnect() async {
    final io.Socket? socket = _socket;
    _socket = null;
    if (socket == null) return;
    socket
      ..clearListeners()
      ..disconnect()
      ..dispose();
    _emitStatus(SocketStatus.idle);
  }

  Future<void> dispose() async {
    await disconnect();
    await _events.close();
    await _status.close();
  }

  void _push(String event, Object? data) {
    final JsonMap? map = asJsonMap(data);
    if (map != null && !_events.isClosed) _events.add(SocketEvent(event, map));
  }

  void _emitStatus(SocketStatus next) {
    _current = next;
    if (!_status.isClosed) _status.add(next);
  }
}
