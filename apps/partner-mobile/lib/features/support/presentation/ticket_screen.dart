import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/features/support/data/support_repository.dart';
import 'package:tamam_partner/features/support/presentation/support_providers.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// One support conversation, as a thread the partner can reply to.
class TicketScreen extends ConsumerStatefulWidget {
  const TicketScreen({required this.ticketId, super.key});

  final String ticketId;

  @override
  ConsumerState<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends ConsumerState<TicketScreen> {
  final TextEditingController _reply = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _reply.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final String text = _reply.text.trim();
    if (text.isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref.read(supportRepositoryProvider).replyToTicket(widget.ticketId, text: text);
      _reply.clear();
      ref.invalidate(supportTicketProvider(widget.ticketId));
    } on Object catch (error) {
      if (mounted) AppFeedback.showFailure(context, asFailure(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    final TamamColors colors = context.colors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.supportTicketTitle)),
      body: AsyncView<SupportTicket>(
        value: ref.watch(supportTicketProvider(widget.ticketId)),
        onRetry: () => ref.invalidate(supportTicketProvider(widget.ticketId)),
        builder: (SupportTicket ticket) => Column(
          children: <Widget>[
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(TamamSpacing.s4),
                children: <Widget>[
                  Text(ticket.subject, style: TamamType.headingMd.toTextStyle(color: colors.textPrimary)),
                  const SizedBox(height: TamamSpacing.s1),
                  Text(
                    '${ticket.number} · ${units.dateTime(ticket.createdAt)}',
                    textDirection: TextDirection.ltr,
                    style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                  ),
                  const SizedBox(height: TamamSpacing.s4),
                  _Message(
                    text: ticket.description,
                    fromAgent: false,
                    time: units.dateTime(ticket.createdAt),
                  ),
                  for (final SupportMessage message in ticket.messages)
                    _Message(
                      text: message.text,
                      fromAgent: message.isFromAgent,
                      time: units.dateTime(message.createdAt),
                      author: message.authorName,
                    ),
                ],
              ),
            ),
            if (ticket.isOpen)
              SafeArea(
                top: false,
                child: Container(
                  padding: const EdgeInsets.all(TamamSpacing.s2),
                  decoration: BoxDecoration(
                    color: colors.surface,
                    border: Border(top: BorderSide(color: colors.border)),
                  ),
                  child: Row(
                    children: <Widget>[
                      Expanded(
                        child: TextField(
                          controller: _reply,
                          minLines: 1,
                          maxLines: 4,
                          decoration: InputDecoration(hintText: l10n.supportReplyHint, isDense: true),
                        ),
                      ),
                      const SizedBox(width: TamamSpacing.s2),
                      IconButton.filled(
                        tooltip: l10n.actionSend,
                        onPressed: _busy ? null : () => unawaited(_send()),
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
              ),
          ],
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.text, required this.fromAgent, required this.time, this.author});

  final String text;
  final bool fromAgent;
  final String time;
  final String? author;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Align(
      alignment: fromAgent ? AlignmentDirectional.centerStart : AlignmentDirectional.centerEnd,
      child: Container(
        margin: const EdgeInsets.only(bottom: TamamSpacing.s3),
        padding: const EdgeInsets.all(TamamSpacing.s3),
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
        decoration: BoxDecoration(
          color: fromAgent ? colors.surface : colors.surfaceBrandSoft,
          borderRadius: BorderRadius.circular(TamamRadius.lg),
          border: Border.all(color: colors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            if (author != null && fromAgent)
              Text(author!, style: TamamType.labelSm.toTextStyle(color: colors.primary)),
            Text(text, style: TamamType.bodyMd.toTextStyle(color: colors.textPrimary)),
            const SizedBox(height: 2),
            Text(time, style: TamamType.labelSm.toTextStyle(color: colors.textTertiary)),
          ],
        ),
      ),
    );
  }
}
