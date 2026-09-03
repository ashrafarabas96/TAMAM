import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/format/unit_formatter.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/deep_links.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/core/widgets/async_view.dart';
import 'package:tamam_customer/core/widgets/tamam_card.dart';
import 'package:tamam_customer/features/notifications/data/notifications_repository.dart';
import 'package:tamam_customer/features/notifications/presentation/notification_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// The in-app inbox. Tapping a notification marks it read and follows its deep
/// link when it has one.
class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final UnitFormatter units = ref.watch(unitFormatterProvider);
    final TamamColors colors = context.colors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(l10n.notificationsTitle),
        actions: <Widget>[
          TextButton(
            onPressed: () => unawaited(ref.read(notificationsProvider.notifier).markRead()),
            child: Text(
              l10n.notificationsMarkAllRead,
              style: TamamType.labelMd.toTextStyle(color: colors.textOnBrand),
            ),
          ),
        ],
      ),
      body: AsyncView<List<AppNotification>>(
        value: ref.watch(notificationsProvider),
        onRetry: () => ref.invalidate(notificationsProvider),
        isEmpty: (List<AppNotification> items) => items.isEmpty,
        emptyTitle: l10n.notificationsEmptyTitle,
        emptyMessage: l10n.notificationsEmptyBody,
        emptyIcon: Icons.notifications_off_outlined,
        builder: (List<AppNotification> items) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(notificationsProvider),
          child: ListView.builder(
            padding: const EdgeInsets.all(TamamSpacing.s4),
            itemCount: items.length + (ref.read(notificationsProvider.notifier).hasMore ? 1 : 0),
            itemBuilder: (BuildContext context, int index) {
              if (index >= items.length) {
                return Center(
                  child: TextButton(
                    onPressed: () => unawaited(ref.read(notificationsProvider.notifier).loadMore()),
                    child: Text(l10n.actionLoadMore),
                  ),
                );
              }
              final AppNotification item = items[index];
              return TamamCard(
                margin: const EdgeInsets.only(bottom: TamamSpacing.s2),
                background: item.isUnread ? colors.surfaceBrandSoft : colors.surface,
                onTap: () => unawaited(_open(context, ref, item)),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Container(
                      width: 8,
                      height: 8,
                      margin: const EdgeInsets.only(top: 6),
                      decoration: BoxDecoration(
                        color: item.isUnread ? colors.primary : Colors.transparent,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: TamamSpacing.s3),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            item.title,
                            style: TamamType.headingSm.toTextStyle(color: colors.textPrimary),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            item.body,
                            style: TamamType.bodyMd.toTextStyle(color: colors.textSecondary),
                          ),
                          const SizedBox(height: TamamSpacing.s1),
                          Text(
                            units.dateTime(item.createdAt),
                            style: TamamType.labelSm.toTextStyle(color: colors.textTertiary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Future<void> _open(BuildContext context, WidgetRef ref, AppNotification item) async {
    if (item.isUnread) {
      await ref.read(notificationsProvider.notifier).markRead(id: item.id);
    }
    final String? link = item.deepLink;
    if (link == null || !context.mounted) return;
    final Uri? uri = Uri.tryParse(link);
    final String? location = uri == null ? null : DeepLinks.resolve(uri);
    if (location != null && context.mounted) context.push(location);
  }
}
