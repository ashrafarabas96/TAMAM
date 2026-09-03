import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/models/geo.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/features/chat/data/chat_repository.dart';
import 'package:tamam_partner/features/chat/presentation/chat_controller.dart';
import 'package:tamam_partner/features/media/data/media_repository.dart';
import 'package:tamam_partner/features/media/presentation/media_providers.dart';
import 'package:tamam_partner/features/location/presentation/work_session_controller.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// In-job chat with the customer: text, photos and a shared location.
///
/// Sending a location uses the work session's latest fix rather than asking
/// the GPS again — the partner is already being tracked, and a second request
/// would cost battery for nothing.
class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({required this.jobId, super.key});

  final String jobId;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();
  bool _sendingMedia = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(ref.read(chatProvider(widget.jobId).notifier).markRead());
    });
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final String text = _input.text.trim();
    if (text.isEmpty) return;
    _input.clear();
    await ref.read(chatProvider(widget.jobId).notifier).sendText(text);
    _scrollToBottom();
  }

  Future<void> _sendPhoto() async {
    setState(() => _sendingMedia = true);
    try {
      final MediaRepository media = ref.read(mediaRepositoryProvider);
      final List<Attachment> picked = await media.pickImages(fromCamera: true, limit: 1);
      if (picked.isEmpty) return;
      final Attachment uploaded = await media.upload(picked.first, purpose: MediaPurpose.chat);
      final String? mediaId = uploaded.mediaId;
      if (mediaId == null) return;
      await ref.read(chatProvider(widget.jobId).notifier).sendImage(mediaId);
      _scrollToBottom();
    } on Object catch (error) {
      if (mounted) AppFeedback.showFailure(context, asFailure(error));
    } finally {
      if (mounted) setState(() => _sendingMedia = false);
    }
  }

  Future<void> _sendLocation() async {
    final LocationSample? sample = await ref.read(workSessionProvider.notifier).freshSample();
    if (sample == null) {
      if (mounted) {
        AppFeedback.showMessage(context, context.l10n.locationUnavailable, icon: Icons.location_off_rounded);
      }
      return;
    }
    await ref.read(chatProvider(widget.jobId).notifier).sendLocation(GeoPoint(lat: sample.lat, lng: sample.lng));
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      unawaited(
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: TamamMotion.durationBase,
          curve: Curves.easeOut,
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final String? myId = ref.watch(currentUserIdProvider);

    return Scaffold(
      backgroundColor: context.colors.background,
      appBar: AppBar(
        title: Text(l10n.chatTitle),
        actions: <Widget>[
          Consumer(
            builder: (BuildContext context, WidgetRef ref, Widget? _) {
              final bool connected = ref.watch(chatProvider(widget.jobId)).valueOrNull?.connected ?? false;
              if (connected) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsetsDirectional.only(end: TamamSpacing.s3),
                child: Center(
                  child: StatusPill(
                    label: l10n.realtimeReconnecting,
                    tone: PillTone.warning,
                    icon: Icons.sync_rounded,
                    dense: true,
                  ),
                ),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: <Widget>[
          Expanded(
            child: AsyncView<ChatThread>(
              value: ref.watch(chatProvider(widget.jobId)),
              onRetry: () => ref.invalidate(chatProvider(widget.jobId)),
              isEmpty: (ChatThread thread) => thread.messages.isEmpty,
              emptyTitle: l10n.chatEmptyTitle,
              emptyMessage: l10n.chatEmptyBody,
              emptyIcon: Icons.chat_bubble_outline_rounded,
              builder: (ChatThread thread) => ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.all(TamamSpacing.s4),
                itemCount: thread.messages.length + (thread.hasMore ? 1 : 0),
                itemBuilder: (BuildContext context, int index) {
                  if (thread.hasMore && index == 0) {
                    return Center(
                      child: TextButton(
                        onPressed: () => unawaited(ref.read(chatProvider(widget.jobId).notifier).loadOlder()),
                        child: Text(l10n.chatLoadOlder),
                      ),
                    );
                  }
                  final ChatMessage message = thread.messages[thread.hasMore ? index - 1 : index];
                  return _Bubble(message: message, isMine: message.senderId == myId);
                },
              ),
            ),
          ),
          _Composer(
            controller: _input,
            sendingMedia: _sendingMedia,
            onSend: () => unawaited(_send()),
            onPhoto: () => unawaited(_sendPhoto()),
            onLocation: () => unawaited(_sendLocation()),
          ),
        ],
      ),
    );
  }
}

class _Bubble extends ConsumerWidget {
  const _Bubble({required this.message, required this.isMine});

  final ChatMessage message;
  final bool isMine;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    final Color background = isMine ? colors.surfaceBrand : colors.surface;
    final Color foreground = isMine ? colors.textOnBrand : colors.textPrimary;

    return Align(
      alignment: isMine ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
      child: Container(
        margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
        padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s3, vertical: TamamSpacing.s2),
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.76),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(TamamRadius.lg),
          border: isMine ? null : Border.all(color: colors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            _content(context, foreground),
            const SizedBox(height: 2),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  units.time(message.createdAt),
                  style: TamamType.labelSm.toTextStyle(
                    color: isMine ? TamamBrand.purple200 : colors.textTertiary,
                  ),
                ),
                if (isMine) ...<Widget>[
                  const SizedBox(width: 4),
                  Icon(
                    message.hasFailed
                        ? Icons.error_outline_rounded
                        : message.isPending
                            ? Icons.schedule_rounded
                            : message.isRead
                                ? Icons.done_all_rounded
                                : Icons.done_rounded,
                    size: 14,
                    color: message.hasFailed
                        ? colors.danger
                        : message.isRead
                            ? colors.accent
                            : TamamBrand.purple200,
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _content(BuildContext context, Color foreground) {
    switch (message.type) {
      case MessageType.image:
        return ClipRRect(
          borderRadius: BorderRadius.circular(TamamRadius.md),
          child: CachedNetworkImage(
            imageUrl: message.mediaUrl ?? '',
            width: 200,
            fit: BoxFit.cover,
            placeholder: (BuildContext _, String __) =>
                Container(width: 200, height: 140, color: context.colors.skeleton),
            errorWidget: (BuildContext _, String __, Object ___) =>
                Icon(Icons.broken_image_outlined, color: foreground),
          ),
        );
      case MessageType.location:
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(Icons.place_rounded, size: TamamSize.iconMd, color: foreground),
            const SizedBox(width: TamamSpacing.s1),
            Text(context.l10n.chatSharedLocation, style: TamamType.bodyMd.toTextStyle(color: foreground)),
          ],
        );
      case MessageType.text:
      case MessageType.system:
        return Text(message.text ?? '', style: TamamType.bodyMd.toTextStyle(color: foreground));
    }
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.onSend,
    required this.onPhoto,
    required this.onLocation,
    required this.sendingMedia,
  });

  final TextEditingController controller;
  final VoidCallback onSend;
  final VoidCallback onPhoto;
  final VoidCallback onLocation;
  final bool sendingMedia;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.all(TamamSpacing.s2),
        decoration: BoxDecoration(
          color: colors.surface,
          border: Border(top: BorderSide(color: colors.border)),
        ),
        child: Row(
          children: <Widget>[
            IconButton(
              tooltip: l10n.chatSendPhoto,
              onPressed: sendingMedia ? null : onPhoto,
              icon: sendingMedia
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.photo_camera_outlined),
            ),
            IconButton(
              tooltip: l10n.chatSendLocation,
              onPressed: onLocation,
              icon: const Icon(Icons.near_me_outlined),
            ),
            Expanded(
              child: TextField(
                controller: controller,
                textInputAction: TextInputAction.send,
                onSubmitted: (String _) => onSend(),
                minLines: 1,
                maxLines: 4,
                decoration: InputDecoration(
                  hintText: l10n.chatHint,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: TamamSpacing.s3,
                    vertical: TamamSpacing.s3,
                  ),
                ),
              ),
            ),
            const SizedBox(width: TamamSpacing.s2),
            IconButton.filled(
              tooltip: l10n.actionSend,
              onPressed: onSend,
              style: IconButton.styleFrom(
                backgroundColor: colors.primary,
                foregroundColor: colors.textOnBrand,
                minimumSize: const Size(TamamSize.touchTargetMin, TamamSize.touchTargetMin),
              ),
              icon: const Icon(Icons.send_rounded),
            ),
          ],
        ),
      ),
    );
  }
}
