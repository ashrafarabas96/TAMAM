import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tamam_customer/core/models/geo.dart';
import 'package:tamam_customer/core/providers/core_providers.dart';
import 'package:tamam_customer/core/routing/deep_links.dart';
import 'package:tamam_customer/core/routing/routes.dart';
import 'package:tamam_customer/core/session/session_state.dart';
import 'package:tamam_customer/core/storage/prefs_store.dart';
import 'package:tamam_customer/features/account/presentation/account_screen.dart';
import 'package:tamam_customer/features/account/presentation/legal_screen.dart';
import 'package:tamam_customer/features/account/presentation/preferences_screen.dart';
import 'package:tamam_customer/features/account/presentation/profile_screen.dart';
import 'package:tamam_customer/features/account/presentation/sessions_screen.dart';
import 'package:tamam_customer/features/auth/presentation/location_permission_screen.dart';
import 'package:tamam_customer/features/auth/presentation/name_screen.dart';
import 'package:tamam_customer/features/auth/presentation/onboarding_screen.dart';
import 'package:tamam_customer/features/auth/presentation/otp_screen.dart';
import 'package:tamam_customer/features/auth/presentation/phone_screen.dart';
import 'package:tamam_customer/features/auth/presentation/splash_screen.dart';
import 'package:tamam_customer/features/catalog/presentation/category_screen.dart';
import 'package:tamam_customer/features/catalog/presentation/favorites_screen.dart';
import 'package:tamam_customer/features/catalog/presentation/search_screen.dart';
import 'package:tamam_customer/features/chat/presentation/chat_screen.dart';
import 'package:tamam_customer/features/delivery/presentation/delivery_flow_screen.dart';
import 'package:tamam_customer/features/home/presentation/home_screen.dart';
import 'package:tamam_customer/features/jobs/presentation/orders_screen.dart';
import 'package:tamam_customer/features/jobs/presentation/public_track_screen.dart';
import 'package:tamam_customer/features/jobs/presentation/rating_screen.dart';
import 'package:tamam_customer/features/jobs/presentation/receipt_screen.dart';
import 'package:tamam_customer/features/jobs/presentation/tracking_screen.dart';
import 'package:tamam_customer/features/notifications/presentation/notifications_screen.dart';
import 'package:tamam_customer/features/places/presentation/location_picker_screen.dart';
import 'package:tamam_customer/features/places/presentation/saved_places_screen.dart';
import 'package:tamam_customer/features/ride/presentation/ride_flow_screen.dart';
import 'package:tamam_customer/features/service/presentation/service_flow_screen.dart';
import 'package:tamam_customer/features/shell/app_shell.dart';
import 'package:tamam_customer/features/support/presentation/disputes_screen.dart';
import 'package:tamam_customer/features/support/presentation/support_screen.dart';
import 'package:tamam_customer/features/support/presentation/ticket_screen.dart';
import 'package:tamam_customer/features/wallet/presentation/promos_screen.dart';
import 'package:tamam_customer/features/wallet/presentation/wallet_screen.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

/// The app's single router.
///
/// All navigation policy lives in [_redirect]: screens push destinations, and
/// the redirect decides whether the session is allowed to be there. That keeps
/// sign-out, onboarding and deep links from fighting each other.
final Provider<GoRouter> routerProvider = Provider<GoRouter>((Ref ref) {
  final ValueNotifier<AuthStatus> authListenable = ValueNotifier<AuthStatus>(
    ref.read(sessionControllerProvider).status,
  );
  ref.listen<AuthStatus>(
    sessionControllerProvider.select((SessionState state) => state.status),
    (AuthStatus? _, AuthStatus next) => authListenable.value = next,
  );
  ref.onDispose(authListenable.dispose);

  final GoRouter router = GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: Routes.splash,
    refreshListenable: authListenable,
    redirect: (BuildContext context, GoRouterState state) => _redirect(ref, state),
    errorBuilder: (BuildContext context, GoRouterState state) => _RouteNotFound(location: state.uri.toString()),
    routes: <RouteBase>[
      GoRoute(path: Routes.splash, builder: (_, __) => const SplashScreen()),
      GoRoute(path: Routes.onboarding, builder: (_, __) => const OnboardingScreen()),
      GoRoute(path: Routes.phone, builder: (_, __) => const PhoneScreen()),
      GoRoute(
        path: Routes.otp,
        builder: (BuildContext _, GoRouterState state) =>
            OtpScreen(referralCode: state.uri.queryParameters['ref']),
      ),
      GoRoute(path: Routes.name, builder: (_, __) => const NameScreen()),
      GoRoute(path: Routes.locationPermission, builder: (_, __) => const LocationPermissionScreen()),
      GoRoute(
        path: '/t/:token',
        builder: (BuildContext _, GoRouterState state) =>
            PublicTrackScreen(token: state.pathParameters['token'] ?? ''),
      ),

      StatefulShellRoute.indexedStack(
        builder: (BuildContext _, GoRouterState __, StatefulNavigationShell shell) =>
            AppShell(navigationShell: shell),
        branches: <StatefulShellBranch>[
          StatefulShellBranch(
            routes: <RouteBase>[GoRoute(path: Routes.home, builder: (_, __) => const HomeScreen())],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[GoRoute(path: Routes.orders, builder: (_, __) => const OrdersScreen())],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[GoRoute(path: Routes.wallet, builder: (_, __) => const WalletScreen())],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[GoRoute(path: Routes.account, builder: (_, __) => const AccountScreen())],
          ),
        ],
      ),

      // Full-screen destinations pushed above the shell.
      GoRoute(
        path: Routes.search,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext _, GoRouterState state) =>
            SearchScreen(urgentOnly: state.uri.queryParameters['urgent'] == '1'),
      ),
      GoRoute(
        path: '/category/:id',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext _, GoRouterState state) =>
            CategoryScreen(categoryId: state.pathParameters['id'] ?? ''),
      ),
      GoRoute(
        path: '/service/:categoryId',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext _, GoRouterState state) =>
            ServiceFlowScreen(categoryId: state.pathParameters['categoryId'] ?? ''),
      ),
      GoRoute(
        path: Routes.ride,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const RideFlowScreen(),
      ),
      GoRoute(
        path: Routes.delivery,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const DeliveryFlowScreen(),
      ),
      GoRoute(
        path: '/jobs/:id',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext _, GoRouterState state) =>
            TrackingScreen(jobId: state.pathParameters['id'] ?? ''),
        routes: <RouteBase>[
          GoRoute(
            path: 'chat',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (BuildContext _, GoRouterState state) =>
                ChatScreen(jobId: state.pathParameters['id'] ?? ''),
          ),
          GoRoute(
            path: 'rating',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (BuildContext _, GoRouterState state) =>
                RatingScreen(jobId: state.pathParameters['id'] ?? ''),
          ),
          GoRoute(
            path: 'receipt',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (BuildContext _, GoRouterState state) =>
                ReceiptScreen(jobId: state.pathParameters['id'] ?? ''),
          ),
          GoRoute(
            path: 'dispute',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (BuildContext _, GoRouterState state) =>
                OpenDisputeScreen(jobId: state.pathParameters['id'] ?? ''),
          ),
        ],
      ),
      GoRoute(
        path: Routes.savedPlaces,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const SavedPlacesScreen(),
        routes: <RouteBase>[
          GoRoute(
            path: 'pick',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (BuildContext _, GoRouterState state) =>
                LocationPickerScreen(initial: state.extra is Address ? state.extra! as Address : null),
          ),
        ],
      ),
      GoRoute(
        path: Routes.notifications,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const NotificationsScreen(),
      ),
      GoRoute(
        path: Routes.promos,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const PromosScreen(),
      ),
      GoRoute(
        path: Routes.referrals,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const ReferralsScreen(),
      ),
      GoRoute(
        path: Routes.profile,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const ProfileScreen(),
      ),
      GoRoute(
        path: Routes.preferences,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const PreferencesScreen(),
      ),
      GoRoute(
        path: Routes.sessions,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const SessionsScreen(),
      ),
      GoRoute(
        path: Routes.favorites,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const FavoritesScreen(),
      ),
      GoRoute(
        path: Routes.legal,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const LegalScreen(),
      ),
      GoRoute(
        path: Routes.support,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext _, GoRouterState state) =>
            SupportScreen(jobId: state.uri.queryParameters['jobId']),
        routes: <RouteBase>[
          GoRoute(
            path: ':id',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (BuildContext _, GoRouterState state) =>
                TicketScreen(ticketId: state.pathParameters['id'] ?? ''),
          ),
        ],
      ),
      GoRoute(
        path: Routes.disputes,
        parentNavigatorKey: _rootNavigatorKey,
        builder: (_, __) => const DisputesScreen(),
        routes: <RouteBase>[
          GoRoute(
            path: ':id',
            parentNavigatorKey: _rootNavigatorKey,
            builder: (BuildContext _, GoRouterState state) =>
                DisputeDetailScreen(disputeId: state.pathParameters['id'] ?? ''),
          ),
        ],
      ),
    ],
  );

  ref.onDispose(router.dispose);
  return router;
});

/// Auth gate.
///
/// * `unknown` → the splash, which resolves the session;
/// * signed out → onboarding on a first run, otherwise the phone screen;
/// * signed in without a name → the name step;
/// * signed in on an auth screen → home.
String? _redirect(Ref ref, GoRouterState state) {
  final SessionState session = ref.read(sessionControllerProvider);
  final PrefsStore prefs = ref.read(prefsStoreProvider);
  final String location = state.matchedLocation;
  final bool onSplash = location == Routes.splash;

  if (!session.isResolved) return onSplash ? null : Routes.splash;

  if (session.status == AuthStatus.signedOut) {
    if (Routes.isPublic(location) && !onSplash) return null;
    return prefs.getBool(PrefsStore.keyOnboardingSeen) ? Routes.phone : Routes.onboarding;
  }

  if (session.status == AuthStatus.needsProfile) {
    return location == Routes.name ? null : Routes.name;
  }

  // Signed in. The location explainer is its own step and must not be
  // redirected away from, or the redirect would loop on itself.
  if (location == Routes.locationPermission) return null;

  const Set<String> authOnlyLocations = <String>{
    Routes.splash,
    Routes.onboarding,
    Routes.phone,
    Routes.otp,
    Routes.name,
  };
  if (authOnlyLocations.contains(location)) {
    return prefs.getBool(PrefsStore.keyLocationPromptShown) ? Routes.home : Routes.locationPermission;
  }
  return null;
}

class _RouteNotFound extends StatelessWidget {
  const _RouteNotFound({required this.location});

  final String location;

  @override
  Widget build(BuildContext context) {
    // An unknown link is almost always an external one we do not handle yet;
    // send the customer home rather than showing a dead end.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final Uri? uri = Uri.tryParse(location);
      final String? resolved = uri == null ? null : DeepLinks.resolve(uri);
      GoRouter.of(context).go(resolved ?? Routes.home);
    });
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
