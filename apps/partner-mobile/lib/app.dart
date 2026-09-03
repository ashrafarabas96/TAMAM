import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/routing/app_router.dart';
import 'package:tamam_partner/core/theme/tamam_theme.dart';
import 'package:tamam_partner/features/banners/presentation/banner_providers.dart';
import 'package:tamam_partner/features/home/presentation/availability_controller.dart';
import 'package:tamam_partner/features/jobs/presentation/jobs_providers.dart';
import 'package:tamam_partner/features/notifications/presentation/notification_providers.dart';
import 'package:tamam_partner/features/offers/presentation/offers_controller.dart';
import 'package:tamam_partner/l10n/l10n.dart';

/// The application root.
///
/// It owns three cross-cutting behaviours that do not belong to any screen:
/// locale + theme, the router, and what happens when the app changes lifecycle
/// state. On resume the app *never* flips the partner back ONLINE by itself —
/// it reconciles with the server and asks for confirmation when the shift was
/// interrupted, because a silent auto-online would send offers to a partner
/// who may have stopped working.
class TamamPartnerApp extends ConsumerStatefulWidget {
  const TamamPartnerApp({super.key});

  @override
  ConsumerState<TamamPartnerApp> createState() => _TamamPartnerAppState();
}

class _TamamPartnerAppState extends ConsumerState<TamamPartnerApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.detached:
      case AppLifecycleState.hidden:
        // Ship queued banner analytics before the process can be killed.
        unawaited(ref.read(bannerEventQueueProvider).flush());
      case AppLifecycleState.resumed:
        // Anything time-sensitive may have moved on while we were away.
        ref
          ..invalidate(activeJobsProvider)
          ..invalidate(unreadNotificationsProvider);
        unawaited(ref.read(sessionControllerProvider.notifier).refreshUser());
        unawaited(ref.read(availabilityControllerProvider.notifier).reconcileAfterResume());
        unawaited(ref.read(offersControllerProvider.notifier).refresh());
      case AppLifecycleState.inactive:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final Locale locale = ref.watch(localeControllerProvider);
    final ThemeMode themeMode = ref.watch(themeModeControllerProvider);
    final GoRouter router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'TAMAM Partner',
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      locale: locale,
      supportedLocales: supportedAppLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      theme: TamamTheme.light(locale.languageCode),
      darkTheme: TamamTheme.dark(locale.languageCode),
      themeMode: themeMode,
      builder: (BuildContext context, Widget? child) => MediaQuery.withClampedTextScaling(
        // Accessibility scaling is respected, but capped so the dense
        // earnings/status rows never overflow.
        minScaleFactor: 0.85,
        maxScaleFactor: 1.4,
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }
}
