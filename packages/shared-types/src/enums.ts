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
