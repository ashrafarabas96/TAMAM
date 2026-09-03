import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/format/unit_formatter.dart';
import 'package:tamam_partner/core/network/failure_messages.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/session/session_repository.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/tamam_button.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Devices signed into this account, with per-device and global sign-out.
final FutureProvider<List<DeviceSession>> deviceSessionsProvider =
    FutureProvider<List<DeviceSession>>((Ref ref) => ref.watch(sessionRepositoryProvider).sessions());

class SessionsScreen extends ConsumerWidget {
  const SessionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final UnitFormatter units = ref.watch(unitFormatterProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.sessionsTitle)),
      body: AsyncView<List<DeviceSession>>(
        value: ref.watch(deviceSessionsProvider),
        onRetry: () => ref.invalidate(deviceSessionsProvider),
        isEmpty: (List<DeviceSession> items) => items.isEmpty,
        emptyTitle: l10n.sessionsEmptyTitle,
        emptyIcon: Icons.devices_rounded,
        builder: (List<DeviceSession> sessions) => ListView(
          padding: const EdgeInsets.all(TamamSpacing.s4),
          children: <Widget>[
            for (final DeviceSession session in sessions)
              TamamCard(
                margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
                child: Row(
                  children: <Widget>[
                    Icon(
                      session.platform == 'ios' ? Icons.phone_iphone_rounded : Icons.phone_android_rounded,
                      color: colors.primary,
                    ),
                    const SizedBox(width: TamamSpacing.s3),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            session.deviceName ?? session.platform,
                            style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                          ),
                          Text(
                            l10n.sessionsLastSeen(units.dateTime(session.lastSeenAt)),
                            style: TamamType.bodySm.toTextStyle(color: colors.textTertiary),
                          ),
                        ],
                      ),
                    ),
                    if (session.isCurrent)
                      Text(l10n.sessionsThisDevice, style: TamamType.labelSm.toTextStyle(color: colors.success))
                    else
                      IconButton(
                        tooltip: l10n.sessionsRevoke,
                        icon: Icon(Icons.logout_rounded, color: colors.danger),
                        onPressed: () => unawaited(_revoke(context, ref, session)),
                      ),
                  ],
                ),
              ),
            const SizedBox(height: TamamSpacing.s5),
            TamamButton(
              label: l10n.sessionsSignOutAll,
              variant: TamamButtonVariant.danger,
              onPressed: () => unawaited(_signOutEverywhere(context, ref)),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _revoke(BuildContext context, WidgetRef ref, DeviceSession session) async {
    try {
      await ref.read(sessionRepositoryProvider).revokeSession(session.id);
      ref.invalidate(deviceSessionsProvider);
    } on Object catch (error) {
      if (context.mounted) AppFeedback.showFailure(context, asFailure(error));
    }
  }

  Future<void> _signOutEverywhere(BuildContext context, WidgetRef ref) async {
    final AppLocalizations l10n = context.l10n;
    final bool confirmed = await AppFeedback.confirm(
      context,
      title: l10n.sessionsSignOutAll,
      message: l10n.sessionsSignOutAllConfirm,
      confirmLabel: l10n.sessionsSignOutAll,
      destructive: true,
    );
    if (!confirmed) return;
    await ref.read(sessionControllerProvider.notifier).signOut(allDevices: true);
  }
}
