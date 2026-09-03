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
import 'package:tamam_customer/core/widgets/sheet_scaffold.dart';
import 'package:tamam_customer/core/widgets/status_pill.dart';
import 'package:tamam_customer/core/widgets/tamam_button.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/support/data/support_repository.dart';
import 'package:tamam_customer/features/support/presentation/support_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// The customer's support tickets, with a sheet to raise a new one.
class SupportScreen extends ConsumerWidget {
  const SupportScreen({super.key, this.jobId});

  /// Pre-links a ticket to a job when support is opened from tracking.
  final String? jobId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final UnitFormatter units = ref.watch(unitFormatterProvider);

    return Scaffold(
      backgroundColor: context.colors.background,
      appBar: AppBar(title: Text(l10n.supportTitle)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => unawaited(NewTicketSheet.show(context, ref, jobId: jobId)),
        icon: const Icon(Icons.add_rounded),
        label: Text(l10n.supportNewTicket),
      ),
      body: AsyncView<List<SupportTicket>>(
        value: ref.watch(supportTicketsProvider),
        onRetry: () => ref.invalidate(supportTicketsProvider),
        isEmpty: (List<SupportTicket> items) => items.isEmpty,
        emptyTitle: l10n.supportEmptyTitle,
        emptyMessage: l10n.supportEmptyBody,
        emptyIcon: Icons.support_agent_rounded,
        emptyActionLabel: l10n.supportNewTicket,
        onEmptyAction: () => unawaited(NewTicketSheet.show(context, ref, jobId: jobId)),
        builder: (List<SupportTicket> tickets) => ListView.builder(
          padding: const EdgeInsets.fromLTRB(
            TamamSpacing.s4,
            TamamSpacing.s4,
            TamamSpacing.s4,
            TamamSpacing.s16,
          ),
          itemCount: tickets.length,
          itemBuilder: (BuildContext context, int index) {
            final SupportTicket ticket = tickets[index];
            return TamamCard(
              margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
              onTap: () => context.push(Routes.supportTicket(ticket.id)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(
                          ticket.subject,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TamamType.headingSm.toTextStyle(color: context.colors.textPrimary),
                        ),
                      ),
                      StatusPill(
                        label: _statusLabel(l10n, ticket.status),
                        tone: ticket.isOpen ? PillTone.warning : PillTone.success,
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${ticket.number} · ${units.dateTime(ticket.updatedAt)}',
                    style: TamamType.bodySm.toTextStyle(color: context.colors.textTertiary),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  static String _statusLabel(AppLocalizations l10n, TicketStatus status) {
    switch (status) {
      case TicketStatus.open:
        return l10n.ticketStatusOpen;
      case TicketStatus.inProgress:
        return l10n.ticketStatusInProgress;
      case TicketStatus.waitingUser:
        return l10n.ticketStatusWaitingUser;
      case TicketStatus.resolved:
        return l10n.ticketStatusResolved;
      case TicketStatus.closed:
        return l10n.ticketStatusClosed;
    }
  }
}

/// Raise a ticket: category, subject and description.
class NewTicketSheet extends ConsumerStatefulWidget {
  const NewTicketSheet({super.key, this.jobId});

  final String? jobId;

  static Future<void> show(BuildContext context, WidgetRef ref, {String? jobId}) =>
      SheetScaffold.show<void>(context, (BuildContext _) => NewTicketSheet(jobId: jobId));

  @override
  ConsumerState<NewTicketSheet> createState() => _NewTicketSheetState();
}

class _NewTicketSheetState extends ConsumerState<NewTicketSheet> {
  static const List<TicketCategory> _categories = <TicketCategory>[
    TicketCategory.jobIssue,
    TicketCategory.payment,
    TicketCategory.partnerBehaviour,
    TicketCategory.lostItem,
    TicketCategory.account,
    TicketCategory.safety,
    TicketCategory.other,
  ];

  final TextEditingController _subject = TextEditingController();
  final TextEditingController _description = TextEditingController();
  TicketCategory _category = TicketCategory.jobIssue;
  bool _busy = false;

  @override
  void dispose() {
    _subject.dispose();
    _description.dispose();
    super.dispose();
  }

  bool get _valid => _subject.text.trim().length >= 3 && _description.text.trim().length >= 10;

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      final SupportTicket ticket = await ref.read(supportRepositoryProvider).createTicket(
            category: _category,
            subject: _subject.text.trim(),
            description: _description.text.trim(),
            jobId: widget.jobId,
          );
      ref.invalidate(supportTicketsProvider);
      if (!mounted) return;
      Navigator.of(context).pop();
      context.push(Routes.supportTicket(ticket.id));
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _busy = false);
      AppFeedback.showFailure(context, asFailure(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return SheetScaffold(
      title: l10n.supportNewTicket,
      subtitle: l10n.supportNewTicketHint,
      footer: TamamButton(
        label: l10n.actionSend,
        busy: _busy,
        onPressed: _valid ? () => unawaited(_submit()) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Wrap(
            spacing: TamamSpacing.s2,
            runSpacing: TamamSpacing.s2,
            children: _categories
                .map(
                  (TicketCategory category) => ChoiceChip(
                    label: Text(_categoryLabel(l10n, category)),
                    selected: _category == category,
                    onSelected: (bool _) => setState(() => _category = category),
                  ),
                )
                .toList(growable: false),
          ),
          const SizedBox(height: TamamSpacing.s4),
          TextField(
            controller: _subject,
            onChanged: (String _) => setState(() {}),
            decoration: InputDecoration(labelText: l10n.supportSubject),
          ),
          const SizedBox(height: TamamSpacing.s3),
          TextField(
            controller: _description,
            maxLines: 5,
            onChanged: (String _) => setState(() {}),
            decoration: InputDecoration(
              labelText: l10n.supportDescription,
              alignLabelWithHint: true,
            ),
          ),
        ],
      ),
    );
  }

  String _categoryLabel(AppLocalizations l10n, TicketCategory category) {
    switch (category) {
      case TicketCategory.payment:
        return l10n.ticketCategoryPayment;
      case TicketCategory.jobIssue:
        return l10n.ticketCategoryJob;
      case TicketCategory.partnerBehaviour:
        return l10n.ticketCategoryPartner;
      case TicketCategory.lostItem:
        return l10n.ticketCategoryLostItem;
      case TicketCategory.account:
        return l10n.ticketCategoryAccount;
      case TicketCategory.safety:
        return l10n.ticketCategorySafety;
      case TicketCategory.customerBehaviour:
      case TicketCategory.other:
        return l10n.ticketCategoryOther;
    }
  }
}
