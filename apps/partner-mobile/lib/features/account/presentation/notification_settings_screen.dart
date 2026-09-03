import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/async_view.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/notifications/data/notifications_repository.dart';
import 'package:tamam_partner/features/notifications/presentation/notification_providers.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// Which channels the platform may use.
///
/// Job offers are deliberately not switchable: a partner who is ONLINE has
/// asked for work, and silencing offers would only produce missed jobs and a
/// falling acceptance rate.
class NotificationSettingsScreen extends ConsumerWidget {
  const NotificationSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.notificationSettingsTitle)),
      body: AsyncView<NotificationPreferences>(
        value: ref.watch(notificationPreferencesProvider),
        onRetry: () => ref.invalidate(notificationPreferencesProvider),
        builder: (NotificationPreferences prefs) {
          final NotificationPreferencesController controller = ref.read(notificationPreferencesProvider.notifier);
          return ListView(
            padding: const EdgeInsets.all(TamamSpacing.s4),
            children: <Widget>[
              TamamCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: <Widget>[
                    SwitchListTile.adaptive(
                      title: Text(l10n.preferencesPush),
                      subtitle: Text(l10n.preferencesPushHint),
                      value: prefs.push,
                      onChanged: (bool value) => unawaited(controller.update(prefs.copyWith(push: value))),
                    ),
                    SwitchListTile.adaptive(
                      title: Text(l10n.preferencesSms),
                      value: prefs.sms,
                      onChanged: (bool value) => unawaited(controller.update(prefs.copyWith(sms: value))),
                    ),
                    SwitchListTile.adaptive(
                      title: Text(l10n.preferencesEmail),
                      value: prefs.email,
                      onChanged: (bool value) => unawaited(controller.update(prefs.copyWith(email: value))),
                    ),
                    SwitchListTile.adaptive(
                      title: Text(l10n.preferencesMarketing),
                      subtitle: Text(l10n.preferencesMarketingHint),
                      value: prefs.marketing,
                      onChanged: (bool value) => unawaited(controller.update(prefs.copyWith(marketing: value))),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: TamamSpacing.s4),
              Container(
                padding: const EdgeInsets.all(TamamSpacing.s3),
                decoration: BoxDecoration(
                  color: colors.surfaceBrandSoft,
                  borderRadius: BorderRadius.circular(TamamRadius.md),
                ),
                child: Row(
                  children: <Widget>[
                    Icon(Icons.info_outline_rounded, color: colors.primary),
                    const SizedBox(width: TamamSpacing.s2),
                    Expanded(
                      child: Text(
                        l10n.notificationSettingsOffersAlwaysOn,
                        style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
