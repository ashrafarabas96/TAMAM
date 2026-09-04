/// Every navigable location in the app, as typed constants.
///
/// Screens never build path strings by hand; that keeps deep links, banner
/// actions and notification payloads in sync with the router.
abstract final class Routes {
  static const String splash = '/splash';
  static const String onboarding = '/onboarding';

  static const String phone = '/auth/phone';
  static const String otp = '/auth/otp';
  static const String name = '/auth/name';
  static const String locationPermission = '/auth/location';

  static const String home = '/home';
  static const String orders = '/orders';
  static const String wallet = '/wallet';
  static const String account = '/account';

  static const String search = '/search';
  static const String notifications = '/notifications';
  static const String promos = '/promos';
  static const String referrals = '/referrals';
  static const String savedPlaces = '/places';
  static const String locationPicker = '/places/pick';

  static const String chalets = '/chalets';
  static String chalet(String id) => '/chalets/$id';
  static String chaletBooking(String id) => '/chalets/booking/$id';

  static const String ride = '/ride';
  static const String delivery = '/delivery';

  static String category(String id) => '/category/$id';
  static String service(String categoryId) => '/service/$categoryId';
  static String job(String id) => '/jobs/$id';
  static String jobChat(String id) => '/jobs/$id/chat';
  static String jobRating(String id) => '/jobs/$id/rating';
  static String jobReceipt(String id) => '/jobs/$id/receipt';
  static String jobDispute(String id) => '/jobs/$id/dispute';
  static String jobSafety(String id) => '/jobs/$id/safety';

  static const String profile = '/account/profile';
  static const String preferences = '/account/preferences';
  static const String notificationSettings = '/account/notification-settings';
  static const String sessions = '/account/sessions';
  static const String support = '/account/support';
  static const String legal = '/account/legal';
  static const String favorites = '/account/favorites';

  static String supportTicket(String id) => '/account/support/$id';
  static const String disputes = '/account/disputes';
  static String dispute(String id) => '/account/disputes/$id';

  /// Public share-link viewer (`https://tamam.app/t/<token>`).
  static String publicTrack(String token) => '/t/$token';

  /// Locations reachable without a session.
  static bool isPublic(String location) =>
      location.startsWith('/auth') ||
      location.startsWith(onboarding) ||
      location.startsWith(splash) ||
      location.startsWith('/t/');
}
