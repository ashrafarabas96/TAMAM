import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/contracts/generated/tamam_contracts.dart';
import 'package:tamam_partner/core/device/device_info.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/auth/presentation/widgets/auth_scaffold.dart';
import 'package:tamam_partner/features/onboarding/presentation/onboarding_controller.dart';
import 'package:tamam_partner/features/support/data/support_repository.dart';
import 'package:tamam_partner/features/support/presentation/support_providers.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Partner terms, privacy, the tracking disclosure, and account deletion.
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
                Text(version, style: TamamType.bodySm.toTextStyle(color: colors.textTertiary)),
                Text(
                  l10n.legalTermsVersion(kPartnerTermsVersion),
                  style: TamamType.labelSm.toTextStyle(color: colors.textTertiary),
                ),
              ],
            ),
          ),
          const SizedBox(height: TamamSpacing.s6),
          TamamCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                _Article(title: l10n.legalTermsTitle, body: l10n.legalTermsBody),
                const SizedBox(height: TamamSpacing.s4),
                _Article(title: l10n.legalPrivacyTitle, body: l10n.legalPrivacyBody),
                const SizedBox(height: TamamSpacing.s4),
                _Article(title: l10n.legalTrackingTitle, body: l10n.legalTrackingBody),
                const SizedBox(height: TamamSpacing.s4),
                _Article(title: l10n.legalCommissionTitle, body: l10n.legalCommissionBody),
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
                      Text(l10n.legalDeleteAccount, style: TamamType.labelLg.toTextStyle(color: colors.danger)),
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

class _Article extends StatelessWidget {
  const _Article({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Semantics(
          header: true,
          child: Text(title, style: TamamType.headingSm.toTextStyle(color: colors.textPrimary)),
        ),
        const SizedBox(height: TamamSpacing.s2),
        Text(body, style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary)),
      ],
    );
  }
}
