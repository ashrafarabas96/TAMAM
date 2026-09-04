/**
 * Response shapes of admin routes that are declared inside the API modules (not in
 * `@tamam/shared-types`). Every interface mirrors the service that produces it — see the file
 * referenced in each comment. Keep them in sync when the API changes.
 */
import type {
  AssignmentStatus,
  AvailabilityStatus,
  CommissionScope,
  DisputeStatus,
  JobDto,
  JobStatus,
  JobType,
  LedgerAccountType,
  LedgerEntryDirection,
  LedgerTransactionType,
  LiveMapPartnerDto,
  Money,
  OpsDashboardDto,
  PaymentMethod,
  PromoType,
  RefundStatus,
  RestrictionKind,
  RestrictionTargetType,
  RiskSignal,
  SupportTicketDto,
  UserDto,
  WithdrawalStatus,
} from '@tamam/shared-types';

/* These four moved into @tamam/shared-types (they were maintained twice); re-exported so
   the console's existing imports keep resolving from this module. */
export type { DailyKpiDto, RefundDto, RestrictionKind, RiskSignalDto, WalletIntegrityDto } from '@tamam/shared-types';

/* ------------------------------------------------ admin/admin-overview.service.ts */
export interface AdminOverviewDto {
  dashboard: OpsDashboardDto;
  queues: {
    openSupportTickets: number;
    openDisputes: number;
    openSosAlerts: number;
    pendingPartnerVerifications: number;
    pendingPartnerDocuments: number;
  };
  generatedAt: string;
}

/* -------------------------------------------------- admin/admin-search.service.ts */
export interface AdminSearchJobHit {
  id: string;
  number: string;
  type: JobType;
  status: JobStatus;
  customerId: string;
  partnerId: string | null;
  zoneId: string;
  createdAt: string;
}
export interface AdminSearchUserHit {
  id: string;
  fullName: string | null;
  phone: string;
  accountStatus: string;
  createdAt: string;
}
export interface AdminSearchPartnerHit extends AdminSearchUserHit {
  verificationStatus: string;
  availability: string;
}
export interface AdminSearchVehicleHit {
  id: string;
  partnerId: string;
  plate: string;
  brand: string;
  model: string;
  verificationStatus: string;
}
export interface AdminSearchPaymentHit {
  id: string;
  jobId: string;
  status: string;
  method: string;
  provider: string;
  providerRef: string | null;
  amountMinor: number;
  currency: string;
  createdAt: string;
}
export interface AdminSearchTicketHit {
  id: string;
  number: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
}
export interface AdminSearchDisputeHit {
  id: string;
  number: string;
  jobId: string;
  status: string;
  createdAt: string;
}
export interface AdminSearchResult {
  query: string;
  jobs?: AdminSearchJobHit[];
  customers?: AdminSearchUserHit[];
  partners?: AdminSearchPartnerHit[];
  vehicles?: AdminSearchVehicleHit[];
  payments?: AdminSearchPaymentHit[];
  tickets?: AdminSearchTicketHit[];
  disputes?: AdminSearchDisputeHit[];
}

/* ----------------------------------------------------- admin/dispatcher.service.ts */
export type DispatchProblem = 'UNASSIGNED' | 'NO_PARTNER_AVAILABLE' | 'ASSIGNED_NOT_MOVING' | 'ETA_EXCEEDED' | 'WAITING_CUSTOMER' | 'PARTNER_HEARTBEAT_STALE';

export interface DispatchConsoleRow {
  job: JobDto;
  problems: DispatchProblem[];
  wave: number;
  offersSent: number;
  offersRejected: number;
  offersExpired: number;
  offersPending: number;
  waitingSeconds: number;
  partner: {
    id: string;
    fullName: string | null;
    phone: string;
    availability: string;
    lastHeartbeatAt: string | null;
    heartbeatAgeSeconds: number | null;
    location: { lat: number; lng: number } | null;
  } | null;
}

export interface PartnerTimelineEntry {
  kind: 'JOB_EVENT' | 'ASSIGNMENT';
  at: string;
  jobId: string;
  jobNumber: string;
  jobType: JobType;
  type: string;
  fromStatus: JobStatus | null;
  toStatus: JobStatus | null;
  data: Record<string, unknown> | null;
}
export interface PartnerTimelineDto {
  partnerId: string;
  fullName: string | null;
  phone: string;
  availability: string;
  lastHeartbeatAt: string | null;
  currentJobId: string | null;
  from: string;
  to: string;
  entries: PartnerTimelineEntry[];
}

/* ---------------------------------------------------- admin/admin-users.service.ts */
export interface StaffUserDto {
  user: UserDto;
  email: string | null;
  mustChangePassword: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
}
export interface TemporaryPasswordResult {
  userId: string;
  email: string;
  temporaryPassword: string;
  mustChangePassword: true;
  revokedSessions: number;
}

/* ------------------------------------------------------- dispatch/dispatch.service.ts */
export type NearbyPartnerDto = LiveMapPartnerDto & { distanceMeters: number; rating: number; completedJobs: number; fullName: string | null; phone: string };

/** Raw `job_assignments` rows (Prisma include) returned by GET /admin/jobs/:id/assignments. */
export interface JobAssignmentRow {
  id: string;
  jobId: string;
  partnerId: string;
  wave: number;
  status: AssignmentStatus;
  score: number | string;
  distanceMeters: number;
  etaSeconds: number;
  estimatedEarningsMinor: number;
  isManual: boolean;
  assignedById: string | null;
  offeredAt: string;
  expiresAt: string;
  respondedAt: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
  partner: { user: { fullName: string | null; phone: string } } | null;
}

/* ------------------------------------------------------- jobs/job-safety.service.ts */
export interface SosAlertRow {
  id: string;
  jobId: string;
  userId: string;
  lat: number | string;
  lng: number | string;
  note: string | null;
  acknowledgedById: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  job: { number: string; type: JobType; status: JobStatus; zoneId: string; customerId: string; partnerId: string | null };
  user: { fullName: string | null; phone: string };
}

/* ---------------------------------------------------------- zones/zones.service.ts */
export interface ZoneServiceRuleRow {
  id: string;
  zoneId: string;
  serviceTypeId: string | null;
  categoryId: string | null;
  vehicleTypeId: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  hours: Array<{ id: string; dayOfWeek: number; opensAt: string; closesAt: string; isClosed: boolean }>;
  serviceType: { code: string } | null;
  category: { slug: string; nameAr: string; nameEn: string } | null;
  vehicleType: { code: string } | null;
}

/* ------------------------------------------------------ pricing/pricing.service.ts */
export interface PricingRuleRow {
  id: string;
  jobType: JobType;
  zoneId: string | null;
  vehicleTypeId: string | null;
  categoryId: string | null;
  currency: string;
  name: string;
  priority: number;
  rule: Record<string, unknown>;
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  zone: { nameAr: string; nameEn: string } | null;
  vehicleType: { code: string } | null;
  category: { slug: string } | null;
}
export interface SurgeOverrideRow {
  id: string;
  zoneId: string;
  jobType: JobType;
  multiplier: number | string;
  startsAt: string;
  endsAt: string;
  reason: string;
  createdById: string | null;
  createdAt: string;
}
export interface CancellationPolicyRow {
  id: string;
  jobType: JobType | null;
  zoneId: string | null;
  currency: string;
  gracePeriodSeconds: number;
  feeBeforeArrivalMinor: number;
  feeAfterArrivalMinor: number;
  feeAfterStartMinor: number;
  partnerFeeOnCancelMinor: number;
  partnerPenaltyPoints: number;
  customerNoShowFeeMinor: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------- promotions/promotions.service.ts */
export interface PromoCodeDto {
  id: string;
  code: string;
  description: string | null;
  type: PromoType;
  value: number;
  maxDiscount: Money | null;
  minOrder: Money;
  currency: string;
  startsAt: string;
  endsAt: string | null;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number;
  firstOrderOnly: boolean;
  jobTypes: JobType[];
  paymentMethods: PaymentMethod[];
  categoryIds: string[];
  zoneIds: string[];
  userIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface PromoStatsDto {
  promoCodeId: string;
  code: string;
  usageCount: number;
  usageLimit: number | null;
  redemptions: number;
  releasedRedemptions: number;
  uniqueCustomers: number;
  totalDiscount: Money;
}
export interface ReferralProgramDto {
  id: string;
  inviterReward: Money;
  inviteeReward: Money;
  currency: string;
  rewardOn: string;
  minFirstJob: Money;
  maxRewardsPerInviter: number;
  codeExpiryDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ReferralRewardDto {
  id: string;
  programId: string;
  inviterId: string;
  inviteeId: string;
  triggerJobId: string | null;
  status: string;
  inviterReward: Money;
  inviteeReward: Money;
  currency: string;
  fraudFlags: string[];
  grantedAt: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------ ledger/*.service.ts */
export interface LedgerAccountDto {
  id: string;
  type: LedgerAccountType;
  code: string;
  currency: string;
  walletId: string | null;
  balance: Money;
  createdAt: string;
}
export interface LedgerTransactionDto {
  id: string;
  type: LedgerTransactionType;
  currency: string;
  jobId: string | null;
  paymentId: string | null;
  refundId: string | null;
  withdrawalId: string | null;
  disputeId: string | null;
  reference: string | null;
  description: string;
  reason: string | null;
  actorId: string | null;
  createdAt: string;
  entries: Array<{ id: string; accountId: string; accountCode: string; direction: LedgerEntryDirection; amount: Money; balanceAfter: Money }>;
}
export interface CommissionPolicyDto {
  id: string;
  scope: CommissionScope;
  jobType: JobType | null;
  categoryId: string | null;
  zoneId: string | null;
  partnerId: string | null;
  campaignCode: string | null;
  percent: number;
  fixedMinor: number | string;
  priority: number;
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
}

/* --------------------------------------------------------- payments/payments.service.ts */

/* ------------------------------------------------------------- wallet/wallet.service.ts */
export interface WithdrawalDto {
  id: string;
  partnerId: string;
  bankAccountId: string;
  bankName: string;
  ibanLast4: string;
  status: WithdrawalStatus;
  amount: Money;
  fee: Money;
  decisionReason: string | null;
  providerReference: string | null;
  decidedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

/* ----------------------------------------------------------- disputes/disputes.service.ts */
export interface DisputeDto {
  id: string;
  number: string;
  jobId: string;
  customerId: string;
  partnerId: string;
  openedByRole: string;
  status: DisputeStatus;
  reason: string;
  description: string;
  requestedRefund: Money | null;
  refund: Money;
  partnerAdjustment: Money;
  decidedById: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  evidenceUrls: string[];
  createdAt: string;
  updatedAt: string;
}
export interface DisputeMessageDto {
  id: string;
  disputeId: string;
  authorId: string;
  authorName: string | null;
  text: string;
  internal: boolean;
  createdAt: string;
}
export interface DisputeDetailDto extends DisputeDto {
  messages: DisputeMessageDto[];
}

/* ------------------------------------------------------------ support/support.service.ts */
export interface SupportMessageDto {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string | null;
  authorRole: 'USER' | 'AGENT';
  text: string;
  internal: boolean;
  attachmentUrls: string[];
  createdAt: string;
}
export interface SupportTicketDetailDto extends SupportTicketDto {
  messages: SupportMessageDto[];
}
export interface UserReportDto {
  id: string;
  jobId: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  description: string | null;
  status: string;
  ticketId: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ risk/risk.service.ts */
export interface RestrictionDto {
  id: string;
  targetType: RestrictionTargetType;
  targetId: string;
  kind: RestrictionKind;
  reason: string;
  createdById: string;
  expiresAt: string | null;
  liftedAt: string | null;
  liftedById: string | null;
  liftReason: string | null;
  isActive: boolean;
  createdAt: string;
}

/* -------------------------------------------------------- notifications (raw Prisma rows) */
export interface NotificationTemplateRow {
  id: string;
  event: string;
  channel: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  isActive: boolean;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ----------------------------------------------------------------- rbac/rbac.service.ts */
export interface RoleDto {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
  updatedAt: string;
}
export interface PermissionCatalogEntry {
  key: string;
  sensitive: boolean;
}

/* ------------------------------------------------------------ analytics/analytics.service.ts */
export interface ReportRow {
  key: string;
  jobs: number;
  completed: number;
  cancelled: number;
  gmv: Money;
  revenue: Money;
  avgFare: Money;
}
export interface ReportResult {
  groupBy: string;
  from: string;
  to: string;
  currency: string;
  rows: ReportRow[];
}

/* ------------------------------------------------------------------ media/media.service.ts */
export interface UploadIntentResponse {
  mediaId: string;
  upload: { uploadUrl: string; headers: Record<string, string>; expiresInSeconds: number };
}
export interface MediaAssetDto {
  id: string;
  kind: string;
  purpose: string;
  status: string;
  url: string;
  mediumUrl: string | null;
  thumbnailUrl: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

/* ------------------------------------------------------------- admin gateway (socket) */
export interface AdminMapUpdate {
  kind: 'LOCATION' | 'JOB_STATUS' | 'SOS' | 'OFFER';
  zoneId: string | null;
  jobId: string | null;
  partnerId: string | null;
  at: string;
  payload: Record<string, unknown>;
}

/* ----------------------------------------------------------- maintenance/queues */
export interface QueueCountsDto {
  queue: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  paused: boolean;
}

export type PartnerAvailability = AvailabilityStatus;
