import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

/// The device telemetry the heartbeat carries (`heartbeatSchema`).
///
/// Dispatch uses it to prefer partners whose phone will survive the job, so a
/// missing value is reported as absent rather than guessed.
class DeviceMetrics {
  const DeviceMetrics({this.batteryPercent, this.networkType});

  /// 0..100, or `null` when the platform refuses to answer.
  final int? batteryPercent;

  /// `wifi`, `cellular` or `unknown` — the only values the API accepts.
  final String? networkType;
}

/// Reads battery level and network type without ever throwing.
class DeviceMetricsReader {
  DeviceMetricsReader({Battery? battery, Connectivity? connectivity})
      : _battery = battery ?? Battery(),
        _connectivity = connectivity ?? Connectivity();

  final Battery _battery;
  final Connectivity _connectivity;

  Future<DeviceMetrics> read() async => DeviceMetrics(
        batteryPercent: await _batteryPercent(),
        networkType: await _networkType(),
      );

  Future<int?> _batteryPercent() async {
    try {
      final int level = await _battery.batteryLevel;
      return level < 0 ? null : level.clamp(0, 100);
    } on Object {
      // Emulators and some OEM ROMs have no battery service.
      return null;
    }
  }

  Future<String?> _networkType() async {
    try {
      final List<ConnectivityResult> results = await _connectivity.checkConnectivity();
      if (results.contains(ConnectivityResult.wifi) || results.contains(ConnectivityResult.ethernet)) {
        return 'wifi';
      }
      if (results.contains(ConnectivityResult.mobile)) return 'cellular';
      return 'unknown';
    } on Object {
      return null;
    }
  }
}
