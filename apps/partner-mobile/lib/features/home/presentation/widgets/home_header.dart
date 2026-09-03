import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/session/user.dart';
import 'package:tamam_partner/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/core/widgets/app_feedback.dart';
import 'package:tamam_partner/core/widgets/avatar.dart';
import 'package:tamam_partner/features/home/presentation/availability_controller.dart';
import 'package:tamam_partner/features/home/presentation/widgets/availability_toggle.dart';
import 'package:tamam_partner/features/home/presentation/widgets/go_online_sheet.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// The purple block at the top of home: greeting, notifications bell and the
/// big ONLINE / OFFLINE toggle.
class HomeHeader extends ConsumerWidget {
  const HomeHeader({required this.unreadCount, super.key});

  final int unreadCount;

  Future<void> _toggle(BuildContext context, WidgetRef ref, AvailabilityState state) async {
    final AppLocalizations l10n = context.l10n;
    final AvailabilityController controller = ref.read(availabilityControllerProvider.notifier);
    if (state.isOnline) {
      final bool confirmed = await AppFeedback.confirm(
        context,
        title: l10n.goOfflineTitle,
        message: state.currentJobId != null ? l10n.availabilityActiveJobBlocksOffline : l10n.goOfflineMessage,
        confirmLabel: l10n.goOfflineConfirm,
      );
      if (!confirmed) return;
      final bool ok = await controller.goOffline();
      if (!ok && context.mounted) {
        final AvailabilityState next = ref.read(availabilityControllerProvider);
        if (next.failure != null) AppFeedback.showFailure(context, next.failure!);
      }
      return;
    }
    final bool online = await GoOnlineSheet.show(context);
    if (online && context.mounted) {
      AppFeedback.showMessage(context, l10n.goOnlineDone, icon: Icons.bolt_rounded);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final User? user = ref.watch(sessionControllerProvider).user;
    final AvailabilityState availability = ref.watch(availabilityControllerProvider);

    return Container(
      color: colors.surfaceBrand,
      padding: EdgeInsets.only(
        top: MediaQuery.paddingOf(context).top + TamamSpacing.s2,
        left: TamamSpacing.s4,
        right: TamamSpacing.s4,
        bottom: TamamSpacing.s4,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              GestureDetector(
                onTap: () => context.push(Routes.profile),
                child: TamamAvatar(initials: user?.initials ?? '#', imageUrl: user?.profileImageUrl),
              ),
              const SizedBox(width: TamamSpacing.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      l10n.homeGreeting,
                      style: TamamType.labelSm.toTextStyle(color: TamamBrand.purple200),
                    ),
                    Text(
                      user?.fullName ?? l10n.accountNoName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TamamType.headingSm.toTextStyle(color: colors.textOnBrand),
                    ),
                  ],
                ),
              ),
              _NotificationsButton(unreadCount: unreadCount),
            ],
          ),
          const SizedBox(height: TamamSpacing.s4),
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  availability.isOnline ? l10n.homeStatusOnline : l10n.homeStatusOffline,
                  style: TamamType.bodyMd.toTextStyle(color: TamamBrand.purple100),
                ),
              ),
              AvailabilityToggle(
                online: availability.isOnline,
                busy: availability.busy || !availability.loaded,
                onJob: availability.isBusy || availability.currentJobId != null,
                onTap: () => unawaited(_toggle(context, ref, availability)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _NotificationsButton extends StatelessWidget {
  const _NotificationsButton({required this.unreadCount});

  final int unreadCount;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Semantics(
      button: true,
      label: context.l10n.notificationsTitle,
      value: unreadCount > 0 ? '$unreadCount' : null,
      child: Stack(
        alignment: Alignment.center,
        children: <Widget>[
          IconButton(
            onPressed: () => context.push(Routes.notifications),
            icon: const Icon(Icons.notifications_none_rounded),
            color: colors.textOnBrand,
            iconSize: TamamSize.iconLg,
            constraints: const BoxConstraints(minWidth: TamamSize.touchTargetMin, minHeight: TamamSize.touchTargetMin),
          ),
          if (unreadCount > 0)
            PositionedDirectional(
              top: 8,
              end: 6,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                constraints: const BoxConstraints(minWidth: 18),
                decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(TamamRadius.pill)),
                child: Text(
                  unreadCount > 99 ? '99+' : '$unreadCount',
                  textAlign: TextAlign.center,
                  style: TamamType.labelSm.toTextStyle(color: colors.textOnAccent),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
