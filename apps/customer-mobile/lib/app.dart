import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/app_router.dart';
import 'package:tamam_customer/core/theme/tamam_theme.dart';
import 'package:tamam_customer/features/banners/presentation/banner_providers.dart';
import 'package:tamam_customer/features/jobs/presentation/job_providers.dart';
import 'package:tamam_customer/features/notifications/presentation/notification_providers.dart';
import 'package:tamam_customer/l10n/l10n.dart';

/// The application root.
///
/// It owns three cross-cutting behaviours that do not belong to any screen:
/// locale + theme, the router, and what happens when the app changes lifecycle
/// state (flush analytics, re-sync what may have changed while backgrounded).
class TamamApp extends ConsumerStatefulWidget {
  const TamamApp({super.key});

  @override
  ConsumerState<TamamApp> createState() => _TamamAppState();
}

class _TamamAppState extends ConsumerState<TamamApp> with WidgetsBindingObserver {
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
      title: 'TAMAM',
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
        // price/status rows never overflow.
        minScaleFactor: 0.85,
        maxScaleFactor: 1.4,
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }
}
