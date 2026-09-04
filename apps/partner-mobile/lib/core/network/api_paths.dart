/// Every REST path the partner app talks to, in one place.
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

  // partner onboarding
  static const String onboardingPersonal = '/partners/onboarding/personal';
  static const String onboardingRoles = '/partners/onboarding/roles';
  static const String onboardingSkills = '/partners/onboarding/skills';
  static const String onboardingDocuments = '/partners/onboarding/documents';
  static const String onboardingVehicle = '/partners/onboarding/vehicle';
  static const String onboardingZones = '/partners/onboarding/zones';

  /// `PATCH` — what an already-approved partner may change themselves: the zones
  /// they work and the categories and skills they offer. The onboarding routes above
  /// are closed once a file is approved.
  static const String serviceProfile = '/partners/me/service-profile';
  static const String onboardingSubmit = '/partners/onboarding/submit';

  // partner self
  static const String partnerMe = '/partners/me';
  static const String partnerDocuments = '/partners/me/documents';
  static const String partnerAvailability = '/partners/me/availability';
  static const String partnerHeartbeat = '/partners/me/heartbeat';
  static const String partnerJobs = '/partners/me/jobs';
  static const String partnerLocation = '/partners/me/location';
  static const String partnerOffers = '/partners/me/offers';
  static const String partnerOffersRespond = '/partners/me/offers/respond';
  static const String partnerEarnings = '/partners/me/earnings';
  static const String partnerBankAccounts = '/partners/me/bank-accounts';
  static const String partnerReviews = '/partners/me/reviews';

  // vehicles
  static const String vehicles = '/partners/me/vehicles';
  static String vehicle(String id) => '/partners/me/vehicles/$id';
  static String vehicleActivate(String id) => '/partners/me/vehicles/$id/activate';
  static String vehicleDocuments(String id) => '/partners/me/vehicles/$id/documents';

  // catalog & zones
  static const String categories = '/catalog/categories';
  static const String vehicleTypes = '/catalog/vehicle-types';
  static const String zones = '/zones';

  // jobs — partner transitions
  static String job(String id) => '/jobs/$id';
  static String jobTimeline(String id) => '/jobs/$id/timeline';
  static String jobEnRoute(String id) => '/jobs/$id/en-route';
  static String jobArrive(String id) => '/jobs/$id/arrive';
  static String jobStart(String id) => '/jobs/$id/start';
  static String jobComplete(String id) => '/jobs/$id/complete';
  static String jobWorkStart(String id) => '/jobs/$id/work/start';
  static String jobWorkWaitingForParts(String id) => '/jobs/$id/work/waiting-for-parts';
  static String jobWorkResume(String id) => '/jobs/$id/work/resume';
  static String jobWorkComplete(String id) => '/jobs/$id/work/complete';
  static String jobCancel(String id) => '/jobs/$id/cancel';
  static String jobRelease(String id) => '/jobs/$id/release';
  static String jobQuotes(String id) => '/jobs/$id/quotes';
  static String jobRating(String id) => '/jobs/$id/rating';
  static String jobChatMessages(String id) => '/jobs/$id/chat/messages';
  static String jobChatRead(String id) => '/jobs/$id/chat/read';

  // money
  static const String wallet = '/wallet';
  static const String walletStatement = '/wallet/statement';
  static const String walletWithdrawals = '/wallet/withdrawals';

  // engagement
  static const String bannerFeed = '/banners/feed';
  static const String bannerEvents = '/banners/events';
  static const String notifications = '/notifications';
  static const String notificationsUnreadCount = '/notifications/unread-count';
  static const String notificationsRead = '/notifications/read';
  static const String notificationPreferences = '/notifications/preferences';

  // support
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
