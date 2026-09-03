import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/features/jobs/domain/job.dart';
import 'package:tamam_partner/features/jobs/presentation/jobs_providers.dart';
import 'package:tamam_partner/features/notifications/presentation/notification_providers.dart';
import 'package:tamam_partner/features/offers/presentation/offer_sheet.dart';
import 'package:tamam_partner/features/offers/presentation/offers_controller.dart';
import 'package:tamam_partner/features/shell/widgets/active_job_banner.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// The four-tab shell: الرئيسية، مشاويري، أرباحي، حسابي.
///
/// It also owns two app-wide behaviours that must survive tab switches:
///  * the incoming-offer sheet, opened the moment an offer reaches the queue
///    and closed when the queue empties;
///  * the persistent active-job strip above the bottom nav.
class AppShell extends ConsumerStatefulWidget {
  const AppShell({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  bool _sheetOpen = false;

  Future<void> _openOfferSheet() async {
    if (_sheetOpen) return;
    _sheetOpen = true;
    try {
      await OfferSheet.show(context);
    } finally {
      _sheetOpen = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final int unread = ref.watch(unreadNotificationsProvider).valueOrNull ?? 0;
    final List<Job> active = ref.watch(activeJobsProvider).valueOrNull ?? const <Job>[];

    ref.listen<OfferQueue>(offersControllerProvider, (OfferQueue? previous, OfferQueue next) {
      if (next.current != null && previous?.current?.assignmentId != next.current?.assignmentId) {
        unawaited(_openOfferSheet());
      }
      // A freshly accepted job goes straight to the working screen.
      final Job? accepted = next.acceptedJob;
      if (accepted != null) {
        ref.read(offersControllerProvider.notifier).consumeAccepted();
        context.push(Routes.activeJob(accepted.id));
      }
    });

    return Scaffold(
      body: widget.navigationShell,
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (active.isNotEmpty) ActiveJobBanner(job: active.first),
          NavigationBar(
            selectedIndex: widget.navigationShell.currentIndex,
            onDestinationSelected: (int index) => widget.navigationShell.goBranch(
              index,
              // Tapping the active tab returns it to its root.
              initialLocation: index == widget.navigationShell.currentIndex,
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
                label: l10n.navJobs,
              ),
              NavigationDestination(
                icon: const Icon(Icons.account_balance_wallet_outlined),
                selectedIcon: const Icon(Icons.account_balance_wallet_rounded),
                label: l10n.navEarnings,
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
        ],
      ),
    );
  }
}
