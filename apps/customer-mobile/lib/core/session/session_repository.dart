import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/network/api_client.dart';
import 'package:tamam_customer/core/network/api_paths.dart';
import 'package:tamam_customer/core/session/user.dart';

/// The session-scoped calls that are not part of the sign-in *flow*: reading the
/// current profile, updating it, ending sessions.
class SessionRepository {
  const SessionRepository(this._api);

  final ApiClient _api;

  Future<User> me() async => User.fromJson(await _api.getObject(ApiPaths.me));

  /// `PATCH /me` — used by the name-capture step and the profile screen.
  Future<User> updateProfile({
    String? fullName,
    String? email,
    String? language,
    String? profileImageMediaId,
    bool clearEmail = false,
  }) async {
    final JsonMap body = <String, Object?>{
      if (fullName != null) 'fullName': fullName,
      if (clearEmail) 'email': null else if (email != null) 'email': email,
      if (language != null) 'language': language,
      if (profileImageMediaId != null) 'profileImageMediaId': profileImageMediaId,
    };
    return User.fromJson(await _api.patchObject(ApiPaths.me, body: body));
  }

  /// Registers the push token for this device once messaging is wired up.
  Future<void> registerPushToken({
    required String deviceId,
    required String pushToken,
    required String platform,
  }) async {
    await _api.postObject(
      ApiPaths.pushToken,
      body: <String, Object?>{'deviceId': deviceId, 'pushToken': pushToken, 'platform': platform},
    );
  }

  Future<List<DeviceSession>> sessions() async {
    final List<JsonMap> raw = await _api.getList(ApiPaths.sessions);
    return raw.map(DeviceSession.fromJson).toList(growable: false);
  }

  Future<void> revokeSession(String id) => _api.delete(ApiPaths.session(id));

  /// `all: true` signs every device out — the "log out everywhere" action.
  Future<void> logout({bool all = false}) async {
    await _api.postObject(ApiPaths.logout, body: <String, Object?>{'all': all});
  }
}

/// One row in the active-devices list.
class DeviceSession {
  const DeviceSession({
    required this.id,
    required this.deviceId,
    required this.platform,
    required this.lastSeenAt,
    required this.createdAt,
    required this.isCurrent,
    this.deviceName,
    this.appVersion,
  });

  factory DeviceSession.fromJson(JsonMap json) => DeviceSession(
        id: readStringOr(json, 'id', ''),
        deviceId: readStringOr(json, 'deviceId', ''),
        platform: readStringOr(json, 'platform', 'unknown'),
        lastSeenAt: readDateTimeOr(json, 'lastSeenAt', DateTime.now()),
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        isCurrent: readBoolOr(json, 'current', false),
        deviceName: readString(json, 'deviceName'),
        appVersion: readString(json, 'appVersion'),
      );

  final String id;
  final String deviceId;
  final String platform;
  final DateTime lastSeenAt;
  final DateTime createdAt;
  final bool isCurrent;
  final String? deviceName;
  final String? appVersion;
}
