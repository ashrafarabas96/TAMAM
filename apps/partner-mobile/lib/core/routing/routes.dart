/// Every navigable location in the app, as typed constants.
///
/// Screens never build path strings by hand; that keeps deep links, banner
/// actions and notification payloads in sync with the router.
abstract final class Routes {
  static const String splash = '/splash';

  static const String phone = '/auth/phone';
  static const String otp = '/auth/otp';

  static const String onboarding = '/onboarding';
  static const String onboardingStatus = '/onboarding/status';

  static const String home = '/home';
  static const String jobs = '/jobs';
  static const String earnings = '/earnings';
  static const String account = '/account';

  static const String notifications = '/notifications';
  static const String ownerChalets = '/chalets';
  static String ownerChalet(String id) => '/chalets/$id';

  static const String documents = '/documents';
  static const String vehicles = '/vehicles';
  static const String vehicleNew = '/vehicles/new';
  static const String withdrawals = '/earnings/withdrawals';
  static const String statement = '/earnings/statement';

  static String vehicle(String id) => '/vehicles/$id';
  static String job(String id) => '/jobs/$id';
  static String activeJob(String id) => '/work/$id';
  static String quoteBuilder(String id) => '/work/$id/quote';
  static String jobChat(String id) => '/work/$id/chat';
  static String rateCustomer(String id) => '/work/$id/rating';

  static const String profile = '/account/profile';
  static const String workPreferences = '/account/work';
  static const String preferences = '/account/preferences';
  static const String notificationSettings = '/account/notification-settings';
  static const String sessions = '/account/sessions';
  static const String support = '/account/support';
  static const String legal = '/account/legal';

  static String supportTicket(String id) => '/account/support/$id';

  /// Locations reachable without a session.
  static bool isPublic(String location) =>
      location.startsWith('/auth') || location.startsWith(splash);

  /// Locations a partner may open while the profile is not approved yet.
  static bool isOnboarding(String location) => location.startsWith(onboarding);

  /// Locations that stay available to a not-yet-approved partner (support and
  /// account settings must never be locked behind approval).
  static bool isAlwaysAvailable(String location) =>
      location.startsWith(Routes.support) ||
      location == Routes.preferences ||
      location == Routes.legal ||
      location == Routes.profile ||
      location == Routes.sessions ||
      location == Routes.documents ||
      location == Routes.notifications;
}
