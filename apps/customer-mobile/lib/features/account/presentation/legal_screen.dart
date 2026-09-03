import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_customer/core/device/device_info.dart';
import 'package:tamam_customer/core/network/failure_messages.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/app_feedback.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/auth/presentation/widgets/auth_scaffold.dart';
import 'package:tamam_customer/features/support/data/support_repository.dart';
import 'package:tamam_customer/features/support/presentation/support_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// About, legal text and the account-deletion request.
///
/// Deletion is a support request rather than a client-side wipe: the platform
/// must keep financial records, so a human closes the account (spec §113).
class LegalScreen extends ConsumerWidget {
  const LegalScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final String version = ref.watch(deviceProfileProvider).maybeWhen(
          data: (DeviceProfile profile) => profile.appVersion,
          orElse: () => '',
        );

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.legalTitle)),
      body: ListView(
        padding: const EdgeInsets.all(TamamSpacing.s4),
        children: <Widget>[
          Center(
            child: Column(
              children: <Widget>[
                const TamamWordmark(fontSize: 34),
                const SizedBox(height: TamamSpacing.s1),
                Text(
                  version,
                  style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                ),
              ],
            ),
          ),
          const SizedBox(height: TamamSpacing.s6),
          TamamCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  l10n.legalTermsTitle,
                  style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                ),
                const SizedBox(height: TamamSpacing.s2),
                Text(
                  l10n.legalTermsBody,
                  style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                ),
                const SizedBox(height: TamamSpacing.s4),
                Text(
                  l10n.legalPrivacyTitle,
                  style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                ),
                const SizedBox(height: TamamSpacing.s2),
                Text(
                  l10n.legalPrivacyBody,
                  style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                ),
              ],
            ),
          ),
          const SizedBox(height: TamamSpacing.s5),
          TamamCard(
            onTap: () => unawaited(_requestDeletion(context, ref)),
            child: Row(
              children: <Widget>[
                Icon(Icons.delete_forever_rounded, color: colors.danger),
                const SizedBox(width: TamamSpacing.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        l10n.legalDeleteAccount,
                        style: TamamType.labelLg.toTextStyle(color: colors.danger),
                      ),
                      Text(
                        l10n.legalDeleteAccountHint,
                        style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _requestDeletion(BuildContext context, WidgetRef ref) async {
    final AppLocalizations l10n = context.l10n;
    final bool confirmed = await AppFeedback.confirm(
      context,
      title: l10n.legalDeleteAccount,
      message: l10n.legalDeleteAccountConfirm,
      confirmLabel: l10n.legalDeleteAccountCta,
      destructive: true,
    );
    if (!confirmed || !context.mounted) return;
    try {
      final SupportTicket ticket = await ref.read(supportRepositoryProvider).createTicket(
            category: TicketCategory.account,
            subject: l10n.legalDeleteAccountSubject,
            description: l10n.legalDeleteAccountBody,
          );
      if (!context.mounted) return;
      context.push(Routes.supportTicket(ticket.id));
    } on Object catch (error) {
      if (context.mounted) AppFeedback.showFailure(context, asFailure(error));
    }
  }
}
