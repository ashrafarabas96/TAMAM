import type {
  AccountStatus,
  AssignmentStatus,
  AvailabilityStatus,
  BannerActionType,
  BannerAudience,
  BannerPlacement,
  CampaignStatus,
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
  PartnerRoleType,
  PaymentMethod,
  PaymentStatus,
  PricingMethod,
  QuoteKind,
  QuoteStatus,
  SchedulingMode,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  UserRole,
  VerificationStatus,
} from './enums';
import type { Address, GeoPoint, LocalizedText, Money } from './api';

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
  platform: 'ios' | 'android' | 'web' | 'unknown';
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
  kind: 'HOME' | 'WORK' | 'CUSTOM';
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
  requiredMedia: { images: boolean; video: boolean; audio: boolean; minImages: number; maxImages: number };
  allowsInstant: boolean;
  allowsScheduled: boolean;
  urgencyLevels: JobUrgency[];
  inspectionFee: Money | null;
  startingFrom: Money | null;
  hourlyRate: Money | null;
  fixedPrice: Money | null;
  workflowConfig: { skipInspection: boolean; requiresQuote: boolean; requiresCustomerConfirmation: boolean; autoConfirmHours: number };
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
  approximateSize: 'SMALL' | 'MEDIUM' | 'LARGE' | 'XL';
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
  vehicle: { brand: string; model: string; color: string; plate: string; typeName: LocalizedText } | null;
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
  kind: 'LABOR' | 'PARTS' | 'FEE';
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
  theme: string;
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

export interface CampaignDto {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  startsAt: string;
  endsAt: string | null;
  targeting: CampaignTargetingDto;
  frequencyCapPerDay: number | null;
  banners: Array<BannerDto & { isActive: boolean; sortOrder: number }>;
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
  byPlacement: Array<{ placement: BannerPlacement; impressions: number; clicks: number; ctr: number }>;
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
  direction: 'CUSTOMER_TO_PARTNER' | 'PARTNER_TO_CUSTOMER';
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
