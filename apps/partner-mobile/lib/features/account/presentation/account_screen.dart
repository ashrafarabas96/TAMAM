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
import 'package:tamam_partner/core/widgets/directional_chevron.dart';
import 'package:tamam_partner/core/widgets/offline_banner.dart';
import 'package:tamam_partner/core/widgets/rating_stars.dart';
import 'package:tamam_partner/core/widgets/status_pill.dart';
import 'package:tamam_partner/core/widgets/tamam_card.dart';
import 'package:tamam_partner/features/account/domain/partner_profile.dart';
import 'package:tamam_partner/features/account/presentation/partner_providers.dart';
import 'package:tamam_partner/features/notifications/presentation/notification_providers.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// "حسابي" — the hub for the profile, work preferences, money settings,
/// support and everything legal.
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final User? user = ref.watch(sessionControllerProvider).user;
    final PartnerProfile? profile = ref.watch(partnerProfileProvider).valueOrNull;
    final int unread = ref.watch(unreadNotificationsProvider).valueOrNull ?? 0;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.accountTitle)),
      body: Column(
        children: <Widget>[
          const OfflineBanner(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(TamamSpacing.s4),
              children: <Widget>[
                TamamCard(
                  onTap: () => context.push(Routes.profile),
                  child: Row(
                    children: <Widget>[
                      TamamAvatar(
                        initials: user?.initials ?? '#',
                        imageUrl: user?.profileImageUrl,
                        size: TamamSize.avatarLg,
                      ),
                      const SizedBox(width: TamamSpacing.s3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              user?.fullName ?? l10n.accountNoName,
                              style: TamamType.headingMd.toTextStyle(color: colors.textPrimary),
                            ),
                            Text(
                              user?.phone ?? '',
                              textDirection: TextDirection.ltr,
                              style: TamamType.bodySm.toTextStyle(color: colors.textSecondary),
                            ),
                            if (profile != null)
                              Row(
                                children: <Widget>[
                                  RatingBadge(rating: profile.rating, count: profile.ratingCount, compact: false),
                                  const SizedBox(width: TamamSpacing.s2),
                                  if (profile.isApproved)
                                    StatusPill(label: l10n.accountApproved, tone: PillTone.success, dense: true)
                                  else
                                    StatusPill(label: l10n.accountNotApproved, tone: PillTone.warning, dense: true),
                                ],
                              ),
                          ],
                        ),
                      ),
                      const DirectionalChevron(),
                    ],
                  ),
                ),
                const SizedBox(height: TamamSpacing.s5),
                _Group(
                  title: l10n.accountGroupWork,
                  tiles: <_Tile>[
                    _Tile(icon: Icons.tune_rounded, label: l10n.workPreferencesTitle, route: Routes.workPreferences),
                    _Tile(
                      icon: Icons.holiday_village_outlined,
                      label: l10n.chaletOwnerTitle,
                      route: Routes.ownerChalets,
                    ),
                    _Tile(icon: Icons.description_outlined, label: l10n.documentsTitle, route: Routes.documents),
                    _Tile(icon: Icons.directions_car_outlined, label: l10n.vehiclesTitle, route: Routes.vehicles),
                  ],
                ),
                _Group(
                  title: l10n.accountGroupActivity,
                  tiles: <_Tile>[
                    _Tile(
                      icon: Icons.notifications_none_rounded,
                      label: l10n.notificationsTitle,
                      route: Routes.notifications,
                      badge: unread > 0 ? '$unread' : null,
                    ),
                    _Tile(
                      icon: Icons.notifications_active_outlined,
                      label: l10n.notificationSettingsTitle,
                      route: Routes.notificationSettings,
                    ),
                  ],
                ),
                _Group(
                  title: l10n.accountGroupSettings,
                  tiles: <_Tile>[
                    _Tile(icon: Icons.settings_outlined, label: l10n.preferencesTitle, route: Routes.preferences),
                    _Tile(icon: Icons.devices_rounded, label: l10n.sessionsTitle, route: Routes.sessions),
                  ],
                ),
                _Group(
                  title: l10n.accountGroupHelp,
                  tiles: <_Tile>[
                    _Tile(icon: Icons.support_agent_rounded, label: l10n.supportTitle, route: Routes.support),
                    _Tile(icon: Icons.shield_outlined, label: l10n.legalTitle, route: Routes.legal),
                  ],
                ),
                const SizedBox(height: TamamSpacing.s2),
                TamamCard(
                  onTap: () => unawaited(_signOut(context, ref)),
                  child: Row(
                    children: <Widget>[
                      Icon(Icons.logout_rounded, color: colors.danger),
                      const SizedBox(width: TamamSpacing.s3),
                      Text(l10n.accountSignOut, style: TamamType.labelLg.toTextStyle(color: colors.danger)),
                    ],
                  ),
                ),
                const SizedBox(height: TamamSpacing.s8),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final AppLocalizations l10n = context.l10n;
    final bool confirmed = await AppFeedback.confirm(
      context,
      title: l10n.accountSignOut,
      message: l10n.accountSignOutConfirm,
      confirmLabel: l10n.accountSignOut,
      destructive: true,
    );
    if (!confirmed) return;
    await ref.read(sessionControllerProvider.notifier).signOut();
  }
}

class _Tile {
  const _Tile({required this.icon, required this.label, required this.route, this.badge});

  final IconData icon;
  final String label;
  final String route;
  final String? badge;
}

class _Group extends StatelessWidget {
  const _Group({required this.title, required this.tiles});

  final String title;
  final List<_Tile> tiles;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: TamamSpacing.s5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.only(bottom: TamamSpacing.s2, right: 4, left: 4),
            child: Semantics(
              header: true,
              child: Text(title, style: TamamType.labelMd.toTextStyle(color: colors.textTertiary)),
            ),
          ),
          TamamCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: <Widget>[
                for (int i = 0; i < tiles.length; i++) ...<Widget>[
                  if (i > 0) Divider(height: 1, color: colors.border, indent: 56),
                  ListTile(
                    leading: Icon(tiles[i].icon, color: colors.primary),
                    title: Text(tiles[i].label),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        if (tiles[i].badge != null)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: colors.accent,
                              borderRadius: BorderRadius.circular(TamamRadius.pill),
                            ),
                            child: Text(
                              tiles[i].badge!,
                              style: TamamType.labelSm.toTextStyle(color: colors.textOnAccent),
                            ),
                          ),
                        const SizedBox(width: TamamSpacing.s1),
                        const DirectionalChevron(),
                      ],
                    ),
                    onTap: () => context.push(tiles[i].route),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
