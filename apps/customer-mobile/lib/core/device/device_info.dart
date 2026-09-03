import 'dart:io' show Platform;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/storage/prefs_store.dart';
import 'package:uuid/uuid.dart';

/// The `device` object every auth call carries, plus the header values.
class DeviceProfile {
  const DeviceProfile({
    required this.deviceId,
    required this.deviceName,
    required this.platform,
    required this.appVersion,
  });

  /// Stable per install; regenerated only when the app data is cleared.
  final String deviceId;
  final String deviceName;

  /// `ios` / `android` / `unknown` — the values `deviceInfoSchema` accepts.
  final String platform;
  final String appVersion;

  JsonMap toJson({String? pushToken}) => <String, Object?>{
        'deviceId': deviceId,
        'deviceName': deviceName,
        'platform': platform,
        'appVersion': appVersion,
        if (pushToken != null && pushToken.isNotEmpty) 'pushToken': pushToken,
      };
}

/// Resolves (and persists) the device identity used for sessions and headers.
class DeviceInfoLoader {
  DeviceInfoLoader(this._prefs);

  final PrefsStore _prefs;

  Future<DeviceProfile> load() async {
    final String deviceId = _prefs.getString(PrefsStore.keyDeviceId) ?? await _createDeviceId();
    final PackageInfo package = await PackageInfo.fromPlatform();
    final String version = '${package.version}+${package.buildNumber}';
    return DeviceProfile(
      deviceId: deviceId,
      deviceName: await _deviceName(),
      platform: _platform(),
      appVersion: version,
    );
  }

  Future<String> _createDeviceId() async {
    final String id = const Uuid().v4();
    await _prefs.setString(PrefsStore.keyDeviceId, id);
    return id;
  }

  String _platform() {
    if (Platform.isAndroid) return 'android';
    if (Platform.isIOS) return 'ios';
    return 'unknown';
  }

  Future<String> _deviceName() async {
    final DeviceInfoPlugin plugin = DeviceInfoPlugin();
    if (Platform.isAndroid) {
      final AndroidDeviceInfo info = await plugin.androidInfo;
      return '${info.manufacturer} ${info.model}'.trim();
    }
    if (Platform.isIOS) {
      final IosDeviceInfo info = await plugin.iosInfo;
      return '${info.name} (${info.model})'.trim();
    }
    return 'Unknown device';
  }
}
