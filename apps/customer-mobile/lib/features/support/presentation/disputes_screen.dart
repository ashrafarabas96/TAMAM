import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/format/unit_formatter.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/core/widgets/async_view.dart';
import 'package:tamam_customer/core/widgets/money_text.dart';
import 'package:tamam_customer/core/widgets/status_pill.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/support/data/support_repository.dart';
import 'package:tamam_customer/features/support/presentation/support_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// The customer's disputes.
class DisputesScreen extends ConsumerWidget {
  const DisputesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final UnitFormatter units = ref.watch(unitFormatterProvider);

    return Scaffold(
      backgroundColor: context.colors.background,
      appBar: AppBar(title: Text(l10n.disputesTitle)),
      body: AsyncView<List<Dispute>>(
        value: ref.watch(disputesProvider),
        onRetry: () => ref.invalidate(disputesProvider),
        isEmpty: (List<Dispute> items) => items.isEmpty,
        emptyTitle: l10n.disputesEmptyTitle,
        emptyMessage: l10n.disputesEmptyBody,
        emptyIcon: Icons.gavel_rounded,
        builder: (List<Dispute> disputes) => ListView.builder(
          padding: const EdgeInsets.all(TamamSpacing.s4),
          itemCount: disputes.length,
          itemBuilder: (BuildContext context, int index) {
            final Dispute dispute = disputes[index];
            return TamamCard(
              margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
              onTap: () => context.push(Routes.dispute(dispute.id)),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          dispute.number,
                          style: TamamType.headingSm.toTextStyle(color: context.colors.textPrimary),
                        ),
                        Text(
                          units.dateTime(dispute.createdAt),
                          style: TamamType.bodySm.toTextStyle(color: context.colors.textTertiary),
                        ),
                      ],
                    ),
                  ),
                  StatusPill(
                    label: disputeStatusLabel(l10n, dispute.status),
                    tone: dispute.isResolved ? PillTone.success : PillTone.warning,
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// One dispute, with its message thread.
class DisputeDetailScreen extends ConsumerStatefulWidget {
  const DisputeDetailScreen({required this.disputeId, super.key});

  final String disputeId;

  @override
  ConsumerState<DisputeDetailScreen> createState() => _DisputeDetailScreenState();
}

class _DisputeDetailScreenState extends ConsumerState<DisputeDetailScreen> {
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
      await ref.read(supportRepositoryProvider).replyToDispute(widget.disputeId, text: text);
      _reply.clear();
      ref.invalidate(disputeProvider(widget.disputeId));
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
      appBar: AppBar(title: Text(l10n.disputeDetailTitle)),
      body: AsyncView<Dispute>(
        value: ref.watch(disputeProvider(widget.disputeId)),
        onRetry: () => ref.invalidate(disputeProvider(widget.disputeId)),
        builder: (Dispute dispute) => Column(
          children: <Widget>[
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(TamamSpacing.s4),
                children: <Widget>[
                  TamamCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Row(
                          children: <Widget>[
                            Expanded(
                              child: Text(
                                dispute.number,
                                style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                              ),
                            ),
                            StatusPill(
                              label: disputeStatusLabel(l10n, dispute.status),
                              tone: dispute.isResolved ? PillTone.success : PillTone.warning,
                            ),
                          ],
                        ),
                        const SizedBox(height: TamamSpacing.s2),
                        Text(
                          dispute.description,
                          style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                        ),
                        if (dispute.refund.amount > 0) ...<Widget>[
                          const SizedBox(height: TamamSpacing.s3),
                          Row(
                            children: <Widget>[
                              Expanded(
                                child: Text(
                                  l10n.disputeRefunded,
                                  style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                                ),
                              ),
                              MoneyText(
                                dispute.refund,
                                emphasis: MoneyEmphasis.subtle,
                                color: colors.success,
                              ),
                            ],
                          ),
                        ],
                        if (dispute.decisionReason != null) ...<Widget>[
                          const SizedBox(height: TamamSpacing.s2),
                          Text(
                            dispute.decisionReason!,
                            style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: TamamSpacing.s4),
                  for (final DisputeMessage message in dispute.messages)
                    TamamCard(
                      margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          if (message.authorName != null)
                            Text(
                              message.authorName!,
                              style: TamamType.labelSm.toTextStyle(color: colors.primary),
                            ),
                          Text(
                            message.text,
                            style: TamamType.bodyMd.toTextStyle(color: colors.textPrimary),
                          ),
                          Text(
                            units.dateTime(message.createdAt),
                            style: TamamType.labelSm.toTextStyle(color: colors.textTertiary),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            if (!dispute.isResolved)
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.all(TamamSpacing.s3),
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

/// Open a dispute against a finished job.
class OpenDisputeScreen extends ConsumerStatefulWidget {
  const OpenDisputeScreen({required this.jobId, super.key});

  final String jobId;

  @override
  ConsumerState<OpenDisputeScreen> createState() => _OpenDisputeScreenState();
}

class _OpenDisputeScreenState extends ConsumerState<OpenDisputeScreen> {
  final TextEditingController _description = TextEditingController();
  DisputeReason _reason = DisputeReason.poorQuality;
  bool _busy = false;

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      final Dispute dispute = await ref.read(supportRepositoryProvider).openDispute(
            jobId: widget.jobId,
            reason: _reason,
            description: _description.text.trim(),
          );
      ref.invalidate(disputesProvider);
      if (!mounted) return;
      context.pushReplacement(Routes.dispute(dispute.id));
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _busy = false);
      AppFeedback.showFailure(context, asFailure(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return Scaffold(
      backgroundColor: context.colors.background,
      appBar: AppBar(title: Text(l10n.disputeOpen)),
      body: ListView(
        padding: const EdgeInsets.all(TamamSpacing.s4),
        children: <Widget>[
          Text(
            l10n.disputeReasonLabel,
            style: TamamType.labelLg.toTextStyle(color: context.colors.textSecondary),
          ),
          const SizedBox(height: TamamSpacing.s2),
          Wrap(
            spacing: TamamSpacing.s2,
            runSpacing: TamamSpacing.s2,
            children: DisputeReason.values
                .map(
                  (DisputeReason reason) => ChoiceChip(
                    label: Text(_reasonLabel(l10n, reason)),
                    selected: _reason == reason,
                    onSelected: (bool _) => setState(() => _reason = reason),
                  ),
                )
                .toList(growable: false),
          ),
          const SizedBox(height: TamamSpacing.s4),
          TextField(
            controller: _description,
            maxLines: 5,
            onChanged: (String _) => setState(() {}),
            decoration: InputDecoration(
              labelText: l10n.disputeDescription,
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: TamamSpacing.s5),
          TamamButton(
            label: l10n.actionSend,
            busy: _busy,
            onPressed: _description.text.trim().length < 10 ? null : () => unawaited(_submit()),
          ),
        ],
      ),
    );
  }

  String _reasonLabel(AppLocalizations l10n, DisputeReason reason) {
    switch (reason) {
      case DisputeReason.notCompleted:
        return l10n.disputeReasonNotCompleted;
      case DisputeReason.poorQuality:
        return l10n.disputeReasonPoorQuality;
      case DisputeReason.overcharged:
        return l10n.disputeReasonOvercharged;
      case DisputeReason.damage:
        return l10n.disputeReasonDamage;
      case DisputeReason.itemMissing:
        return l10n.disputeReasonItemMissing;
      case DisputeReason.partnerMisconduct:
        return l10n.disputeReasonMisconduct;
      case DisputeReason.other:
        return l10n.disputeReasonOther;
    }
  }
}

/// Shared status wording for dispute lists and details.
String disputeStatusLabel(AppLocalizations l10n, DisputeStatus status) {
  switch (status) {
    case DisputeStatus.open:
      return l10n.disputeStatusOpen;
    case DisputeStatus.underReview:
      return l10n.disputeStatusUnderReview;
    case DisputeStatus.resolvedCustomer:
      return l10n.disputeStatusResolvedCustomer;
    case DisputeStatus.resolvedPartner:
      return l10n.disputeStatusResolvedPartner;
    case DisputeStatus.resolvedSplit:
      return l10n.disputeStatusResolvedSplit;
    case DisputeStatus.rejected:
      return l10n.disputeStatusRejected;
  }
}
