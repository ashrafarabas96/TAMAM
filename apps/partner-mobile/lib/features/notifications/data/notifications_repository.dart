import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/models/json.dart';
import 'package:tamam_partner/core/models/page.dart';
import 'package:tamam_partner/core/network/api_client.dart';
import 'package:tamam_partner/core/network/api_paths.dart';

/// One in-app notification (`NotificationDto`).
class AppNotification {
  const AppNotification({
    required this.id,
    required this.event,
    required this.title,
    required this.body,
    required this.createdAt,
    this.data,
    this.readAt,
  });

  factory AppNotification.fromJson(JsonMap json) => AppNotification(
        id: readStringOr(json, 'id', ''),
        event: NotificationEvent.fromValue(readString(json, 'event')) ?? NotificationEvent.promoCampaign,
        title: readStringOr(json, 'title', ''),
        body: readStringOr(json, 'body', ''),
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        data: asJsonMap(json['data']),
        readAt: readDateTime(json, 'readAt'),
      );

  final String id;
  final NotificationEvent event;
  final String title;
  final String body;
  final DateTime createdAt;
  final JsonMap? data;
  final DateTime? readAt;

  bool get isUnread => readAt == null;

  /// Deep link carried in the payload, if the notification points somewhere.
  String? get deepLink {
    final JsonMap? payload = data;
    if (payload == null) return null;
    final String? link = readString(payload, 'deepLink') ?? readString(payload, 'link');
    if (link != null && link.isNotEmpty) return link;
    final String? jobId = readString(payload, 'jobId');
    return jobId == null ? null : 'tamam://jobs/$jobId';
  }
}

/// Per-channel notification preferences.
class NotificationPreferences {
  const NotificationPreferences({
    required this.push,
    required this.sms,
    required this.email,
    required this.marketing,
  });

  factory NotificationPreferences.fromJson(JsonMap json) => NotificationPreferences(
        push: readBoolOr(json, 'push', true),
        sms: readBoolOr(json, 'sms', true),
        email: readBoolOr(json, 'email', false),
        marketing: readBoolOr(json, 'marketing', true),
      );

  final bool push;
  final bool sms;
  final bool email;
  final bool marketing;

  NotificationPreferences copyWith({bool? push, bool? sms, bool? email, bool? marketing}) =>
      NotificationPreferences(
        push: push ?? this.push,
        sms: sms ?? this.sms,
        email: email ?? this.email,
        marketing: marketing ?? this.marketing,
      );

  JsonMap toJson() => <String, Object?>{'push': push, 'sms': sms, 'email': email, 'marketing': marketing};
}

class NotificationsRepository {
  const NotificationsRepository(this._api);

  final ApiClient _api;

  Future<CursorPage<AppNotification>> list({String? cursor, bool unreadOnly = false, int limit = 20}) async {
    final JsonMap json = await _api.getObject(
      ApiPaths.notifications,
      query: <String, Object?>{'cursor': cursor, 'limit': limit, 'unreadOnly': unreadOnly},
    );
    return CursorPage<AppNotification>.fromJson(json, AppNotification.fromJson);
  }

  Future<int> unreadCount() async {
    final JsonMap json = await _api.getObject(ApiPaths.notificationsUnreadCount);
    return readIntOr(json, 'count', readIntOr(json, 'unread', 0));
  }

  /// Marks specific ids, or everything when [ids] is empty.
  Future<void> markRead({List<String> ids = const <String>[]}) async {
    await _api.postObject(
      ApiPaths.notificationsRead,
      body: <String, Object?>{'ids': ids.isEmpty ? 'all' : ids},
    );
  }

  Future<NotificationPreferences> preferences() async =>
      NotificationPreferences.fromJson(await _api.getObject(ApiPaths.notificationPreferences));

  Future<NotificationPreferences> updatePreferences(NotificationPreferences preferences) async =>
      NotificationPreferences.fromJson(
        await _api.putObject(ApiPaths.notificationPreferences, body: preferences.toJson()),
      );
}
