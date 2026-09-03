import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_partner/core/providers/core_providers.dart';
import 'package:tamam_partner/core/routing/deep_links.dart';
import 'package:tamam_partner/core/routing/routes.dart';
import 'package:tamam_partner/core/session/session_state.dart';
import 'package:tamam_partner/core/session/user.dart';
import 'package:tamam_partner/features/account/presentation/account_screen.dart';
import 'package:tamam_partner/features/account/presentation/legal_screen.dart';
import 'package:tamam_partner/features/account/presentation/notification_settings_screen.dart';
import 'package:tamam_partner/features/account/presentation/preferences_screen.dart';
import 'package:tamam_partner/features/account/presentation/profile_screen.dart';
import 'package:tamam_partner/features/account/presentation/sessions_screen.dart';
import 'package:tamam_partner/features/account/presentation/work_preferences_screen.dart';
import 'package:tamam_partner/features/active_job/presentation/active_job_screen.dart';
import 'package:tamam_partner/features/auth/presentation/otp_screen.dart';
import 'package:tamam_partner/features/auth/presentation/phone_screen.dart';
import 'package:tamam_partner/features/auth/presentation/splash_screen.dart';
import 'package:tamam_partner/features/chat/presentation/chat_screen.dart';
import 'package:tamam_partner/features/documents/presentation/documents_screen.dart';
import 'package:tamam_partner/features/earnings/presentation/earnings_screen.dart';
import 'package:tamam_partner/features/earnings/presentation/statement_screen.dart';
import 'package:tamam_partner/features/earnings/presentation/withdrawals_screen.dart';
import 'package:tamam_partner/features/home/presentation/home_screen.dart';
import 'package:tamam_partner/features/jobs/presentation/job_detail_screen.dart';
import 'package:tamam_partner/features/jobs/presentation/jobs_screen.dart';
import 'package:tamam_partner/features/jobs/presentation/rate_customer_screen.dart';
import 'package:tamam_partner/features/notifications/presentation/notifications_screen.dart';
import 'package:tamam_partner/features/onboarding/presentation/onboarding_screen.dart';
import 'package:tamam_partner/features/onboarding/presentation/onboarding_status_screen.dart';
import 'package:tamam_partner/features/quotes/presentation/quote_builder_screen.dart';
import 'package:tamam_partner/features/shell/app_shell.dart';
import 'package:tamam_partner/features/support/presentation/support_screen.dart';
import 'package:tamam_partner/features/support/presentation/ticket_screen.dart';
import 'package:tamam_partner/features/vehicles/presentation/vehicle_detail_screen.dart';
import 'package:tamam_partner/features/vehicles/presentation/vehicle_form_screen.dart';
import 'package:tamam_partner/features/vehicles/presentation/vehicles_screen.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

/// The app's single router.
///
/// All navigation policy lives in [_redirect]: screens push destinations, and
/// the redirect decides whether the session is allowed to be there. That keeps
/// sign-out, onboarding/approval and deep links from fighting each other.
final Provider<GoRouter> routerProvider = Provider<GoRouter>((Ref ref) {
  final ValueNotifier<int> sessionTick = ValueNotifier<int>(0);
  ref.listen<SessionState>(
    sessionControllerProvider,
    (SessionState? _, SessionState __) => sessionTick.value++,
  );
  ref.onDispose(sessionTick.dispose);

  final GoRouter router = GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: Routes.splash,
    refreshListenable: sessionTick,
    redirect: (BuildContext context, GoRouterState state) => _redirect(ref, state),
    errorBuilder: (BuildContext context, GoRouterState state) => _RouteNotFound(location: state.uri.toString()),
    routes: <RouteBase>[
      GoRoute(path: Routes.splash, builder: (_, __) => const SplashScreen()),
      GoRoute(path: Routes.phone, builder: (_, __) => const PhoneScreen()),
      GoRoute(path: Routes.otp, builder: (_, __) => const OtpScreen()),
      GoRoute(
        path: Routes.onboarding,
        builder: (BuildContext _, GoRouterState state) =>
            OnboardingScreen(initialStep: int.tryParse(state.uri.queryParameters['step'] ?? '')),
      ),
      GoRoute(path: Routes.onboardingStatus, builder: (_, __) => const OnboardingStatusScreen()),

      StatefulShellRoute.indexedStack(
        builder: (BuildContext _, GoRouterState __, StatefulNavigationShell shell) =>
            AppShell(navigationShell: shell),
        branches: <StatefulShellBranch>[
          StatefulShellBranch(
            routes: <RouteBase>[GoRoute(path: Routes.home, builder: (_, __) => const HomeScreen())],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[GoRoute(path: Routes.jobs, builder: (_, __) => const JobsScreen())],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[GoRoute(path: Routes.earnings, builder: (_, __) => const EarningsScreen())],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[GoRoute(path: Routes.account, builder: (_, __) => const AccountScreen())],
          ),
        ],
      ),

      // Full-screen destinations pushed above the shell.
      GoRoute(
        path: '/work/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (BuildContext _, GoRouterState state) =>
            ActiveJobScreen(jobId: state.pathParameters['id'] ?? ''),
        routes: <RouteBase>[
          GoRoute(
            path: 'quote',
            parentNavigatorKey: rootNavigatorKey,
            builder: (BuildContext _, GoRouterState state) => QuoteBuilderScreen(
              jobId: state.pathParameters['id'] ?? '',
              changeOrder: state.uri.queryParameters['kind'] == 'change',
            ),
          ),
          GoRoute(
            path: 'chat',
            parentNavigatorKey: rootNavigatorKey,
            builder: (BuildContext _, GoRouterState state) =>
                ChatScreen(jobId: state.pathParameters['id'] ?? ''),
          ),
          GoRoute(
            path: 'rating',
            parentNavigatorKey: rootNavigatorKey,
            builder: (BuildContext _, GoRouterState state) =>
                RateCustomerScreen(jobId: state.pathParameters['id'] ?? ''),
          ),
        ],
      ),
      GoRoute(
        path: '/jobs/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (BuildContext _, GoRouterState state) =>
            JobDetailScreen(jobId: state.pathParameters['id'] ?? ''),
      ),
      GoRoute(
        path: Routes.withdrawals,
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const WithdrawalsScreen(),
      ),
      GoRoute(
        path: Routes.statement,
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const StatementScreen(),
      ),
      GoRoute(
        path: Routes.notifications,
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const NotificationsScreen(),
      ),
      GoRoute(
        path: Routes.documents,
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const DocumentsScreen(),
      ),
      GoRoute(
        path: Routes.vehicles,
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const VehiclesScreen(),
        routes: <RouteBase>[
          GoRoute(
            path: 'new',
            parentNavigatorKey: rootNavigatorKey,
            builder: (_, __) => const VehicleFormScreen(),
          ),
          GoRoute(
            path: ':id',
            parentNavigatorKey: rootNavigatorKey,
            builder: (BuildContext _, GoRouterState state) =>
                VehicleDetailScreen(vehicleId: state.pathParameters['id'] ?? ''),
          ),
        ],
      ),
      GoRoute(
        path: Routes.profile,
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const ProfileScreen(),
      ),
      GoRoute(
        path: Routes.workPreferences,
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const WorkPreferencesScreen(),
      ),
      GoRoute(
        path: Routes.preferences,
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const PreferencesScreen(),
      ),
      GoRoute(
        path: Routes.notificationSettings,
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const NotificationSettingsScreen(),
      ),
      GoRoute(
        path: Routes.sessions,
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const SessionsScreen(),
      ),
      GoRoute(
        path: Routes.legal,
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, __) => const LegalScreen(),
      ),
      GoRoute(
        path: Routes.support,
        parentNavigatorKey: rootNavigatorKey,
        builder: (BuildContext _, GoRouterState state) =>
            SupportScreen(jobId: state.uri.queryParameters['jobId']),
        routes: <RouteBase>[
          GoRoute(
            path: ':id',
            parentNavigatorKey: rootNavigatorKey,
            builder: (BuildContext _, GoRouterState state) =>
                TicketScreen(ticketId: state.pathParameters['id'] ?? ''),
          ),
        ],
      ),
    ],
  );

  ref.onDispose(router.dispose);
  return router;
});

/// Auth + approval gate.
///
/// * `unknown` → the splash, which resolves the session;
/// * signed out → the phone screen (only auth routes are reachable);
/// * signed in but not approved → the wizard (DRAFT / REJECTED) or the review
///   status screen (PENDING / UNDER_REVIEW), with support and settings still
///   reachable;
/// * approved → the shell; auth and onboarding routes bounce to home.
String? _redirect(Ref ref, GoRouterState state) {
  final SessionState session = ref.read(sessionControllerProvider);
  final String location = state.matchedLocation;
  final bool onSplash = location == Routes.splash;

  if (!session.isResolved) return onSplash ? null : Routes.splash;

  if (session.status == AuthStatus.signedOut) {
    return Routes.isPublic(location) && !onSplash ? null : Routes.phone;
  }

  if (session.status == AuthStatus.onboarding) {
    if (Routes.isAlwaysAvailable(location)) return null;
    final User? user = session.user;
    final String target = user == null || user.needsOnboarding ? Routes.onboarding : Routes.onboardingStatus;
    // The wizard and the status screen may hand over to each other freely.
    if (Routes.isOnboarding(location)) return null;
    return target;
  }

  const Set<String> authOnlyLocations = <String>{Routes.splash, Routes.phone, Routes.otp};
  if (authOnlyLocations.contains(location) || Routes.isOnboarding(location)) return Routes.home;
  return null;
}

class _RouteNotFound extends StatelessWidget {
  const _RouteNotFound({required this.location});

  final String location;

  @override
  Widget build(BuildContext context) {
    // An unknown link is almost always an external one we do not handle yet;
    // send the partner home rather than showing a dead end.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final Uri? uri = Uri.tryParse(location);
      final String? resolved = uri == null ? null : DeepLinks.resolve(uri);
      GoRouter.of(context).go(resolved ?? Routes.home);
    });
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
