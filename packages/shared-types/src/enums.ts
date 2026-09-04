/**
 * TAMAM shared enums — the single vocabulary used by API, Admin and (mirrored) mobile apps.
 * Keep string values stable: they are persisted in PostgreSQL as enum types.
 */

/* ------------------------------------------------------------------ users */
export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  PARTNER: 'PARTNER',
  ADMIN: 'ADMIN',
  SUPPORT: 'SUPPORT',
  DISPATCHER: 'DISPATCHER',
  FINANCE: 'FINANCE',
  OPERATIONS_MANAGER: 'OPERATIONS_MANAGER',
  MARKETING: 'MARKETING',
  ANALYST: 'ANALYST',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AccountStatus = {
  ACTIVE: 'ACTIVE',
  RESTRICTED: 'RESTRICTED',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED',
} as const;
export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

export const Language = { AR: 'ar', EN: 'en' } as const;
export type Language = (typeof Language)[keyof typeof Language];

/* ---------------------------------------------------------------- partners */
export const PartnerRoleType = {
  DRIVER: 'DRIVER',
  COURIER: 'COURIER',
  TECHNICIAN: 'TECHNICIAN',
  SERVICE_PROVIDER: 'SERVICE_PROVIDER',
} as const;
export type PartnerRoleType = (typeof PartnerRoleType)[keyof typeof PartnerRoleType];

export const VerificationStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const AvailabilityStatus = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  BUSY: 'BUSY',
} as const;
export type AvailabilityStatus = (typeof AvailabilityStatus)[keyof typeof AvailabilityStatus];

export const DocumentType = {
  ID: 'ID',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
  VEHICLE_LICENSE: 'VEHICLE_LICENSE',
  INSURANCE: 'INSURANCE',
  PROFESSIONAL_CERTIFICATE: 'PROFESSIONAL_CERTIFICATE',
  BUSINESS_DOCUMENT: 'BUSINESS_DOCUMENT',
  PROFILE_PICTURE: 'PROFILE_PICTURE',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DocumentStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

/* ------------------------------------------------------------------- jobs */
export const JobType = {
  RIDE: 'RIDE',
  DELIVERY: 'DELIVERY',
  HOME_SERVICE: 'HOME_SERVICE',
  // reserved for future modules — present in the enum so the engine is ready, disabled by feature flags
  FOOD: 'FOOD',
  GROCERY: 'GROCERY',
  PHARMACY: 'PHARMACY',
  SHOPPING: 'SHOPPING',
  MOVING: 'MOVING',
  ROAD_ASSISTANCE: 'ROAD_ASSISTANCE',
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];

export const V1_JOB_TYPES: readonly JobType[] = [
  JobType.RIDE,
  JobType.DELIVERY,
  JobType.HOME_SERVICE,
];

/**
 * Unified Job status. Ride/Delivery use the mobility subset; Home Service adds the
 * inspection/quote/work subset. Transitions are enforced by the JobStateMachine — never
 * update `status` directly.
 */
export const JobStatus = {
  DRAFT: 'DRAFT',
  REQUESTED: 'REQUESTED',
  SEARCHING: 'SEARCHING',
  ASSIGNED: 'ASSIGNED',
  PARTNER_EN_ROUTE: 'PARTNER_EN_ROUTE',
  PARTNER_ARRIVED: 'PARTNER_ARRIVED',
  WAITING_CUSTOMER: 'WAITING_CUSTOMER',
  IN_PROGRESS: 'IN_PROGRESS',
  // home-service specific
  INSPECTION_STARTED: 'INSPECTION_STARTED',
  QUOTE_REQUIRED: 'QUOTE_REQUIRED',
  QUOTE_SUBMITTED: 'QUOTE_SUBMITTED',
  QUOTE_APPROVED: 'QUOTE_APPROVED',
  QUOTE_REJECTED: 'QUOTE_REJECTED',
  WORK_STARTED: 'WORK_STARTED',
  WAITING_FOR_PARTS: 'WAITING_FOR_PARTS',
  WORK_COMPLETED: 'WORK_COMPLETED',
  CUSTOMER_CONFIRMED: 'CUSTOMER_CONFIRMED',
  // terminal
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_PARTNER_AVAILABLE: 'NO_PARTNER_AVAILABLE',
  DISPUTED: 'DISPUTED',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = [
  JobStatus.COMPLETED,
  JobStatus.CANCELLED,
  JobStatus.NO_PARTNER_AVAILABLE,
];

export const ACTIVE_JOB_STATUSES: readonly JobStatus[] = [
  JobStatus.REQUESTED,
  JobStatus.SEARCHING,
  JobStatus.ASSIGNED,
  JobStatus.PARTNER_EN_ROUTE,
  JobStatus.PARTNER_ARRIVED,
  JobStatus.WAITING_CUSTOMER,
  JobStatus.IN_PROGRESS,
  JobStatus.INSPECTION_STARTED,
  JobStatus.QUOTE_REQUIRED,
  JobStatus.QUOTE_SUBMITTED,
  JobStatus.QUOTE_APPROVED,
  JobStatus.QUOTE_REJECTED,
  JobStatus.WORK_STARTED,
  JobStatus.WAITING_FOR_PARTS,
  JobStatus.WORK_COMPLETED,
  JobStatus.CUSTOMER_CONFIRMED,
];

export const JobUrgency = {
  STANDARD: 'STANDARD',
  URGENT: 'URGENT',
  EMERGENCY: 'EMERGENCY',
} as const;
export type JobUrgency = (typeof JobUrgency)[keyof typeof JobUrgency];

export const SchedulingMode = { NOW: 'NOW', SCHEDULED: 'SCHEDULED' } as const;
export type SchedulingMode = (typeof SchedulingMode)[keyof typeof SchedulingMode];

export const JobStopKind = {
  PICKUP: 'PICKUP',
  DROPOFF: 'DROPOFF',
  WAYPOINT: 'WAYPOINT',
  SERVICE_LOCATION: 'SERVICE_LOCATION',
} as const;
export type JobStopKind = (typeof JobStopKind)[keyof typeof JobStopKind];

export const JobActorType = {
  CUSTOMER: 'CUSTOMER',
  PARTNER: 'PARTNER',
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM',
} as const;
export type JobActorType = (typeof JobActorType)[keyof typeof JobActorType];

export const AssignmentStatus = {
  OFFERED: 'OFFERED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  REASSIGNED: 'REASSIGNED',
} as const;
export type AssignmentStatus = (typeof AssignmentStatus)[keyof typeof AssignmentStatus];

export const CancellationActor = {
  CUSTOMER: 'CUSTOMER',
  PARTNER: 'PARTNER',
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM',
} as const;
export type CancellationActor = (typeof CancellationActor)[keyof typeof CancellationActor];

/* ----------------------------------------------------------------- quotes */
export const QuoteStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
  CANCELLED: 'CANCELLED',
} as const;
export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus];

export const QuoteKind = { INITIAL: 'INITIAL', CHANGE_ORDER: 'CHANGE_ORDER' } as const;
export type QuoteKind = (typeof QuoteKind)[keyof typeof QuoteKind];

/* --------------------------------------------------------------- services */
export const PricingMethod = {
  METERED: 'METERED', // ride: base + distance + time
  DISTANCE_WEIGHT: 'DISTANCE_WEIGHT', // delivery
  FIXED: 'FIXED',
  INSPECTION_QUOTE: 'INSPECTION_QUOTE',
  HOURLY: 'HOURLY',
  STARTING_FROM: 'STARTING_FROM',
  CUSTOM_QUOTE: 'CUSTOM_QUOTE',
} as const;
export type PricingMethod = (typeof PricingMethod)[keyof typeof PricingMethod];

export const DynamicFieldType = {
  TEXT: 'TEXT',
  TEXTAREA: 'TEXTAREA',
  NUMBER: 'NUMBER',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  BOOLEAN: 'BOOLEAN',
  DATE: 'DATE',
  TIME: 'TIME',
  IMAGE: 'IMAGE',
  IMAGES: 'IMAGES',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
} as const;
export type DynamicFieldType = (typeof DynamicFieldType)[keyof typeof DynamicFieldType];

/* ---------------------------------------------------------------- vehicles */
export const VehicleStatus = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' } as const;
export type VehicleStatus = (typeof VehicleStatus)[keyof typeof VehicleStatus];

/* ---------------------------------------------------------------- payments */
export const PaymentMethod = {
  CASH: 'CASH',
  WALLET: 'WALLET',
  CARD: 'CARD',
  BANK: 'BANK',
  EXTERNAL_GATEWAY: 'EXTERNAL_GATEWAY',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const RefundStatus = {
  PENDING: 'PENDING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
} as const;
export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus];

export const WalletOwnerType = {
  CUSTOMER: 'CUSTOMER',
  PARTNER: 'PARTNER',
  PLATFORM: 'PLATFORM',
} as const;
export type WalletOwnerType = (typeof WalletOwnerType)[keyof typeof WalletOwnerType];

export const LedgerAccountType = {
  CUSTOMER_WALLET: 'CUSTOMER_WALLET',
  PARTNER_WALLET: 'PARTNER_WALLET',
  PLATFORM_REVENUE: 'PLATFORM_REVENUE',
  PLATFORM_CASH_CLEARING: 'PLATFORM_CASH_CLEARING',
  PLATFORM_GATEWAY_CLEARING: 'PLATFORM_GATEWAY_CLEARING',
  PLATFORM_PROMO_EXPENSE: 'PLATFORM_PROMO_EXPENSE',
  PLATFORM_REFUND_EXPENSE: 'PLATFORM_REFUND_EXPENSE',
  PLATFORM_PAYABLES: 'PLATFORM_PAYABLES',
} as const;
export type LedgerAccountType = (typeof LedgerAccountType)[keyof typeof LedgerAccountType];

export const LedgerEntryDirection = { DEBIT: 'DEBIT', CREDIT: 'CREDIT' } as const;
export type LedgerEntryDirection = (typeof LedgerEntryDirection)[keyof typeof LedgerEntryDirection];

export const LedgerTransactionType = {
  JOB_CHARGE: 'JOB_CHARGE',
  JOB_COMMISSION: 'JOB_COMMISSION',
  PARTNER_EARNING: 'PARTNER_EARNING',
  CASH_COLLECTED: 'CASH_COLLECTED',
  WALLET_TOPUP: 'WALLET_TOPUP',
  WALLET_WITHDRAWAL: 'WALLET_WITHDRAWAL',
  REFUND: 'REFUND',
  PROMO_DISCOUNT: 'PROMO_DISCOUNT',
  REFERRAL_REWARD: 'REFERRAL_REWARD',
  CANCELLATION_FEE: 'CANCELLATION_FEE',
  BONUS: 'BONUS',
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
  DISPUTE_SETTLEMENT: 'DISPUTE_SETTLEMENT',
} as const;
export type LedgerTransactionType =
  (typeof LedgerTransactionType)[keyof typeof LedgerTransactionType];

export const WithdrawalStatus = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
} as const;
export type WithdrawalStatus = (typeof WithdrawalStatus)[keyof typeof WithdrawalStatus];

/* -------------------------------------------------------------- promotions */
export const PromoType = { PERCENTAGE: 'PERCENTAGE', FIXED_AMOUNT: 'FIXED_AMOUNT' } as const;
export type PromoType = (typeof PromoType)[keyof typeof PromoType];

export const CommissionScope = {
  GLOBAL: 'GLOBAL',
  JOB_TYPE: 'JOB_TYPE',
  CATEGORY: 'CATEGORY',
  ZONE: 'ZONE',
  PARTNER: 'PARTNER',
  CAMPAIGN: 'CAMPAIGN',
} as const;
export type CommissionScope = (typeof CommissionScope)[keyof typeof CommissionScope];

/* ------------------------------------------------------------ notifications */
export const NotificationChannel = {
  PUSH: 'PUSH',
  IN_APP: 'IN_APP',
  SMS: 'SMS',
  EMAIL: 'EMAIL',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationEvent = {
  OTP_CODE: 'OTP_CODE',
  JOB_CREATED: 'JOB_CREATED',
  JOB_OFFER: 'JOB_OFFER',
  JOB_ACCEPTED: 'JOB_ACCEPTED',
  PARTNER_ARRIVING: 'PARTNER_ARRIVING',
  PARTNER_ARRIVED: 'PARTNER_ARRIVED',
  JOB_STARTED: 'JOB_STARTED',
  QUOTE_RECEIVED: 'QUOTE_RECEIVED',
  QUOTE_APPROVED: 'QUOTE_APPROVED',
  QUOTE_REJECTED: 'QUOTE_REJECTED',
  JOB_COMPLETED: 'JOB_COMPLETED',
  JOB_CANCELLED: 'JOB_CANCELLED',
  NO_PARTNER_AVAILABLE: 'NO_PARTNER_AVAILABLE',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  DOCUMENT_EXPIRING: 'DOCUMENT_EXPIRING',
  DOCUMENT_REVIEWED: 'DOCUMENT_REVIEWED',
  PARTNER_APPROVED: 'PARTNER_APPROVED',
  NEW_MESSAGE: 'NEW_MESSAGE',
  SUPPORT_REPLY: 'SUPPORT_REPLY',
  PROMO_CAMPAIGN: 'PROMO_CAMPAIGN',
  SCHEDULED_REMINDER: 'SCHEDULED_REMINDER',
} as const;
export type NotificationEvent = (typeof NotificationEvent)[keyof typeof NotificationEvent];

export const NotificationStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

/* ------------------------------------------------------------------- chat */
export const MessageType = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  LOCATION: 'LOCATION',
  SYSTEM: 'SYSTEM',
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

/* ---------------------------------------------------------------- support */
export const TicketCategory = {
  PAYMENT: 'PAYMENT',
  JOB_ISSUE: 'JOB_ISSUE',
  PARTNER_BEHAVIOUR: 'PARTNER_BEHAVIOUR',
  CUSTOMER_BEHAVIOUR: 'CUSTOMER_BEHAVIOUR',
  LOST_ITEM: 'LOST_ITEM',
  ACCOUNT: 'ACCOUNT',
  SAFETY: 'SAFETY',
  OTHER: 'OTHER',
} as const;
export type TicketCategory = (typeof TicketCategory)[keyof typeof TicketCategory];

export const TicketPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type TicketPriority = (typeof TicketPriority)[keyof typeof TicketPriority];

export const TicketStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_USER: 'WAITING_USER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const DisputeStatus = {
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED_CUSTOMER: 'RESOLVED_CUSTOMER',
  RESOLVED_PARTNER: 'RESOLVED_PARTNER',
  RESOLVED_SPLIT: 'RESOLVED_SPLIT',
  REJECTED: 'REJECTED',
} as const;
export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus];

/* ---------------------------------------------------------------- banners */
export const BannerPlacement = {
  HOME_HERO: 'HOME_HERO',
  HOME_INLINE: 'HOME_INLINE',
  SERVICE_CATEGORY_TOP: 'SERVICE_CATEGORY_TOP',
  CHECKOUT_PROMO: 'CHECKOUT_PROMO',
  ORDER_TRACKING: 'ORDER_TRACKING',
  PARTNER_HOME: 'PARTNER_HOME',
} as const;
export type BannerPlacement = (typeof BannerPlacement)[keyof typeof BannerPlacement];

export const CampaignStatus = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const BannerAudience = { CUSTOMER: 'CUSTOMER', PARTNER: 'PARTNER' } as const;
export type BannerAudience = (typeof BannerAudience)[keyof typeof BannerAudience];

export const BannerActionType = {
  NONE: 'NONE',
  DEEP_LINK: 'DEEP_LINK', // in-app route, e.g. tamam://services/plumbing
  EXTERNAL_URL: 'EXTERNAL_URL',
  PROMO_CODE: 'PROMO_CODE', // applies a promo code on tap
  SERVICE_CATEGORY: 'SERVICE_CATEGORY',
} as const;
export type BannerActionType = (typeof BannerActionType)[keyof typeof BannerActionType];

export const BannerEventType = {
  IMPRESSION: 'IMPRESSION',
  CLICK: 'CLICK',
  DISMISS: 'DISMISS',
} as const;
export type BannerEventType = (typeof BannerEventType)[keyof typeof BannerEventType];

/* ------------------------------------------------------------------- risk */
export const RiskSignal = {
  EXCESSIVE_CANCELLATIONS: 'EXCESSIVE_CANCELLATIONS',
  PROMO_ABUSE: 'PROMO_ABUSE',
  MULTIPLE_ACCOUNTS: 'MULTIPLE_ACCOUNTS',
  IMPOSSIBLE_GPS_MOVEMENT: 'IMPOSSIBLE_GPS_MOVEMENT',
  REPEATED_FAILED_PAYMENTS: 'REPEATED_FAILED_PAYMENTS',
  UNUSUAL_REFERRAL_BEHAVIOUR: 'UNUSUAL_REFERRAL_BEHAVIOUR',
} as const;
export type RiskSignal = (typeof RiskSignal)[keyof typeof RiskSignal];

export const RestrictionTargetType = {
  USER: 'USER',
  PARTNER: 'PARTNER',
  DEVICE: 'DEVICE',
} as const;
export type RestrictionTargetType =
  (typeof RestrictionTargetType)[keyof typeof RestrictionTargetType];

/** Mirrors the `restriction_kind` enum in schema.prisma. */
export const RestrictionKind = {
  BLOCK_JOBS: 'BLOCK_JOBS',
  BLOCK_PROMOS: 'BLOCK_PROMOS',
  BLOCK_WALLET: 'BLOCK_WALLET',
  BLOCK_LOGIN: 'BLOCK_LOGIN',
  REQUIRE_REVIEW: 'REQUIRE_REVIEW',
} as const;
export type RestrictionKind = (typeof RestrictionKind)[keyof typeof RestrictionKind];

/* ------------------------------------------------------------------ media */
export const MediaKind = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  DOCUMENT: 'DOCUMENT',
} as const;
export type MediaKind = (typeof MediaKind)[keyof typeof MediaKind];

export const MediaPurpose = {
  PROFILE: 'PROFILE',
  PARTNER_DOCUMENT: 'PARTNER_DOCUMENT',
  VEHICLE_PHOTO: 'VEHICLE_PHOTO',
  JOB_ATTACHMENT: 'JOB_ATTACHMENT',
  PROOF_OF_DELIVERY: 'PROOF_OF_DELIVERY',
  CHAT: 'CHAT',
  SUPPORT: 'SUPPORT',
  DISPUTE_EVIDENCE: 'DISPUTE_EVIDENCE',
  BANNER_CREATIVE: 'BANNER_CREATIVE',
  SERVICE_ICON: 'SERVICE_ICON',
} as const;
export type MediaPurpose = (typeof MediaPurpose)[keyof typeof MediaPurpose];

/** Lifecycle of an uploaded asset. Mirrors the `media_status` enum in schema.prisma. */
export const MediaStatus = {
  PENDING_UPLOAD: 'PENDING_UPLOAD',
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  REJECTED: 'REJECTED',
  DELETED: 'DELETED',
} as const;
export type MediaStatus = (typeof MediaStatus)[keyof typeof MediaStatus];

/* ---------------------------------------------------------------- banners */
/** Theme keys defined in `packages/ui-tokens/tokens.json` under `banner.themes`. */
export const BANNER_THEMES = [
  'purple',
  'yellow',
  'dark',
  'light',
  'gradientPurple',
  'gradientSunset',
] as const;
export type BannerTheme = (typeof BANNER_THEMES)[number];

/* ---------------------------------------------------------------- currency */
export const SUPPORTED_CURRENCIES = ['ILS', 'USD', 'JOD'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];
export const DEFAULT_CURRENCY: CurrencyCode = 'ILS';
/** Minor units per major unit (ILS agora=100, USD cent=100, JOD fils=1000). */
export const CURRENCY_MINOR_UNITS: Record<CurrencyCode, number> = { ILS: 100, USD: 100, JOD: 1000 };

/* ------------------------------------------------- promoted from inline unions */
/**
 * These five were written as inline string unions inside dto.ts. The values were
 * right, but an inline union is invisible to the Dart generator, so both Flutter
 * apps hand-copied the strings — the drift the parity spec exists to stop. They
 * are named here and referenced from dto.ts.
 */

/** Mirrors the `quote_item_kind` enum in schema.prisma. */
export const QuoteItemKind = {
  LABOR: 'LABOR',
  PARTS: 'PARTS',
  FEE: 'FEE',
} as const;
export type QuoteItemKind = (typeof QuoteItemKind)[keyof typeof QuoteItemKind];

/** Mirrors the `saved_place_kind` enum in schema.prisma. */
export const SavedPlaceKind = {
  HOME: 'HOME',
  WORK: 'WORK',
  CUSTOM: 'CUSTOM',
} as const;
export type SavedPlaceKind = (typeof SavedPlaceKind)[keyof typeof SavedPlaceKind];

/** Mirrors the `package_size` enum in schema.prisma. */
export const PackageSize = {
  SMALL: 'SMALL',
  MEDIUM: 'MEDIUM',
  LARGE: 'LARGE',
  XL: 'XL',
} as const;
export type PackageSize = (typeof PackageSize)[keyof typeof PackageSize];

/** Mirrors the `review_direction` enum in schema.prisma. */
export const ReviewDirection = {
  CUSTOMER_TO_PARTNER: 'CUSTOMER_TO_PARTNER',
  PARTNER_TO_CUSTOMER: 'PARTNER_TO_CUSTOMER',
} as const;
export type ReviewDirection = (typeof ReviewDirection)[keyof typeof ReviewDirection];

/** Mirrors the `device_platform` enum in schema.prisma. Lowercase on purpose. */
export const DevicePlatform = {
  IOS: 'ios',
  ANDROID: 'android',
  WEB: 'web',
  UNKNOWN: 'unknown',
} as const;
export type DevicePlatform = (typeof DevicePlatform)[keyof typeof DevicePlatform];

/* ----------------------------------------------------------------- chalet */
/**
 * TAMAM Chalet books by the hour, so its vocabulary is about time rather than
 * dispatch. Every enum below mirrors a `chalet_*` enum in schema.prisma; the
 * parity spec in this package fails the build if the two ever drift.
 */

/** Mirrors the `chalet_status` enum in schema.prisma. */
export const ChaletStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  SUSPENDED: 'SUSPENDED',
  MAINTENANCE: 'MAINTENANCE',
  INACTIVE: 'INACTIVE',
} as const;
export type ChaletStatus = (typeof ChaletStatus)[keyof typeof ChaletStatus];

/** Mirrors the `chalet_approval_status` enum in schema.prisma. */
export const ChaletApprovalStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ChaletApprovalStatus = (typeof ChaletApprovalStatus)[keyof typeof ChaletApprovalStatus];

/**
 * Mirrors the `chalet_booking_status` enum in schema.prisma.
 *
 * DRAFT is a booking being assembled that holds nothing. From HELD onwards the
 * slot is occupied — see CHALET_SLOT_HOLDING_STATUSES, which is the same list
 * the database exclusion constraint uses.
 */
export const ChaletBookingStatus = {
  DRAFT: 'DRAFT',
  HELD: 'HELD',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  CONFIRMED: 'CONFIRMED',
  CHECK_IN_READY: 'CHECK_IN_READY',
  CHECKED_IN: 'CHECKED_IN',
  IN_PROGRESS: 'IN_PROGRESS',
  CHECKED_OUT: 'CHECKED_OUT',
  CLEANING: 'CLEANING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  NO_SHOW: 'NO_SHOW',
  DISPUTED: 'DISPUTED',
} as const;
export type ChaletBookingStatus = (typeof ChaletBookingStatus)[keyof typeof ChaletBookingStatus];

/**
 * Where a booking came from. OWNER_MANUAL is how an owner records a booking
 * taken over the phone or through another site: it occupies the calendar
 * exactly like a TAMAM booking, which is what keeps TAMAM the source of truth.
 * Mirrors the `chalet_booking_source` enum in schema.prisma.
 */
export const ChaletBookingSource = {
  TAMAM: 'TAMAM',
  OWNER_MANUAL: 'OWNER_MANUAL',
  ADMIN: 'ADMIN',
} as const;
export type ChaletBookingSource = (typeof ChaletBookingSource)[keyof typeof ChaletBookingSource];

/** Mirrors the `chalet_block_kind` enum in schema.prisma. */
export const ChaletBlockKind = {
  OWNER_BLOCK: 'OWNER_BLOCK',
  MAINTENANCE: 'MAINTENANCE',
} as const;
export type ChaletBlockKind = (typeof ChaletBlockKind)[keyof typeof ChaletBlockKind];

/**
 * How boldly Smart Pricing is allowed to move the hourly rate. Mirrors the
 * `chalet_pricing_profile` enum in schema.prisma.
 */
export const ChaletPricingProfile = {
  CONSERVATIVE: 'CONSERVATIVE',
  BALANCED: 'BALANCED',
  AGGRESSIVE_OCCUPANCY: 'AGGRESSIVE_OCCUPANCY',
  CUSTOM: 'CUSTOM',
} as const;
export type ChaletPricingProfile = (typeof ChaletPricingProfile)[keyof typeof ChaletPricingProfile];

/**
 * OFF keeps the base rate. RECOMMEND_ONLY shows the owner a suggestion and
 * changes nothing. AUTO applies it, still bounded by the chalet's price floor.
 * Mirrors the `chalet_pricing_mode` enum in schema.prisma.
 */
export const ChaletPricingMode = {
  OFF: 'OFF',
  RECOMMEND_ONLY: 'RECOMMEND_ONLY',
  AUTO: 'AUTO',
} as const;
export type ChaletPricingMode = (typeof ChaletPricingMode)[keyof typeof ChaletPricingMode];

/** Mirrors the `chalet_rate_rule_kind` enum in schema.prisma. */
export const ChaletRateRuleKind = {
  TIME_OF_DAY: 'TIME_OF_DAY',
  DAY_OF_WEEK: 'DAY_OF_WEEK',
  SPECIAL_DATE: 'SPECIAL_DATE',
} as const;
export type ChaletRateRuleKind = (typeof ChaletRateRuleKind)[keyof typeof ChaletRateRuleKind];

/** Mirrors the `chalet_offer_kind` enum in schema.prisma. */
export const ChaletOfferKind = {
  LAST_MINUTE: 'LAST_MINUTE',
  GAP_FILLER: 'GAP_FILLER',
  MORNING_SPECIAL: 'MORNING_SPECIAL',
  EXTENSION: 'EXTENSION',
  LOW_DEMAND: 'LOW_DEMAND',
  DURATION_BUNDLE: 'DURATION_BUNDLE',
} as const;
export type ChaletOfferKind = (typeof ChaletOfferKind)[keyof typeof ChaletOfferKind];

/** Mirrors the `chalet_deposit_type` enum in schema.prisma. */
export const ChaletDepositType = {
  NONE: 'NONE',
  FIXED: 'FIXED',
  PERCENTAGE: 'PERCENTAGE',
} as const;
export type ChaletDepositType = (typeof ChaletDepositType)[keyof typeof ChaletDepositType];

/** Mirrors the `chalet_booking_event_type` enum in schema.prisma. */
export const ChaletBookingEventType = {
  CREATED: 'CREATED',
  HELD: 'HELD',
  HOLD_EXTENDED: 'HOLD_EXTENDED',
  CONFIRMED: 'CONFIRMED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  CHECK_IN: 'CHECK_IN',
  EXTENSION_OFFERED: 'EXTENSION_OFFERED',
  EXTENDED: 'EXTENDED',
  OVERSTAY: 'OVERSTAY',
  CHECK_OUT: 'CHECK_OUT',
  CLEANING_STARTED: 'CLEANING_STARTED',
  CLEANING_COMPLETED: 'CLEANING_COMPLETED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  REFUNDED: 'REFUNDED',
  DISPUTED: 'DISPUTED',
} as const;
export type ChaletBookingEventType =
  (typeof ChaletBookingEventType)[keyof typeof ChaletBookingEventType];

/** Mirrors the `chalet_cleaning_status` enum in schema.prisma. */
export const ChaletCleaningStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
} as const;
export type ChaletCleaningStatus = (typeof ChaletCleaningStatus)[keyof typeof ChaletCleaningStatus];

/**
 * The statuses that actually occupy the calendar. This list is duplicated in
 * the `chalet_bookings_no_overlap` exclusion constraint (002_chalet.sql), and
 * the availability engine filters by it; the parity spec keeps the two equal so
 * a status added on one side cannot silently free or block a slot on the other.
 */
export const CHALET_SLOT_HOLDING_STATUSES = [
  ChaletBookingStatus.HELD,
  ChaletBookingStatus.AWAITING_PAYMENT,
  ChaletBookingStatus.CONFIRMED,
  ChaletBookingStatus.CHECK_IN_READY,
  ChaletBookingStatus.CHECKED_IN,
  ChaletBookingStatus.IN_PROGRESS,
  ChaletBookingStatus.CHECKED_OUT,
  ChaletBookingStatus.CLEANING,
] as const;
export type ChaletSlotHoldingStatus = (typeof CHALET_SLOT_HOLDING_STATUSES)[number];

/** A booking in one of these statuses is over; it no longer blocks anything. */
export const CHALET_TERMINAL_STATUSES = [
  ChaletBookingStatus.COMPLETED,
  ChaletBookingStatus.CANCELLED,
  ChaletBookingStatus.EXPIRED,
  ChaletBookingStatus.NO_SHOW,
] as const;
export type ChaletTerminalStatus = (typeof CHALET_TERMINAL_STATUSES)[number];
