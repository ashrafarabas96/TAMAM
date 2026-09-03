import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/features/notifications/presentation/notification_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// The four-tab shell: الرئيسية، طلباتي، المحفظة، حسابي.
///
/// Uses `StatefulShellRoute`, so each tab keeps its own navigation stack and
/// scroll position when the customer switches away and back.
class AppShell extends ConsumerWidget {
  const AppShell({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final int unread = ref.watch(unreadNotificationsProvider).valueOrNull ?? 0;

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (int index) => navigationShell.goBranch(
          index,
          // Tapping the active tab returns it to its root.
          initialLocation: index == navigationShell.currentIndex,
        ),
        destinations: <NavigationDestination>[
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home_rounded),
            label: l10n.navHome,
          ),
          NavigationDestination(
            icon: const Icon(Icons.receipt_long_outlined),
            selectedIcon: const Icon(Icons.receipt_long_rounded),
            label: l10n.navOrders,
          ),
          NavigationDestination(
            icon: const Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: const Icon(Icons.account_balance_wallet_rounded),
            label: l10n.navWallet,
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text(unread > 99 ? '99+' : '$unread'),
              backgroundColor: context.colors.accent,
              textColor: context.colors.textOnAccent,
              child: const Icon(Icons.person_outline_rounded),
            ),
            selectedIcon: const Icon(Icons.person_rounded),
            label: l10n.navAccount,
          ),
        ],
      ),
    );
  }
}
