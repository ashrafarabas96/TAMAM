// AUTO-GENERATED from packages/shared-types — DO NOT EDIT. Regenerate: node scripts/generate-dart-contracts.mjs
// ignore_for_file: constant_identifier_names, public_member_api_docs

enum UserRole {
  customer('CUSTOMER'),
  partner('PARTNER'),
  admin('ADMIN'),
  support('SUPPORT'),
  dispatcher('DISPATCHER'),
  finance('FINANCE'),
  operationsManager('OPERATIONS_MANAGER'),
  marketing('MARKETING'),
  analyst('ANALYST'),
  superAdmin('SUPER_ADMIN');

  const UserRole(this.value);
  final String value;

  static UserRole? fromValue(String? value) {
    if (value == null) return null;
    for (final e in UserRole.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum AccountStatus {
  active('ACTIVE'),
  restricted('RESTRICTED'),
  suspended('SUSPENDED'),
  deleted('DELETED');

  const AccountStatus(this.value);
  final String value;

  static AccountStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in AccountStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum Language {
  ar('ar'),
  en('en');

  const Language(this.value);
  final String value;

  static Language? fromValue(String? value) {
    if (value == null) return null;
    for (final e in Language.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum PartnerRoleType {
  driver('DRIVER'),
  courier('COURIER'),
  technician('TECHNICIAN'),
  serviceProvider('SERVICE_PROVIDER');

  const PartnerRoleType(this.value);
  final String value;

  static PartnerRoleType? fromValue(String? value) {
    if (value == null) return null;
    for (final e in PartnerRoleType.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum VerificationStatus {
  draft('DRAFT'),
  pending('PENDING'),
  underReview('UNDER_REVIEW'),
  approved('APPROVED'),
  rejected('REJECTED'),
  suspended('SUSPENDED');

  const VerificationStatus(this.value);
  final String value;

  static VerificationStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in VerificationStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum AvailabilityStatus {
  online('ONLINE'),
  offline('OFFLINE'),
  busy('BUSY');

  const AvailabilityStatus(this.value);
  final String value;

  static AvailabilityStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in AvailabilityStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum DocumentType {
  id('ID'),
  drivingLicense('DRIVING_LICENSE'),
  vehicleLicense('VEHICLE_LICENSE'),
  insurance('INSURANCE'),
  professionalCertificate('PROFESSIONAL_CERTIFICATE'),
  businessDocument('BUSINESS_DOCUMENT'),
  profilePicture('PROFILE_PICTURE');

  const DocumentType(this.value);
  final String value;

  static DocumentType? fromValue(String? value) {
    if (value == null) return null;
    for (final e in DocumentType.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum DocumentStatus {
  pending('PENDING'),
  approved('APPROVED'),
  rejected('REJECTED'),
  expired('EXPIRED');

  const DocumentStatus(this.value);
  final String value;

  static DocumentStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in DocumentStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum JobType {
  ride('RIDE'),
  delivery('DELIVERY'),
  homeService('HOME_SERVICE'),
  food('FOOD'),
  grocery('GROCERY'),
  pharmacy('PHARMACY'),
  shopping('SHOPPING'),
  moving('MOVING'),
  roadAssistance('ROAD_ASSISTANCE');

  const JobType(this.value);
  final String value;

  static JobType? fromValue(String? value) {
    if (value == null) return null;
    for (final e in JobType.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum JobStatus {
  draft('DRAFT'),
  requested('REQUESTED'),
  searching('SEARCHING'),
  assigned('ASSIGNED'),
  partnerEnRoute('PARTNER_EN_ROUTE'),
  partnerArrived('PARTNER_ARRIVED'),
  waitingCustomer('WAITING_CUSTOMER'),
  inProgress('IN_PROGRESS'),
  inspectionStarted('INSPECTION_STARTED'),
  quoteRequired('QUOTE_REQUIRED'),
  quoteSubmitted('QUOTE_SUBMITTED'),
  quoteApproved('QUOTE_APPROVED'),
  quoteRejected('QUOTE_REJECTED'),
  workStarted('WORK_STARTED'),
  waitingForParts('WAITING_FOR_PARTS'),
  workCompleted('WORK_COMPLETED'),
  customerConfirmed('CUSTOMER_CONFIRMED'),
  completed('COMPLETED'),
  cancelled('CANCELLED'),
  noPartnerAvailable('NO_PARTNER_AVAILABLE'),
  disputed('DISPUTED');

  const JobStatus(this.value);
  final String value;

  static JobStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in JobStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum JobUrgency {
  standard('STANDARD'),
  urgent('URGENT'),
  emergency('EMERGENCY');

  const JobUrgency(this.value);
  final String value;

  static JobUrgency? fromValue(String? value) {
    if (value == null) return null;
    for (final e in JobUrgency.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum SchedulingMode {
  now('NOW'),
  scheduled('SCHEDULED');

  const SchedulingMode(this.value);
  final String value;

  static SchedulingMode? fromValue(String? value) {
    if (value == null) return null;
    for (final e in SchedulingMode.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum JobStopKind {
  pickup('PICKUP'),
  dropoff('DROPOFF'),
  waypoint('WAYPOINT'),
  serviceLocation('SERVICE_LOCATION');

  const JobStopKind(this.value);
  final String value;

  static JobStopKind? fromValue(String? value) {
    if (value == null) return null;
    for (final e in JobStopKind.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum JobActorType {
  customer('CUSTOMER'),
  partner('PARTNER'),
  admin('ADMIN'),
  system('SYSTEM');

  const JobActorType(this.value);
  final String value;

  static JobActorType? fromValue(String? value) {
    if (value == null) return null;
    for (final e in JobActorType.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum AssignmentStatus {
  offered('OFFERED'),
  accepted('ACCEPTED'),
  rejected('REJECTED'),
  expired('EXPIRED'),
  cancelled('CANCELLED'),
  reassigned('REASSIGNED');

  const AssignmentStatus(this.value);
  final String value;

  static AssignmentStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in AssignmentStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum CancellationActor {
  customer('CUSTOMER'),
  partner('PARTNER'),
  admin('ADMIN'),
  system('SYSTEM');

  const CancellationActor(this.value);
  final String value;

  static CancellationActor? fromValue(String? value) {
    if (value == null) return null;
    for (final e in CancellationActor.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum QuoteStatus {
  draft('DRAFT'),
  submitted('SUBMITTED'),
  approved('APPROVED'),
  rejected('REJECTED'),
  superseded('SUPERSEDED'),
  cancelled('CANCELLED');

  const QuoteStatus(this.value);
  final String value;

  static QuoteStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in QuoteStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum QuoteKind {
  initial('INITIAL'),
  changeOrder('CHANGE_ORDER');

  const QuoteKind(this.value);
  final String value;

  static QuoteKind? fromValue(String? value) {
    if (value == null) return null;
    for (final e in QuoteKind.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum PricingMethod {
  metered('METERED'),
  distanceWeight('DISTANCE_WEIGHT'),
  fixed('FIXED'),
  inspectionQuote('INSPECTION_QUOTE'),
  hourly('HOURLY'),
  startingFrom('STARTING_FROM'),
  customQuote('CUSTOM_QUOTE');

  const PricingMethod(this.value);
  final String value;

  static PricingMethod? fromValue(String? value) {
    if (value == null) return null;
    for (final e in PricingMethod.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum DynamicFieldType {
  text('TEXT'),
  textarea('TEXTAREA'),
  number('NUMBER'),
  select('SELECT'),
  multiSelect('MULTI_SELECT'),
  boolean('BOOLEAN'),
  date('DATE'),
  time('TIME'),
  image('IMAGE'),
  images('IMAGES'),
  video('VIDEO'),
  audio('AUDIO');

  const DynamicFieldType(this.value);
  final String value;

  static DynamicFieldType? fromValue(String? value) {
    if (value == null) return null;
    for (final e in DynamicFieldType.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum VehicleStatus {
  active('ACTIVE'),
  inactive('INACTIVE');

  const VehicleStatus(this.value);
  final String value;

  static VehicleStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in VehicleStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum PaymentMethod {
  cash('CASH'),
  wallet('WALLET'),
  card('CARD'),
  bank('BANK'),
  externalGateway('EXTERNAL_GATEWAY');

  const PaymentMethod(this.value);
  final String value;

  static PaymentMethod? fromValue(String? value) {
    if (value == null) return null;
    for (final e in PaymentMethod.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum PaymentStatus {
  pending('PENDING'),
  authorized('AUTHORIZED'),
  captured('CAPTURED'),
  failed('FAILED'),
  cancelled('CANCELLED'),
  refunded('REFUNDED'),
  partiallyRefunded('PARTIALLY_REFUNDED');

  const PaymentStatus(this.value);
  final String value;

  static PaymentStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in PaymentStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum RefundStatus {
  pending('PENDING'),
  processed('PROCESSED'),
  failed('FAILED'),
  rejected('REJECTED');

  const RefundStatus(this.value);
  final String value;

  static RefundStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in RefundStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum WalletOwnerType {
  customer('CUSTOMER'),
  partner('PARTNER'),
  platform('PLATFORM');

  const WalletOwnerType(this.value);
  final String value;

  static WalletOwnerType? fromValue(String? value) {
    if (value == null) return null;
    for (final e in WalletOwnerType.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum LedgerAccountType {
  customerWallet('CUSTOMER_WALLET'),
  partnerWallet('PARTNER_WALLET'),
  platformRevenue('PLATFORM_REVENUE'),
  platformCashClearing('PLATFORM_CASH_CLEARING'),
  platformGatewayClearing('PLATFORM_GATEWAY_CLEARING'),
  platformPromoExpense('PLATFORM_PROMO_EXPENSE'),
  platformRefundExpense('PLATFORM_REFUND_EXPENSE'),
  platformPayables('PLATFORM_PAYABLES');

  const LedgerAccountType(this.value);
  final String value;

  static LedgerAccountType? fromValue(String? value) {
    if (value == null) return null;
    for (final e in LedgerAccountType.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum LedgerEntryDirection {
  debit('DEBIT'),
  credit('CREDIT');

  const LedgerEntryDirection(this.value);
  final String value;

  static LedgerEntryDirection? fromValue(String? value) {
    if (value == null) return null;
    for (final e in LedgerEntryDirection.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum LedgerTransactionType {
  jobCharge('JOB_CHARGE'),
  jobCommission('JOB_COMMISSION'),
  partnerEarning('PARTNER_EARNING'),
  cashCollected('CASH_COLLECTED'),
  walletTopup('WALLET_TOPUP'),
  walletWithdrawal('WALLET_WITHDRAWAL'),
  refund('REFUND'),
  promoDiscount('PROMO_DISCOUNT'),
  referralReward('REFERRAL_REWARD'),
  cancellationFee('CANCELLATION_FEE'),
  bonus('BONUS'),
  manualAdjustment('MANUAL_ADJUSTMENT'),
  disputeSettlement('DISPUTE_SETTLEMENT');

  const LedgerTransactionType(this.value);
  final String value;

  static LedgerTransactionType? fromValue(String? value) {
    if (value == null) return null;
    for (final e in LedgerTransactionType.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum WithdrawalStatus {
  requested('REQUESTED'),
  approved('APPROVED'),
  paid('PAID'),
  rejected('REJECTED');

  const WithdrawalStatus(this.value);
  final String value;

  static WithdrawalStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in WithdrawalStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum PromoType {
  percentage('PERCENTAGE'),
  fixedAmount('FIXED_AMOUNT');

  const PromoType(this.value);
  final String value;

  static PromoType? fromValue(String? value) {
    if (value == null) return null;
    for (final e in PromoType.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum CommissionScope {
  global('GLOBAL'),
  jobType('JOB_TYPE'),
  category('CATEGORY'),
  zone('ZONE'),
  partner('PARTNER'),
  campaign('CAMPAIGN');

  const CommissionScope(this.value);
  final String value;

  static CommissionScope? fromValue(String? value) {
    if (value == null) return null;
    for (final e in CommissionScope.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum NotificationChannel {
  push('PUSH'),
  inApp('IN_APP'),
  sms('SMS'),
  email('EMAIL');

  const NotificationChannel(this.value);
  final String value;

  static NotificationChannel? fromValue(String? value) {
    if (value == null) return null;
    for (final e in NotificationChannel.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum NotificationEvent {
  otpCode('OTP_CODE'),
  jobCreated('JOB_CREATED'),
  jobOffer('JOB_OFFER'),
  jobAccepted('JOB_ACCEPTED'),
  partnerArriving('PARTNER_ARRIVING'),
  partnerArrived('PARTNER_ARRIVED'),
  jobStarted('JOB_STARTED'),
  quoteReceived('QUOTE_RECEIVED'),
  quoteApproved('QUOTE_APPROVED'),
  quoteRejected('QUOTE_REJECTED'),
  jobCompleted('JOB_COMPLETED'),
  jobCancelled('JOB_CANCELLED'),
  noPartnerAvailable('NO_PARTNER_AVAILABLE'),
  paymentSuccess('PAYMENT_SUCCESS'),
  paymentFailed('PAYMENT_FAILED'),
  documentExpiring('DOCUMENT_EXPIRING'),
  documentReviewed('DOCUMENT_REVIEWED'),
  partnerApproved('PARTNER_APPROVED'),
  newMessage('NEW_MESSAGE'),
  supportReply('SUPPORT_REPLY'),
  promoCampaign('PROMO_CAMPAIGN'),
  scheduledReminder('SCHEDULED_REMINDER');

  const NotificationEvent(this.value);
  final String value;

  static NotificationEvent? fromValue(String? value) {
    if (value == null) return null;
    for (final e in NotificationEvent.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum NotificationStatus {
  queued('QUEUED'),
  sent('SENT'),
  delivered('DELIVERED'),
  read('READ'),
  failed('FAILED');

  const NotificationStatus(this.value);
  final String value;

  static NotificationStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in NotificationStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum MessageType {
  text('TEXT'),
  image('IMAGE'),
  location('LOCATION'),
  system('SYSTEM');

  const MessageType(this.value);
  final String value;

  static MessageType? fromValue(String? value) {
    if (value == null) return null;
    for (final e in MessageType.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum TicketCategory {
  payment('PAYMENT'),
  jobIssue('JOB_ISSUE'),
  partnerBehaviour('PARTNER_BEHAVIOUR'),
  customerBehaviour('CUSTOMER_BEHAVIOUR'),
  lostItem('LOST_ITEM'),
  account('ACCOUNT'),
  safety('SAFETY'),
  other('OTHER');

  const TicketCategory(this.value);
  final String value;

  static TicketCategory? fromValue(String? value) {
    if (value == null) return null;
    for (final e in TicketCategory.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum TicketPriority {
  low('LOW'),
  normal('NORMAL'),
  high('HIGH'),
  critical('CRITICAL');

  const TicketPriority(this.value);
  final String value;

  static TicketPriority? fromValue(String? value) {
    if (value == null) return null;
    for (final e in TicketPriority.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum TicketStatus {
  open('OPEN'),
  inProgress('IN_PROGRESS'),
  waitingUser('WAITING_USER'),
  resolved('RESOLVED'),
  closed('CLOSED');

  const TicketStatus(this.value);
  final String value;

  static TicketStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in TicketStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum DisputeStatus {
  open('OPEN'),
  underReview('UNDER_REVIEW'),
  resolvedCustomer('RESOLVED_CUSTOMER'),
  resolvedPartner('RESOLVED_PARTNER'),
  resolvedSplit('RESOLVED_SPLIT'),
  rejected('REJECTED');

  const DisputeStatus(this.value);
  final String value;

  static DisputeStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in DisputeStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum BannerPlacement {
  homeHero('HOME_HERO'),
  homeInline('HOME_INLINE'),
  serviceCategoryTop('SERVICE_CATEGORY_TOP'),
  checkoutPromo('CHECKOUT_PROMO'),
  orderTracking('ORDER_TRACKING'),
  partnerHome('PARTNER_HOME');

  const BannerPlacement(this.value);
  final String value;

  static BannerPlacement? fromValue(String? value) {
    if (value == null) return null;
    for (final e in BannerPlacement.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum CampaignStatus {
  draft('DRAFT'),
  scheduled('SCHEDULED'),
  active('ACTIVE'),
  paused('PAUSED'),
  ended('ENDED'),
  archived('ARCHIVED');

  const CampaignStatus(this.value);
  final String value;

  static CampaignStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in CampaignStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum BannerAudience {
  customer('CUSTOMER'),
  partner('PARTNER');

  const BannerAudience(this.value);
  final String value;

  static BannerAudience? fromValue(String? value) {
    if (value == null) return null;
    for (final e in BannerAudience.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum BannerActionType {
  none('NONE'),
  deepLink('DEEP_LINK'),
  externalUrl('EXTERNAL_URL'),
  promoCode('PROMO_CODE'),
  serviceCategory('SERVICE_CATEGORY');

  const BannerActionType(this.value);
  final String value;

  static BannerActionType? fromValue(String? value) {
    if (value == null) return null;
    for (final e in BannerActionType.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum BannerEventType {
  impression('IMPRESSION'),
  click('CLICK'),
  dismiss('DISMISS');

  const BannerEventType(this.value);
  final String value;

  static BannerEventType? fromValue(String? value) {
    if (value == null) return null;
    for (final e in BannerEventType.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum RiskSignal {
  excessiveCancellations('EXCESSIVE_CANCELLATIONS'),
  promoAbuse('PROMO_ABUSE'),
  multipleAccounts('MULTIPLE_ACCOUNTS'),
  impossibleGpsMovement('IMPOSSIBLE_GPS_MOVEMENT'),
  repeatedFailedPayments('REPEATED_FAILED_PAYMENTS'),
  unusualReferralBehaviour('UNUSUAL_REFERRAL_BEHAVIOUR');

  const RiskSignal(this.value);
  final String value;

  static RiskSignal? fromValue(String? value) {
    if (value == null) return null;
    for (final e in RiskSignal.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum RestrictionTargetType {
  user('USER'),
  partner('PARTNER'),
  device('DEVICE');

  const RestrictionTargetType(this.value);
  final String value;

  static RestrictionTargetType? fromValue(String? value) {
    if (value == null) return null;
    for (final e in RestrictionTargetType.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum RestrictionKind {
  blockJobs('BLOCK_JOBS'),
  blockPromos('BLOCK_PROMOS'),
  blockWallet('BLOCK_WALLET'),
  blockLogin('BLOCK_LOGIN'),
  requireReview('REQUIRE_REVIEW');

  const RestrictionKind(this.value);
  final String value;

  static RestrictionKind? fromValue(String? value) {
    if (value == null) return null;
    for (final e in RestrictionKind.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum MediaKind {
  image('IMAGE'),
  video('VIDEO'),
  audio('AUDIO'),
  document('DOCUMENT');

  const MediaKind(this.value);
  final String value;

  static MediaKind? fromValue(String? value) {
    if (value == null) return null;
    for (final e in MediaKind.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum MediaPurpose {
  profile('PROFILE'),
  partnerDocument('PARTNER_DOCUMENT'),
  vehiclePhoto('VEHICLE_PHOTO'),
  jobAttachment('JOB_ATTACHMENT'),
  proofOfDelivery('PROOF_OF_DELIVERY'),
  chat('CHAT'),
  support('SUPPORT'),
  disputeEvidence('DISPUTE_EVIDENCE'),
  bannerCreative('BANNER_CREATIVE'),
  serviceIcon('SERVICE_ICON');

  const MediaPurpose(this.value);
  final String value;

  static MediaPurpose? fromValue(String? value) {
    if (value == null) return null;
    for (final e in MediaPurpose.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum MediaStatus {
  pendingUpload('PENDING_UPLOAD'),
  uploaded('UPLOADED'),
  processing('PROCESSING'),
  ready('READY'),
  rejected('REJECTED'),
  deleted('DELETED');

  const MediaStatus(this.value);
  final String value;

  static MediaStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in MediaStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum QuoteItemKind {
  labor('LABOR'),
  parts('PARTS'),
  fee('FEE');

  const QuoteItemKind(this.value);
  final String value;

  static QuoteItemKind? fromValue(String? value) {
    if (value == null) return null;
    for (final e in QuoteItemKind.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum SavedPlaceKind {
  home('HOME'),
  work('WORK'),
  custom('CUSTOM');

  const SavedPlaceKind(this.value);
  final String value;

  static SavedPlaceKind? fromValue(String? value) {
    if (value == null) return null;
    for (final e in SavedPlaceKind.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum PackageSize {
  small('SMALL'),
  medium('MEDIUM'),
  large('LARGE'),
  xl('XL');

  const PackageSize(this.value);
  final String value;

  static PackageSize? fromValue(String? value) {
    if (value == null) return null;
    for (final e in PackageSize.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum ReviewDirection {
  customerToPartner('CUSTOMER_TO_PARTNER'),
  partnerToCustomer('PARTNER_TO_CUSTOMER');

  const ReviewDirection(this.value);
  final String value;

  static ReviewDirection? fromValue(String? value) {
    if (value == null) return null;
    for (final e in ReviewDirection.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum DevicePlatform {
  ios('ios'),
  android('android'),
  web('web'),
  unknown('unknown');

  const DevicePlatform(this.value);
  final String value;

  static DevicePlatform? fromValue(String? value) {
    if (value == null) return null;
    for (final e in DevicePlatform.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum ChaletStatus {
  draft('DRAFT'),
  pendingApproval('PENDING_APPROVAL'),
  active('ACTIVE'),
  paused('PAUSED'),
  suspended('SUSPENDED'),
  maintenance('MAINTENANCE'),
  inactive('INACTIVE');

  const ChaletStatus(this.value);
  final String value;

  static ChaletStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in ChaletStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum ChaletApprovalStatus {
  draft('DRAFT'),
  pending('PENDING'),
  underReview('UNDER_REVIEW'),
  approved('APPROVED'),
  rejected('REJECTED');

  const ChaletApprovalStatus(this.value);
  final String value;

  static ChaletApprovalStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in ChaletApprovalStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum ChaletBookingStatus {
  draft('DRAFT'),
  held('HELD'),
  awaitingPayment('AWAITING_PAYMENT'),
  confirmed('CONFIRMED'),
  checkInReady('CHECK_IN_READY'),
  checkedIn('CHECKED_IN'),
  inProgress('IN_PROGRESS'),
  checkedOut('CHECKED_OUT'),
  cleaning('CLEANING'),
  completed('COMPLETED'),
  cancelled('CANCELLED'),
  expired('EXPIRED'),
  noShow('NO_SHOW'),
  disputed('DISPUTED');

  const ChaletBookingStatus(this.value);
  final String value;

  static ChaletBookingStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in ChaletBookingStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum ChaletBookingSource {
  tamam('TAMAM'),
  ownerManual('OWNER_MANUAL'),
  admin('ADMIN');

  const ChaletBookingSource(this.value);
  final String value;

  static ChaletBookingSource? fromValue(String? value) {
    if (value == null) return null;
    for (final e in ChaletBookingSource.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum ChaletBlockKind {
  ownerBlock('OWNER_BLOCK'),
  maintenance('MAINTENANCE');

  const ChaletBlockKind(this.value);
  final String value;

  static ChaletBlockKind? fromValue(String? value) {
    if (value == null) return null;
    for (final e in ChaletBlockKind.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum ChaletPricingProfile {
  conservative('CONSERVATIVE'),
  balanced('BALANCED'),
  aggressiveOccupancy('AGGRESSIVE_OCCUPANCY'),
  custom('CUSTOM');

  const ChaletPricingProfile(this.value);
  final String value;

  static ChaletPricingProfile? fromValue(String? value) {
    if (value == null) return null;
    for (final e in ChaletPricingProfile.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum ChaletPricingMode {
  off('OFF'),
  recommendOnly('RECOMMEND_ONLY'),
  auto('AUTO');

  const ChaletPricingMode(this.value);
  final String value;

  static ChaletPricingMode? fromValue(String? value) {
    if (value == null) return null;
    for (final e in ChaletPricingMode.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum ChaletRateRuleKind {
  timeOfDay('TIME_OF_DAY'),
  dayOfWeek('DAY_OF_WEEK'),
  specialDate('SPECIAL_DATE');

  const ChaletRateRuleKind(this.value);
  final String value;

  static ChaletRateRuleKind? fromValue(String? value) {
    if (value == null) return null;
    for (final e in ChaletRateRuleKind.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum ChaletOfferKind {
  lastMinute('LAST_MINUTE'),
  gapFiller('GAP_FILLER'),
  morningSpecial('MORNING_SPECIAL'),
  extension('EXTENSION'),
  lowDemand('LOW_DEMAND'),
  durationBundle('DURATION_BUNDLE');

  const ChaletOfferKind(this.value);
  final String value;

  static ChaletOfferKind? fromValue(String? value) {
    if (value == null) return null;
    for (final e in ChaletOfferKind.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum ChaletDepositType {
  none('NONE'),
  fixed('FIXED'),
  percentage('PERCENTAGE');

  const ChaletDepositType(this.value);
  final String value;

  static ChaletDepositType? fromValue(String? value) {
    if (value == null) return null;
    for (final e in ChaletDepositType.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum ChaletBookingEventType {
  created('CREATED'),
  held('HELD'),
  holdExtended('HOLD_EXTENDED'),
  confirmed('CONFIRMED'),
  paymentReceived('PAYMENT_RECEIVED'),
  checkIn('CHECK_IN'),
  extensionOffered('EXTENSION_OFFERED'),
  extended('EXTENDED'),
  overstay('OVERSTAY'),
  checkOut('CHECK_OUT'),
  cleaningStarted('CLEANING_STARTED'),
  cleaningCompleted('CLEANING_COMPLETED'),
  completed('COMPLETED'),
  cancelled('CANCELLED'),
  expired('EXPIRED'),
  refunded('REFUNDED'),
  disputed('DISPUTED');

  const ChaletBookingEventType(this.value);
  final String value;

  static ChaletBookingEventType? fromValue(String? value) {
    if (value == null) return null;
    for (final e in ChaletBookingEventType.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

enum ChaletCleaningStatus {
  pending('PENDING'),
  inProgress('IN_PROGRESS'),
  completed('COMPLETED'),
  skipped('SKIPPED');

  const ChaletCleaningStatus(this.value);
  final String value;

  static ChaletCleaningStatus? fromValue(String? value) {
    if (value == null) return null;
    for (final e in ChaletCleaningStatus.values) {
      if (e.value == value) return e;
    }
    return null;
  }
}

abstract final class ErrorCode {
  static const String validationFailed = 'VALIDATION_FAILED';
  static const String unauthenticated = 'UNAUTHENTICATED';
  static const String forbidden = 'FORBIDDEN';
  static const String notFound = 'NOT_FOUND';
  static const String conflict = 'CONFLICT';
  static const String rateLimited = 'RATE_LIMITED';
  static const String idempotencyKeyReused = 'IDEMPOTENCY_KEY_REUSED';
  static const String idempotencyKeyRequired = 'IDEMPOTENCY_KEY_REQUIRED';
  static const String otpInvalid = 'OTP_INVALID';
  static const String otpExpired = 'OTP_EXPIRED';
  static const String otpTooManyAttempts = 'OTP_TOO_MANY_ATTEMPTS';
  static const String otpResendCooldown = 'OTP_RESEND_COOLDOWN';
  static const String tokenExpired = 'TOKEN_EXPIRED';
  static const String tokenRevoked = 'TOKEN_REVOKED';
  static const String accountSuspended = 'ACCOUNT_SUSPENDED';
  static const String accountRestricted = 'ACCOUNT_RESTRICTED';
  static const String partnerNotApproved = 'PARTNER_NOT_APPROVED';
  static const String partnerNotAvailable = 'PARTNER_NOT_AVAILABLE';
  static const String outsideServiceZone = 'OUTSIDE_SERVICE_ZONE';
  static const String serviceUnavailableInZone = 'SERVICE_UNAVAILABLE_IN_ZONE';
  static const String outsideOperatingHours = 'OUTSIDE_OPERATING_HOURS';
  static const String invalidStateTransition = 'INVALID_STATE_TRANSITION';
  static const String jobAlreadyAssigned = 'JOB_ALREADY_ASSIGNED';
  static const String offerExpired = 'OFFER_EXPIRED';
  static const String versionConflict = 'VERSION_CONFLICT';
  static const String tripPinInvalid = 'TRIP_PIN_INVALID';
  static const String deliveryOtpInvalid = 'DELIVERY_OTP_INVALID';
  static const String pickupOtpInvalid = 'PICKUP_OTP_INVALID';
  static const String quoteNotApproved = 'QUOTE_NOT_APPROVED';
  static const String insufficientWalletBalance = 'INSUFFICIENT_WALLET_BALANCE';
  static const String paymentMethodDisabled = 'PAYMENT_METHOD_DISABLED';
  static const String paymentFailed = 'PAYMENT_FAILED';
  static const String promoInvalid = 'PROMO_INVALID';
  static const String promoExpired = 'PROMO_EXPIRED';
  static const String promoUsageExceeded = 'PROMO_USAGE_EXCEEDED';
  static const String promoMinOrderNotMet = 'PROMO_MIN_ORDER_NOT_MET';
  static const String promoNotEligible = 'PROMO_NOT_ELIGIBLE';
  static const String ratingNotAllowed = 'RATING_NOT_ALLOWED';
  static const String uploadInvalid = 'UPLOAD_INVALID';
  static const String uploadTooLarge = 'UPLOAD_TOO_LARGE';
  static const String staleLocation = 'STALE_LOCATION';
  static const String impossibleMovement = 'IMPOSSIBLE_MOVEMENT';
  static const String featureDisabled = 'FEATURE_DISABLED';
  static const String configOutOfRange = 'CONFIG_OUT_OF_RANGE';
  static const String externalServiceError = 'EXTERNAL_SERVICE_ERROR';
  static const String internalError = 'INTERNAL_ERROR';
}

abstract final class Headers {
  static const String idempotencyKey = 'Idempotency-Key';
  static const String requestId = 'X-Request-Id';
  static const String deviceId = 'X-Device-Id';
  static const String appVersion = 'X-App-Version';
  static const String acceptLanguage = 'Accept-Language';
  static const String timezone = 'X-Timezone';
}

abstract final class WsNamespace {
  static const String tracking = '/tracking';
  static const String jobs = '/jobs';
  static const String chat = '/chat';
  static const String admin = '/admin';
}

abstract final class WsEvent {
  static const String partnerLocation = 'partner:location';
  static const String subscribeJob = 'job:subscribe';
  static const String unsubscribeJob = 'job:unsubscribe';
  static const String chatSend = 'chat:send';
  static const String chatRead = 'chat:read';
  static const String adminSubscribeMap = 'admin:map:subscribe';
  static const String jobLocation = 'job:location';
  static const String jobStatus = 'job:status';
  static const String jobOffer = 'job:offer';
  static const String jobOfferExpired = 'job:offer:expired';
  static const String jobEta = 'job:eta';
  static const String chatMessage = 'chat:message';
  static const String chatDelivery = 'chat:delivery';
  static const String adminMapUpdate = 'admin:map:update';
  static const String adminMetrics = 'admin:metrics';
  static const String error = 'error';
}

abstract final class ApiVersion {
  static const String version = 'v1';
  static const String prefix = '/api/v1';
}
