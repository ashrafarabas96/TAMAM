import type { Address, GeoPoint, LocalizedText, Money } from './api';
import type {
  AccountStatus,
  AssignmentStatus,
  AvailabilityStatus,
  BannerActionType,
  BannerAudience,
  BannerPlacement,
  BannerTheme,
  CampaignStatus,
  ChaletApprovalStatus,
  ChaletBlockKind,
  ChaletBookingEventType,
  ChaletBookingSource,
  ChaletBookingStatus,
  ChaletDepositType,
  ChaletOfferKind,
  ChaletPricingMode,
  ChaletPricingProfile,
  ChaletStatus,
  DevicePlatform,
  DocumentStatus,
  DocumentType,
  DynamicFieldType,
  JobActorType,
  JobStatus,
  JobStopKind,
  JobType,
  JobUrgency,
  Language,
  MessageType,
  NotificationChannel,
  NotificationEvent,
  PackageSize,
  PartnerRoleType,
  PaymentMethod,
  PaymentStatus,
  PricingMethod,
  QuoteItemKind,
  QuoteKind,
  QuoteStatus,
  RefundStatus,
  ReviewDirection,
  RiskSignal,
  SavedPlaceKind,
  SchedulingMode,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  UserRole,
  VerificationStatus,
} from './enums';
import type { Permission } from './permissions';

/* ------------------------------------------------------------------ auth */
export interface RequestOtpResponse {
  /** Seconds until the user may request another code. */
  resendAfterSeconds: number;
  /** Seconds until the code expires. */
  expiresInSeconds: number;
  /** Only in non-production environments with a console SMS provider. */
  devCode?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresInSeconds: number;
  refreshExpiresInSeconds: number;
  tokenType: 'Bearer';
}

export interface AuthSession {
  tokens: AuthTokens;
  user: UserDto;
  isNewUser: boolean;
}

export interface DeviceSessionDto {
  id: string;
  deviceId: string;
  deviceName: string | null;
  platform: DevicePlatform;
  appVersion: string | null;
  lastSeenAt: string;
  createdAt: string;
  current: boolean;
}

/* ------------------------------------------------------------------ users */
export interface UserDto {
  id: string;
  phone: string; // E.164
  email: string | null;
  fullName: string | null;
  profileImageUrl: string | null;
  language: Language;
  currency: string;
  roles: UserRole[];
  /**
   * Effective permissions of the authenticated principal, resolved server-side from the
   * current role bundles. Sent by `GET /me` only — a list route describes other users, not
   * the caller. Clients must prefer this over deriving permissions from `roles`, which
   * drifts the moment a role is edited.
   */
  permissions?: Permission[];
  accountStatus: AccountStatus;
  createdAt: string;
  customer?: CustomerProfileDto;
  partner?: PartnerSummaryDto;
}

export interface CustomerProfileDto {
  rating: number;
  ratingCount: number;
  completedJobs: number;
  cancelledJobs: number;
  referralCode: string;
}

export interface SavedPlaceDto extends Address {
  id: string;
  kind: SavedPlaceKind;
  createdAt: string;
}

/* --------------------------------------------------------------- partners */
export interface PartnerSummaryDto {
  id: string;
  verificationStatus: VerificationStatus;
  availability: AvailabilityStatus;
  roles: PartnerRoleType[];
  rating: number;
  ratingCount: number;
  completedJobs: number;
  acceptanceRate: number; // 0..1
  cancellationRate: number; // 0..1
}

export interface PartnerDto extends PartnerSummaryDto {
  userId: string;
  fullName: string | null;
  phone: string;
  profileImageUrl: string | null;
  skills: string[];
  categoryIds: string[];
  zoneIds: string[];
  activeVehicleId: string | null;
  walletBalance: Money;
  lastHeartbeatAt: string | null;
  lastLocation: GeoPoint | null;
  documents: PartnerDocumentDto[];
  onboardingStep: number;
  createdAt: string;
}

export interface PartnerDocumentDto {
  id: string;
  type: DocumentType;
  number: string | null;
  fileUrl: string; // signed
  issuedAt: string | null;
  expiresAt: string | null;
  status: DocumentStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface VehicleDto {
  id: string;
  partnerId: string;
  vehicleTypeId: string;
  vehicleType: VehicleTypeDto;
  brand: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  seats: number;
  photoUrls: string[];
  isActive: boolean;
  verificationStatus: VerificationStatus;
}

export interface VehicleTypeDto {
  id: string;
  code: string; // ECONOMY, FAMILY, PREMIUM, MOTORBIKE, DELIVERY_CAR
  name: LocalizedText;
  description: LocalizedText | null;
  iconUrl: string | null;
  seats: number;
  cargoCapacityKg: number | null;
  allowedJobTypes: JobType[];
  sortOrder: number;
  isActive: boolean;
}

/* --------------------------------------------------------------- services */
export interface DynamicFieldDto {
  key: string;
  type: DynamicFieldType;
  label: LocalizedText;
  placeholder?: LocalizedText;
  required: boolean;
  options?: Array<{ value: string; label: LocalizedText }>;
  min?: number;
  max?: number;
  maxItems?: number;
  sortOrder: number;
}

export interface ServiceTypeDto {
  id: string;
  code: JobType;
  name: LocalizedText;
  description: LocalizedText | null;
  iconUrl: string | null;
  colorHex: string;
  sortOrder: number;
  isActive: boolean;
  featureFlagKey: string | null;
}

export interface ServiceCategoryDto {
  id: string;
  serviceTypeId: string;
  jobType: JobType;
  slug: string;
  name: LocalizedText;
  description: LocalizedText | null;
  iconUrl: string | null;
  imageUrl: string | null;
  colorHex: string | null;
  pricingMethod: PricingMethod;
  requiredPartnerRole: PartnerRoleType;
  requiredDocumentTypes: DocumentType[];
  requiredFields: DynamicFieldDto[];
  requiredMedia: {
    images: boolean;
    video: boolean;
    audio: boolean;
    minImages: number;
    maxImages: number;
  };
  allowsInstant: boolean;
  allowsScheduled: boolean;
  urgencyLevels: JobUrgency[];
  inspectionFee: Money | null;
  startingFrom: Money | null;
  hourlyRate: Money | null;
  fixedPrice: Money | null;
  workflowConfig: {
    skipInspection: boolean;
    requiresQuote: boolean;
    requiresCustomerConfirmation: boolean;
    autoConfirmHours: number;
  };
  zoneIds: string[]; // empty = all zones
  isFeatured: boolean;
  sortOrder: number;
  isActive: boolean;
  subcategories?: ServiceSubcategoryDto[];
}

export interface ServiceSubcategoryDto {
  id: string;
  categoryId: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText | null;
  iconUrl: string | null;
  fixedPrice: Money | null;
  startingFrom: Money | null;
  estimatedDurationMin: number | null;
  sortOrder: number;
  isActive: boolean;
  options?: ServiceOptionDto[];
}

export interface ServiceOptionDto {
  id: string;
  subcategoryId: string;
  name: LocalizedText;
  price: Money;
  isActive: boolean;
}

/* ------------------------------------------------------------------ zones */
export interface ServiceZoneDto {
  id: string;
  code: string;
  name: LocalizedText;
  city: string;
  currency: string;
  timezone: string;
  polygon: GeoJsonPolygon;
  center: GeoPoint;
  isActive: boolean;
  operatingHours: OperatingHoursDto[];
  createdAt: string;
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // [lng, lat]
}

export interface OperatingHoursDto {
  dayOfWeek: number; // 0 = Sunday
  opensAt: string; // "08:00"
  closesAt: string; // "23:00"
  isClosed: boolean;
}

/* ------------------------------------------------------------------- jobs */
export interface JobStopDto {
  id: string;
  sequence: number;
  kind: JobStopKind;
  address: Address;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
}

export interface FareBreakdownLine {
  code: string; // BASE_FARE, DISTANCE, TIME, BOOKING_FEE, ZONE_FEE, SERVICE_FEE, SURGE, URGENCY, DISCOUNT, PROMO, TAX, INSPECTION_FEE, LABOR, PARTS, CANCELLATION_FEE
  label: LocalizedText;
  amount: Money;
}

export interface FareEstimateDto {
  estimateId: string; // short-lived, referenced when creating the job
  jobType: JobType;
  currency: string;
  distanceMeters: number;
  durationSeconds: number;
  options: FareOptionDto[];
  expiresAt: string;
  routePolyline: string | null;
}

export interface FareOptionDto {
  vehicleTypeId: string | null;
  categoryId: string | null;
  name: LocalizedText;
  iconUrl: string | null;
  seats: number | null;
  etaToPickupSeconds: number | null;
  total: Money;
  breakdown: FareBreakdownLine[];
  surgeMultiplier: number;
  pricingSnapshotId: string;
}

export interface JobDto {
  id: string;
  number: string; // human readable, e.g. TM-24-000123
  type: JobType;
  status: JobStatus;
  version: number;
  customerId: string;
  partnerId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  vehicleTypeId: string | null;
  zoneId: string;
  scheduling: SchedulingMode;
  scheduledFor: string | null;
  urgency: JobUrgency;
  currency: string;
  paymentMethod: PaymentMethod;
  stops: JobStopDto[];
  estimatedTotal: Money | null;
  finalTotal: Money | null;
  breakdown: FareBreakdownLine[];
  distanceMeters: number | null;
  durationSeconds: number | null;
  etaToPickupSeconds: number | null;
  etaToDestinationSeconds: number | null;
  description: string | null;
  dynamicFields: Record<string, unknown>;
  mediaUrls: string[];
  tripPinRequired: boolean;
  tripPin?: string; // customer only
  pickupOtpRequired: boolean;
  pickupOtp?: string; // customer only — the sender reads it out to the courier at pickup
  deliveryOtpRequired: boolean;
  deliveryOtp?: string; // customer/recipient only
  delivery?: DeliveryDetailsDto;
  partner?: JobPartnerCardDto;
  customer?: JobCustomerCardDto;
  activeQuote?: QuoteDto | null;
  promoCode: string | null;
  cancellationReason: string | null;
  cancelledBy: JobActorType | null;
  cancellationFee: Money | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  events?: JobEventDto[];
}

export interface DeliveryDetailsDto {
  packageCategoryId: string;
  packageCategoryName: LocalizedText;
  approximateSize: PackageSize;
  approximateWeightKg: number | null;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  deliveryNotes: string | null;
  proof?: ProofOfDeliveryDto | null;
}

export interface ProofOfDeliveryDto {
  receiverName: string | null;
  photoUrl: string | null;
  signatureUrl: string | null;
  location: GeoPoint | null;
  otpVerified: boolean;
  timestamp: string;
}

export interface JobPartnerCardDto {
  id: string;
  fullName: string;
  profileImageUrl: string | null;
  rating: number;
  ratingCount: number;
  maskedPhone: string | null;
  vehicle: {
    brand: string;
    model: string;
    color: string;
    plate: string;
    typeName: LocalizedText;
  } | null;
  location: GeoPoint | null;
}

export interface JobCustomerCardDto {
  id: string;
  fullName: string;
  profileImageUrl: string | null;
  rating: number;
  maskedPhone: string | null;
}

export interface JobEventDto {
  id: string;
  type: string;
  fromStatus: JobStatus | null;
  toStatus: JobStatus | null;
  actorType: JobActorType;
  actorId: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface JobOfferDto {
  assignmentId: string;
  job: JobDto;
  wave: number;
  expiresAt: string;
  distanceToPickupMeters: number;
  etaToPickupSeconds: number;
  estimatedEarnings: Money;
}

export interface JobAssignmentDto {
  id: string;
  jobId: string;
  partnerId: string;
  wave: number;
  status: AssignmentStatus;
  offeredAt: string;
  respondedAt: string | null;
  expiresAt: string;
  score: number;
}

/* ----------------------------------------------------------------- quotes */
export interface QuoteItemDto {
  id: string;
  kind: QuoteItemKind;
  description: string;
  quantity: number;
  unitPrice: Money;
  total: Money;
}

export interface QuoteDto {
  id: string;
  jobId: string;
  kind: QuoteKind;
  revision: number;
  status: QuoteStatus;
  laborCost: Money;
  partsCost: Money;
  additionalFees: Money;
  discount: Money;
  tax: Money;
  total: Money;
  description: string | null;
  estimatedDurationMin: number | null;
  items: QuoteItemDto[];
  submittedAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  supersedesQuoteId: string | null;
}

/* --------------------------------------------------------------- payments */
export interface PaymentDto {
  id: string;
  jobId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: Money;
  capturedAmount: Money;
  refundedAmount: Money;
  providerRef: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface WalletDto {
  id: string;
  currency: string;
  balance: Money;
  pendingBalance: Money;
  updatedAt: string;
}

export interface LedgerEntryDto {
  id: string;
  transactionId: string;
  transactionType: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: Money;
  balanceAfter: Money;
  description: string;
  jobId: string | null;
  createdAt: string;
}

export interface PartnerEarningsDto {
  period: 'today' | 'week' | 'month';
  currency: string;
  completedJobs: number;
  grossEarnings: Money;
  commission: Money;
  bonuses: Money;
  adjustments: Money;
  netEarnings: Money;
  withdrawals: Money;
  currentBalance: Money;
}

export interface ReceiptDto {
  id: string;
  jobNumber: string;
  customerName: string;
  date: string;
  serviceName: LocalizedText;
  breakdown: FareBreakdownLine[];
  paymentMethod: PaymentMethod;
  total: Money;
  pdfUrl: string | null;
}

/* ---------------------------------------------------------- notifications */
export interface NotificationDto {
  id: string;
  event: NotificationEvent;
  channel: NotificationChannel;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------- chat */
export interface ChatMessageDto {
  id: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  text: string | null;
  mediaUrl: string | null;
  location: GeoPoint | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
}

/* ---------------------------------------------------------------- support */
export interface SupportTicketDto {
  id: string;
  number: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  description: string;
  customerId: string | null;
  partnerId: string | null;
  jobId: string | null;
  assignedAgentId: string | null;
  attachmentUrls: string[];
  createdAt: string;
  updatedAt: string;
}

/* ---------------------------------------------------------------- banners */
export interface BannerCreativeDto {
  /** Localised headline rendered over the creative (optional when the image carries the text). */
  headline: LocalizedText | null;
  subheadline: LocalizedText | null;
  ctaLabel: LocalizedText | null;
  /** Full-bleed creative image (2.25:1 for hero, 3.6:1 for inline). Localised so Arabic art can differ. */
  imageUrl: LocalizedText;
  /** Theme key from ui-tokens banner.themes — controls text colour and fallback background. */
  theme: BannerTheme;
  /** Optional small badge, e.g. "خصم 20%" */
  badge: LocalizedText | null;
}

export interface BannerDto {
  id: string;
  campaignId: string;
  placement: BannerPlacement;
  creative: BannerCreativeDto;
  actionType: BannerActionType;
  actionValue: string | null; // route, url, promo code or category id
  priority: number;
  /** Tracking token the client echoes back on impression/click to attribute events. */
  trackingToken: string;
}

export interface BannerFeedDto {
  placement: BannerPlacement;
  banners: BannerDto[];
  /** Client may cache the feed until this time. */
  cacheUntil: string;
}

export interface CampaignTargetingDto {
  audiences: BannerAudience[];
  zoneIds: string[]; // empty = all
  languages: Language[]; // empty = all
  platforms: Array<'ios' | 'android'>; // empty = all
  newCustomersOnly: boolean;
  minCompletedJobs: number | null;
  maxCompletedJobs: number | null;
  serviceTypeInterest: JobType[]; // users who used these services
  /** Percentage rollout 1..100 (hash of userId). */
  rolloutPercent: number;
}

/** The two media ids behind a localised creative. */
export interface LocalizedIds {
  ar: string;
  en: string;
}

export interface CampaignDto {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  startsAt: string;
  endsAt: string | null;
  targeting: CampaignTargetingDto;
  frequencyCapPerDay: number | null;
  /**
   * Admin view of the banners. `imageMediaId` is the id the update payload expects; without
   * it an edit could only round-trip the signed `creative.imageUrl` and every save would
   * force re-uploading both language creatives. Never sent to the mobile feed.
   */
  banners: Array<BannerDto & { isActive: boolean; sortOrder: number; imageMediaId: LocalizedIds }>;
  stats: CampaignStatsDto;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface CampaignStatsDto {
  impressions: number;
  uniqueImpressions: number;
  clicks: number;
  dismissals: number;
  ctr: number; // clicks / impressions
  conversions: number; // jobs created within attribution window after click
  byPlacement: Array<{
    placement: BannerPlacement;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
  byDay: Array<{ date: string; impressions: number; clicks: number }>;
}

export interface BannerEventBatchDto {
  events: Array<{
    trackingToken: string;
    type: 'IMPRESSION' | 'CLICK' | 'DISMISS';
    occurredAt: string;
    placement: BannerPlacement;
    sessionId: string;
  }>;
}

/* ---------------------------------------------------------------- reviews */
export interface ReviewDto {
  id: string;
  jobId: string;
  raterId: string;
  rateeId: string;
  direction: ReviewDirection;
  rating: number; // 1..5
  tags: string[];
  comment: string | null;
  createdAt: string;
}

/* --------------------------------------------------------------- analytics */
export interface OpsDashboardDto {
  activeJobs: number;
  searchingJobs: number;
  completedToday: number;
  cancelledToday: number;
  onlinePartners: number;
  availablePartners: number;
  grossBookingsToday: Money;
  platformRevenueToday: Money;
  openSupportTickets: number;
  averageDispatchSeconds: number | null;
  averagePickupEtaSeconds: number | null;
  byJobType: Array<{ type: JobType; active: number; completedToday: number }>;
  generatedAt: string;
}

export interface LiveMapPartnerDto {
  partnerId: string;
  availability: AvailabilityStatus;
  roles: PartnerRoleType[];
  location: GeoPoint;
  heading: number | null;
  activeJobId: string | null;
  lastSeenAt: string;
}

export interface LiveMapJobDto {
  jobId: string;
  number: string;
  type: JobType;
  status: JobStatus;
  pickup: GeoPoint;
  destination: GeoPoint | null;
  partnerId: string | null;
  createdAt: string;
}

export interface FeatureFlagDto {
  key: string;
  description: string;
  enabled: boolean;
  rollout: { zoneIds: string[]; percent: number; userIds: string[] } | null;
  updatedAt: string;
}

export interface SystemConfigDto {
  key: string;
  value: number | string | boolean;
  type: 'number' | 'string' | 'boolean';
  description: string;
  min: number | null;
  max: number | null;
  unit: string | null;
  group: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string | null;
  ip: string | null;
  deviceSessionId: string | null;
  requestId: string | null;
  createdAt: string;
}

/* ------------------------------------------------------ operational DTOs */
/* Declared here rather than beside the services that build them, so the console and the
   apps read one definition instead of a hand-copied duplicate. */

export interface RefundDto {
  id: string;
  paymentId: string;
  jobId: string;
  disputeId: string | null;
  status: RefundStatus;
  amount: Money;
  reason: string;
  issuedById: string;
  providerRef: string | null;
  failureReason: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface DailyKpiDto {
  date: string;
  zoneId: string | null;
  jobsCreated: number;
  jobsCompleted: number;
  jobsCancelled: number;
  gmv: Money;
  platformRevenue: Money;
  avgDispatchSeconds: number | null;
  avgPickupEtaSeconds: number | null;
  activeCustomers: number;
  repeatCustomers: number;
  activePartners: number;
  partnerUtilization: number | null;
  computedAt: string;
}

export interface PartnerAvailabilityDto {
  partnerId: string;
  status: AvailabilityStatus;
  activeRoles: PartnerRoleType[];
  activeVehicleId: string | null;
  currentJobId: string | null;
  lastHeartbeatAt: string | null;
  lastLocationAt: string | null;
  lastLocation: GeoPoint | null;
  onlineSince: string | null;
  /** Interval the app should use for the next heartbeat (seconds). */
  heartbeatIntervalSeconds: number;
}

export interface HeartbeatResultDto {
  status: AvailabilityStatus;
  currentJobId: string | null;
  /** False when no location was sent; a rejected sample raises an error instead. */
  locationAccepted: boolean;
  heartbeatIntervalSeconds: number;
  serverTime: string;
}

export interface WalletIntegrityDto {
  walletId: string;
  currency: string;
  cachedBalance: Money;
  recomputedBalance: Money;
  matches: boolean;
}

export interface RiskSignalDto {
  id: string;
  userId: string;
  signal: RiskSignal;
  score: number;
  details: Record<string, unknown> | null;
  jobId: string | null;
  reviewedAt: string | null;
  reviewedById: string | null;
  createdAt: string;
}

/* ----------------------------------------------------------------- chalet */

/**
 * TAMAM Chalet describes time, so every instant below is ISO-8601 with an
 * offset and every duration is whole minutes. The API renders these from the
 * database through the global serializer, so BigInt money arrives as a number
 * and timestamps as strings.
 */

export interface ChaletSchedulingDto {
  openingTime: string; // HH:mm, chalet-local
  closingTime: string; // HH:mm
  /** The grid every start time sits on. 15 by default. */
  bookingIntervalMinutes: number;
  minimumBookingDurationMinutes: number;
  maximumBookingDurationMinutes: number;
  /** Applied after every booking unless the chalet overrides it per booking. */
  defaultCleaningDurationMinutes: number;
  holdDurationMinutes: number;
}

export interface ChaletPricingDto {
  baseHourlyRate: Money;
  /** Smart Pricing never quotes below this, whatever the demand. */
  minimumHourlyRate: Money;
  maximumHourlyRate: Money | null;
  pricingProfile: ChaletPricingProfile;
  pricingMode: ChaletPricingMode;
  maxAutoDiscountPercent: number | null;
  targetOccupancyPercent: number;
}

export interface ChaletDto {
  id: string;
  ownerId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  address: Address;
  serviceZoneId: string;
  maximumGuests: number;
  minimumGuests: number | null;
  amenities: string[];
  media: Array<{ id: string; url: string; sortOrder: number; isCover: boolean }>;
  scheduling: ChaletSchedulingDto;
  pricing: ChaletPricingDto;
  depositType: ChaletDepositType;
  deposit: Money | null;
  depositPercent: number | null;
  status: ChaletStatus;
  approvalStatus: ChaletApprovalStatus;
  instantBookingEnabled: boolean;
  smartPricingEnabled: boolean;
  gapFillerEnabled: boolean;
  lastMinutePricingEnabled: boolean;
  autoExtensionOffersEnabled: boolean;
  rating: number;
  ratingCount: number;
  createdAt: string;
}

/** What a search result needs, without the full chalet. */
export interface ChaletSummaryDto {
  id: string;
  nameAr: string;
  nameEn: string;
  city: string;
  location: GeoPoint;
  coverUrl: string | null;
  maximumGuests: number;
  /** What this chalet actually costs right now, after any active offer. */
  effectiveHourlyRate: Money;
  baseHourlyRate: Money;
  rating: number;
  ratingCount: number;
  instantBookingEnabled: boolean;
  /** Set when an offer is what makes the rate lower than the base. */
  activeOfferKind: ChaletOfferKind | null;
}

/**
 * A window the customer can actually book. The engine returns these already
 * clear of other bookings, owner blocks and cleaning buffers, so the app never
 * has to subtract anything itself.
 */
export interface ChaletAvailabilityWindowDto {
  startAt: string;
  endAt: string;
  availableMinutes: number;
  /** True when this window is short and sits between two bookings. */
  isGap: boolean;
}

export interface ChaletAvailabilityDto {
  chaletId: string;
  date: string; // YYYY-MM-DD, chalet-local
  windows: ChaletAvailabilityWindowDto[];
  /** Start times on the chalet's grid that fit the requested duration. */
  suggestedStartTimes: string[];
  bookingIntervalMinutes: number;
  cleaningDurationMinutes: number;
}

/**
 * Why a price is what it is. Every component is shown so nothing about the
 * number is mysterious to the owner or the customer — and so a confirmed
 * booking's price can be explained months later from its snapshot alone.
 */
export interface ChaletPriceBreakdownDto {
  baseHourlyRate: Money;
  /** Rate after rate rules and demand, never below minimumHourlyRate. */
  effectiveHourlyRate: Money;
  durationMinutes: number;
  subtotal: Money;
  adjustments: Array<{
    label: string;
    labelAr: string;
    /** Signed percentage applied to the base rate; -20 is a discount. */
    percent: number;
    amount: Money;
  }>;
  discount: Money;
  serviceFee: Money;
  tax: Money;
  deposit: Money;
  total: Money;
  /**
   * True when the floor stopped the price from going lower. Surfaced so an
   * owner can see that their own minimum, not the platform, set the price.
   */
  clampedToMinimum: boolean;
}

export interface ChaletBookingDto {
  id: string;
  bookingNumber: string;
  chaletId: string;
  chaletNameAr: string;
  chaletNameEn: string;
  customerId: string | null;
  startAt: string;
  endAt: string;
  /** endAt plus cleaning: what the calendar is actually occupied until. */
  blockedUntil: string;
  bookingDurationMinutes: number;
  cleaningDurationMinutes: number;
  guestCount: number;
  status: ChaletBookingStatus;
  source: ChaletBookingSource;
  /** Set only while the booking is HELD. */
  holdExpiresAt: string | null;
  price: ChaletPriceBreakdownDto;
  paymentStatus: PaymentStatus | null;
  guestName: string | null;
  guestPhone: string | null;
  cancellationReason: string | null;
  overstayMinutes: number;
  overstayFee: Money;
  createdAt: string;
  confirmedAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
}

/**
 * The answer to "can I book exactly this window?" — the check that runs before
 * the customer is shown a price. A false here is advisory: the database is
 * what finally decides, when the hold is written.
 */
export interface ChaletSlotCheckDto {
  available: boolean;
  reason: 'FREE' | 'OVERLAPS_BOOKING' | 'OVERLAPS_BLOCK' | 'OUTSIDE_HOURS' | 'DURATION_OUT_OF_BOUNDS' | 'NOT_ON_INTERVAL';
  /** The nearest windows that would work, when the requested one does not. */
  alternatives: ChaletAvailabilityWindowDto[];
  price: ChaletPriceBreakdownDto | null;
}

export interface ChaletBlockDto {
  id: string;
  chaletId: string;
  startAt: string;
  endAt: string;
  kind: ChaletBlockKind;
  reason: string | null;
  createdAt: string;
}

/**
 * A discount the platform generated for one specific empty window — the gap
 * between two bookings, or a slot that is still empty an hour before it starts.
 */
export interface ChaletOfferDto {
  id: string;
  chaletId: string;
  kind: ChaletOfferKind;
  slotStartAt: string;
  slotEndAt: string;
  discountPercent: number;
  originalHourlyRate: Money;
  offeredHourlyRate: Money;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

/**
 * What the owner's dashboard is for: whether the chalet is earning, and where
 * the empty hours are. Occupancy counts booked minutes against bookable ones,
 * so cleaning time does not flatter the number.
 */
export interface ChaletOccupancyDto {
  chaletId: string;
  fromDate: string;
  toDate: string;
  bookableMinutes: number;
  bookedMinutes: number;
  occupancyPercent: number;
  bookingCount: number;
  cancelledCount: number;
  revenue: Money;
  averageBookingDurationMinutes: number;
  averageHourlyRate: Money;
  /** 0 = Sunday. Lets the dashboard show which days sit empty. */
  byDayOfWeek: Array<{ dayOfWeek: number; bookedMinutes: number; occupancyPercent: number }>;
  /** Local hour 0-23, for the same reason. */
  byHourOfDay: Array<{ hour: number; bookedMinutes: number }>;
}

/** A Smart Pricing suggestion the owner has not accepted yet. */
export interface ChaletPricingSuggestionDto {
  chaletId: string;
  windowStartAt: string;
  windowEndAt: string;
  currentHourlyRate: Money;
  suggestedHourlyRate: Money;
  /** Plain-language reasons, not a score: "three of the last four Thursdays sat empty". */
  reasons: Array<{ code: string; en: string; ar: string }>;
  expectedOccupancyChangePercent: number;
  clampedToMinimum: boolean;
}

export interface ChaletBookingEventDto {
  id: string;
  bookingId: string;
  type: ChaletBookingEventType;
  actorId: string | null;
  fromStatus: ChaletBookingStatus | null;
  toStatus: ChaletBookingStatus | null;
  data: Record<string, unknown> | null;
  createdAt: string;
}
