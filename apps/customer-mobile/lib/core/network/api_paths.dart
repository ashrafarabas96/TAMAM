/// Every REST path the customer app talks to, in one place.
///
/// Paths are relative to the Dio base URL, which already carries `/api/v1`.
abstract final class ApiPaths {
  // auth
  static const String otpRequest = '/auth/otp/request';
  static const String otpVerify = '/auth/otp/verify';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';

  // profile
  static const String me = '/me';
  static const String pushToken = '/me/push-token';
  static const String sessions = '/me/sessions';
  static String session(String id) => '/me/sessions/$id';

  // customer
  static const String customerMe = '/customers/me';
  static const String places = '/customers/me/places';
  static String place(String id) => '/customers/me/places/$id';
  static const String favorites = '/customers/me/favorites';
  static String favorite(String categoryId) => '/customers/me/favorites/$categoryId';
  static const String recentServices = '/customers/me/recent-services';
  static const String customerJobs = '/customers/me/jobs';
  static String customerJob(String id) => '/customers/me/jobs/$id';
  static const String reorder = '/customers/me/reorder';

  // catalog & zones
  static const String serviceTypes = '/catalog/service-types';
  static const String categories = '/catalog/categories';
  static String category(String id) => '/catalog/categories/$id';
  static const String vehicleTypes = '/catalog/vehicle-types';
  static const String packageCategories = '/catalog/package-categories';
  static const String catalogSearch = '/catalog/search';
  static const String zones = '/zones';
  static const String resolveZone = '/zones/resolve';

  // estimates
  static const String rideEstimate = '/estimates/ride';
  static const String deliveryEstimate = '/estimates/delivery';
  static const String serviceEstimate = '/estimates/service';

  // jobs
  static const String jobs = '/jobs';
  static String job(String id) => '/jobs/$id';
  static String jobTimeline(String id) => '/jobs/$id/timeline';
  static String jobCancel(String id) => '/jobs/$id/cancel';
  static String jobConfirmWork(String id) => '/jobs/$id/confirm-work';
  static String jobShare(String id) => '/jobs/$id/share';
  static String jobSos(String id) => '/jobs/$id/sos';
  static String jobRetryDispatch(String id) => '/jobs/$id/retry-dispatch';
  static String jobLocation(String id) => '/jobs/$id/location';
  static String jobPath(String id) => '/jobs/$id/path';
  static String jobQuotes(String id) => '/jobs/$id/quotes';
  static String jobQuoteDecision(String id) => '/jobs/$id/quotes/decision';
  static String jobCloseInspection(String id) => '/jobs/$id/quotes/close-inspection-only';
  static String jobPayment(String id) => '/jobs/$id/payment';
  static String jobRating(String id) => '/jobs/$id/rating';
  static String jobChatMessages(String id) => '/jobs/$id/chat/messages';
  static String jobChatRead(String id) => '/jobs/$id/chat/read';

  /// Public, token-scoped trip view (no authentication).
  static String publicTrack(String token) => '/track/$token';

  // money
  static const String promoValidate = '/promos/validate';
  static const String referralsMe = '/referrals/me';
  static const String wallet = '/wallet';
  static const String walletStatement = '/wallet/statement';
  static const String walletTopUp = '/wallet/top-up';

  // engagement
  static const String bannerFeed = '/banners/feed';
  static const String bannerEvents = '/banners/events';
  static const String notifications = '/notifications';
  static const String notificationsUnreadCount = '/notifications/unread-count';
  static const String notificationsRead = '/notifications/read';
  static const String notificationPreferences = '/notifications/preferences';

  // support & safety
  static const String supportTickets = '/support/tickets';
  static String supportTicket(String id) => '/support/tickets/$id';
  static String supportTicketMessages(String id) => '/support/tickets/$id/messages';
  static const String supportReports = '/support/reports';
  static const String disputes = '/disputes';
  static String dispute(String id) => '/disputes/$id';
  static String disputeMessages(String id) => '/disputes/$id/messages';

  // media & config
  static const String mediaUploadIntents = '/media/upload-intents';
  static String mediaConfirm(String id) => '/media/$id/confirm';
  static const String featureFlags = '/config/feature-flags';
}
