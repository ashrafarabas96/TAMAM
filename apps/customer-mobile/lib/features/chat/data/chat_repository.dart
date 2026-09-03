import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/models/json.dart';
import 'package:tamam_customer/core/models/page.dart';
import 'package:tamam_customer/core/network/api_client.dart';
import 'package:tamam_customer/core/network/api_paths.dart';

/// One chat message (`ChatMessageDto`).
class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.chatId,
    required this.senderId,
    required this.type,
    required this.createdAt,
    this.text,
    this.mediaUrl,
    this.location,
    this.deliveredAt,
    this.readAt,
    this.isPending = false,
    this.hasFailed = false,
    this.clientMessageId,
  });

  factory ChatMessage.fromJson(JsonMap json) => ChatMessage(
        id: readStringOr(json, 'id', ''),
        chatId: readStringOr(json, 'chatId', ''),
        senderId: readStringOr(json, 'senderId', ''),
        type: MessageType.fromValue(readString(json, 'type')) ?? MessageType.text,
        createdAt: readDateTimeOr(json, 'createdAt', DateTime.now()),
        text: readString(json, 'text'),
        mediaUrl: readString(json, 'mediaUrl'),
        location: readObject<GeoPoint>(json, 'location', GeoPoint.fromJson),
        deliveredAt: readDateTime(json, 'deliveredAt'),
        readAt: readDateTime(json, 'readAt'),
        clientMessageId: readString(json, 'clientMessageId'),
      );

  /// An optimistic message shown immediately while the request is in flight.
  ChatMessage.pending({
    required String clientId,
    required this.senderId,
    required this.type,
    this.text,
    this.mediaUrl,
    this.location,
  })  : id = clientId,
        clientMessageId = clientId,
        chatId = '',
        createdAt = DateTime.now(),
        deliveredAt = null,
        readAt = null,
        isPending = true,
        hasFailed = false;

  final String id;
  final String chatId;
  final String senderId;
  final MessageType type;
  final DateTime createdAt;
  final String? text;
  final String? mediaUrl;
  final GeoPoint? location;
  final DateTime? deliveredAt;
  final DateTime? readAt;

  /// Local-only flags for the optimistic send lifecycle.
  final bool isPending;
  final bool hasFailed;
  final String? clientMessageId;

  bool get isRead => readAt != null;
  bool get isDelivered => deliveredAt != null;

  ChatMessage copyWith({bool? isPending, bool? hasFailed}) => ChatMessage(
        id: id,
        chatId: chatId,
        senderId: senderId,
        type: type,
        createdAt: createdAt,
        text: text,
        mediaUrl: mediaUrl,
        location: location,
        deliveredAt: deliveredAt,
        readAt: readAt,
        isPending: isPending ?? this.isPending,
        hasFailed: hasFailed ?? this.hasFailed,
        clientMessageId: clientMessageId,
      );
}

/// REST side of in-job chat. The socket delivers messages live; these calls
/// load history and act as the send fallback when the socket is down.
class ChatRepository {
  const ChatRepository(this._api);

  final ApiClient _api;

  Future<CursorPage<ChatMessage>> messages(String jobId, {String? cursor, int limit = 30}) async {
    final JsonMap json = await _api.getObject(
      ApiPaths.jobChatMessages(jobId),
      query: <String, Object?>{'cursor': cursor, 'limit': limit},
    );
    return CursorPage<ChatMessage>.fromJson(json, ChatMessage.fromJson);
  }

  Future<ChatMessage> send(
    String jobId, {
    required MessageType type,
    required String clientMessageId,
    String? text,
    String? mediaId,
    GeoPoint? location,
  }) async =>
      ChatMessage.fromJson(
        await _api.postObject(
          ApiPaths.jobChatMessages(jobId),
          body: <String, Object?>{
            'type': type.value,
            'clientMessageId': clientMessageId,
            if (text != null) 'text': text,
            if (mediaId != null) 'mediaId': mediaId,
            if (location != null) 'location': location.toJson(),
          },
        ),
      );

  Future<void> markRead(String jobId, {required String upToMessageId}) async {
    await _api.postObject(
      ApiPaths.jobChatRead(jobId),
      body: <String, Object?>{'upToMessageId': upToMessageId},
    );
  }
}
