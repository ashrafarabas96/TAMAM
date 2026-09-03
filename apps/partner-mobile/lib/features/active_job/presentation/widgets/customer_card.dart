import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/avatar.dart';
import 'package:tamam_partner/core/widgets/rating_stars.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/l10n/l10n.dart';
import 'package:url_launcher/url_launcher.dart';

/// Who the partner is serving: name, rating, masked call and chat.
///
/// The number dialled is the proxy the server hands out; the app never learns
/// the customer's real number.
class CustomerCard extends ConsumerWidget {
  const CustomerCard({required this.job, super.key, this.compact = false});

  final Job job;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final JobCustomerCard? customer = job.customer;
    final bool chatEnabled = ref.watch(featureFlagsValueProvider).hasChat && !job.isTerminal;
    if (customer == null) return const SizedBox.shrink();

    return Row(
      children: <Widget>[
        TamamAvatar(initials: customer.initials, imageUrl: customer.profileImageUrl, size: compact ? TamamSize.avatarSm : TamamSize.avatarMd),
        const SizedBox(width: TamamSpacing.s3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                customer.fullName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
              ),
              if (customer.rating > 0) RatingBadge(rating: customer.rating),
            ],
          ),
        ),
        if (customer.canCall)
          _RoundAction(
            icon: Icons.call_rounded,
            label: l10n.jobCallCustomer,
            onTap: () => unawaited(_call(context, customer.maskedPhone!)),
          ),
        if (chatEnabled) ...<Widget>[
          const SizedBox(width: TamamSpacing.s2),
          _RoundAction(
            icon: Icons.chat_bubble_outline_rounded,
            label: l10n.jobChatCustomer,
            onTap: () => context.push(Routes.jobChat(job.id)),
          ),
        ],
      ],
    );
  }

  Future<void> _call(BuildContext context, String number) async {
    final Uri uri = Uri(scheme: 'tel', path: number);
    final bool ok = await launchUrl(uri);
    if (!ok && context.mounted) {
      AppFeedback.showMessage(context, context.l10n.errorCannotCall, icon: Icons.phone_disabled_rounded);
    }
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: colors.surfaceBrandSoft,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(
            width: TamamSize.touchTargetMin,
            height: TamamSize.touchTargetMin,
            child: Icon(icon, color: colors.primary, size: TamamSize.iconMd),
          ),
        ),
      ),
    );
  }
}
