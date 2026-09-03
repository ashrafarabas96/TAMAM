import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/theme/generated/tamam_tokens.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/features/places/presentation/place_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// The purple block at the top of home: delivery address and the search bar.
///
/// Both rows are the app's primary entry points, which is why they sit above
/// everything else and never scroll away.
class HomeHeader extends ConsumerWidget {
  const HomeHeader({required this.onPickAddress, required this.unreadCount, super.key});

  final VoidCallback onPickAddress;
  final int unreadCount;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TamamColors colors = context.colors;
    final Address? address = ref.watch(currentAddressProvider);

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
              Expanded(
                child: Semantics(
                  button: true,
                  label: l10n.homeChangeAddress,
                  child: InkWell(
                    onTap: onPickAddress,
                    borderRadius: BorderRadius.circular(TamamRadius.md),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: TamamSpacing.s1),
                      child: Row(
                        children: <Widget>[
                          Icon(Icons.location_on_rounded, size: TamamSize.iconMd, color: colors.accent),
                          const SizedBox(width: TamamSpacing.s2),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: <Widget>[
                                Text(
                                  l10n.homeDeliverTo,
                                  style: TamamType.labelSm.toTextStyle(color: TamamBrand.purple200),
                                ),
                                Text(
                                  address?.formatted ?? l10n.homeChooseAddress,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TamamType.headingSm.toTextStyle(color: colors.textOnBrand),
                                ),
                              ],
                            ),
                          ),
                          Icon(Icons.expand_more_rounded, size: TamamSize.iconMd, color: colors.textOnBrand),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              _NotificationsButton(unreadCount: unreadCount),
            ],
          ),
          const SizedBox(height: TamamSpacing.s3),
          _SearchBar(hint: l10n.homeSearchHint),
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
            constraints: const BoxConstraints(
              minWidth: TamamSize.touchTargetMin,
              minHeight: TamamSize.touchTargetMin,
            ),
          ),
          if (unreadCount > 0)
            PositionedDirectional(
              top: 8,
              end: 6,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                constraints: const BoxConstraints(minWidth: 18),
                decoration: BoxDecoration(
                  color: colors.accent,
                  borderRadius: BorderRadius.circular(TamamRadius.pill),
                ),
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

class _SearchBar extends StatelessWidget {
  const _SearchBar({required this.hint});

  final String hint;

  @override
  Widget build(BuildContext context) {
    final TamamColors colors = context.colors;
    return Semantics(
      button: true,
      label: hint,
      child: InkWell(
        onTap: () => context.push(Routes.search),
        borderRadius: BorderRadius.circular(TamamRadius.button),
        child: Container(
          height: TamamSize.inputHeight,
          padding: const EdgeInsets.symmetric(horizontal: TamamSpacing.s3),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(TamamRadius.button),
          ),
          child: Row(
            children: <Widget>[
              Icon(Icons.search_rounded, color: colors.textTertiary, size: TamamSize.iconMd),
              const SizedBox(width: TamamSpacing.s2),
              Expanded(
                child: Text(
                  hint,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TamamType.bodyMd.toTextStyle(color: colors.textTertiary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
