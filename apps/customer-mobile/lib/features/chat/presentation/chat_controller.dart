import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/models/page.dart';
import 'package:tamam_customer/core/network/app_failure.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/realtime/realtime_providers.dart';
import 'package:tamam_customer/core/realtime/socket_client.dart';
import 'package:tamam_customer/features/chat/data/chat_repository.dart';
import 'package:uuid/uuid.dart';

final Provider<ChatRepository> chatRepositoryProvider =
    Provider<ChatRepository>((Ref ref) => ChatRepository(ref.watch(apiClientProvider)));

/// The messages of one job's chat, newest last.
class ChatThread {
  const ChatThread({
    required this.messages,
    required this.connected,
    this.nextCursor,
  });

  final List<ChatMessage> messages;

  /// `true` when the chat socket is live; otherwise sends go over REST.
  final bool connected;
  final String? nextCursor;

  bool get hasMore => nextCursor != null && nextCursor!.isNotEmpty;

  ChatThread copyWith({List<ChatMessage>? messages, bool? connected, String? nextCursor}) => ChatThread(
        messages: messages ?? this.messages,
        connected: connected ?? this.connected,
        nextCursor: nextCursor ?? this.nextCursor,
      );
}

/// Chat for one job.
///
/// Messages are sent over REST (the reliable path) and *received* over the
/// socket; an optimistic bubble appears immediately and is replaced by the
/// server's copy, so a slow network never hides what the customer typed.
class ChatController extends AutoDisposeFamilyAsyncNotifier<ChatThread, String> {
  StreamSubscription<SocketEvent>? _events;
  StreamSubscription<SocketStatus>? _status;

  @override
  Future<ChatThread> build(String arg) async {
    final CursorPage<ChatMessage> page = await ref.watch(chatRepositoryProvider).messages(arg);
    final List<ChatMessage> ordered = page.items.reversed.toList(growable: false);

    ref.onDispose(_detach);
    unawaited(_attach(arg));

    return ChatThread(messages: ordered, connected: false, nextCursor: page.nextCursor);
  }

  Future<void> loadOlder() async {
    final ChatThread? current = state.valueOrNull;
    if (current == null || !current.hasMore) return;
    try {
      final CursorPage<ChatMessage> page =
          await ref.read(chatRepositoryProvider).messages(arg, cursor: current.nextCursor);
      state = AsyncValue<ChatThread>.data(
        current.copyWith(
          messages: <ChatMessage>[...page.items.reversed, ...current.messages],
          nextCursor: page.nextCursor,
        ),
      );
    } on AppFailure {
      // Older history stays unavailable until the next attempt.
    }
  }

  Future<void> sendText(String text) => _send(type: MessageType.text, text: text.trim());

  Future<void> sendImage(String mediaId) => _send(type: MessageType.image, mediaId: mediaId);

  Future<void> sendLocation(GeoPoint point) => _send(type: MessageType.location, location: point);

  /// Marks everything up to the newest message as read.
  Future<void> markRead() async {
    final ChatThread? current = state.valueOrNull;
    if (current == null || current.messages.isEmpty) return;
    final ChatMessage last = current.messages.last;
    if (last.isPending) return;
    try {
      await ref.read(chatRepositoryProvider).markRead(arg, upToMessageId: last.id);
    } on AppFailure {
      // Read receipts are best-effort.
    }
  }

  Future<void> _send({
    required MessageType type,
    String? text,
    String? mediaId,
    GeoPoint? location,
  }) async {
    final ChatThread? current = state.valueOrNull;
    if (current == null) return;
    if (type == MessageType.text && (text == null || text.isEmpty)) return;

    final String clientId = const Uuid().v4();
    final String senderId = ref.read(currentUserIdProvider) ?? '';
    final ChatMessage optimistic = ChatMessage.pending(
      clientId: clientId,
      senderId: senderId,
      type: type,
      text: text,
      location: location,
    );
    state = AsyncValue<ChatThread>.data(
      current.copyWith(messages: <ChatMessage>[...current.messages, optimistic]),
    );

    try {
      final ChatMessage sent = await ref.read(chatRepositoryProvider).send(
            arg,
            type: type,
            clientMessageId: clientId,
            text: text,
            mediaId: mediaId,
            location: location,
          );
      _replace(clientId, sent);
    } on AppFailure {
      _replace(clientId, optimistic.copyWith(isPending: false, hasFailed: true));
    }
  }

  Future<void> _attach(String jobId) async {
    final SocketClient socket = ref.read(chatSocketProvider);
    _status = socket.statusChanges.listen((SocketStatus status) {
      final ChatThread? current = state.valueOrNull;
      if (current == null) return;
      state = AsyncValue<ChatThread>.data(
        current.copyWith(connected: status == SocketStatus.connected),
      );
      if (status == SocketStatus.connected) {
        socket.emit(WsEvent.subscribeJob, <String, Object?>{'jobId': jobId});
      }
    });
    _events = socket.events.listen((SocketEvent event) {
      if (event.name != WsEvent.chatMessage) return;
      final ChatMessage message = ChatMessage.fromJson(event.data);
      _upsert(message);
    });
    await socket.connect();
    if (socket.isConnected) socket.emit(WsEvent.subscribeJob, <String, Object?>{'jobId': jobId});
  }

  void _detach() {
    unawaited(_events?.cancel());
    _events = null;
    unawaited(_status?.cancel());
    _status = null;
  }

  /// Inserts a server message, replacing the optimistic bubble it belongs to.
  void _upsert(ChatMessage message) {
    final ChatThread? current = state.valueOrNull;
    if (current == null) return;
    final List<ChatMessage> next = <ChatMessage>[];
    bool replaced = false;
    for (final ChatMessage existing in current.messages) {
      final bool sameServerId = existing.id == message.id && !existing.isPending;
      final bool sameClientId = message.clientMessageId != null &&
          existing.clientMessageId == message.clientMessageId;
      if (sameServerId || sameClientId) {
        next.add(message);
        replaced = true;
      } else {
        next.add(existing);
      }
    }
    if (!replaced) next.add(message);
    state = AsyncValue<ChatThread>.data(current.copyWith(messages: next));
  }

  void _replace(String clientId, ChatMessage message) {
    final ChatThread? current = state.valueOrNull;
    if (current == null) return;
    state = AsyncValue<ChatThread>.data(
      current.copyWith(
        messages: current.messages
            .map((ChatMessage m) => m.clientMessageId == clientId ? message : m)
            .toList(growable: false),
      ),
    );
  }
}

final AutoDisposeAsyncNotifierProviderFamily<ChatController, ChatThread, String> chatProvider =
    AsyncNotifierProvider.autoDispose.family<ChatController, ChatThread, String>(ChatController.new);
