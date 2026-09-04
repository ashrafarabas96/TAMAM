'use client';

import { type EnumGroup, useI18n } from '@/i18n';

import { Badge, type BadgeTone } from './badge';

/** Tone per enum value — keeps the semantic colour of a status identical across every screen. */
const TONES: Partial<Record<EnumGroup, Record<string, BadgeTone>>> = {
  jobStatus: {
    DRAFT: 'neutral',
    REQUESTED: 'info',
    SEARCHING: 'warning',
    ASSIGNED: 'brand',
    PARTNER_EN_ROUTE: 'brand',
    PARTNER_ARRIVED: 'brand',
    WAITING_CUSTOMER: 'warning',
    IN_PROGRESS: 'info',
    INSPECTION_STARTED: 'info',
    QUOTE_REQUIRED: 'warning',
    QUOTE_SUBMITTED: 'warning',
    QUOTE_APPROVED: 'brand',
    QUOTE_REJECTED: 'danger',
    WORK_STARTED: 'info',
    WAITING_FOR_PARTS: 'warning',
    WORK_COMPLETED: 'success',
    CUSTOMER_CONFIRMED: 'success',
    COMPLETED: 'success',
    CANCELLED: 'danger',
    NO_PARTNER_AVAILABLE: 'danger',
    DISPUTED: 'danger',
  },
  jobType: { RIDE: 'brand', DELIVERY: 'warning', HOME_SERVICE: 'info' },
  accountStatus: { ACTIVE: 'success', RESTRICTED: 'warning', SUSPENDED: 'danger', DELETED: 'dark' },
  verificationStatus: {
    DRAFT: 'neutral',
    PENDING: 'warning',
    UNDER_REVIEW: 'info',
    APPROVED: 'success',
    REJECTED: 'danger',
    SUSPENDED: 'danger',
  },
  availability: { ONLINE: 'success', OFFLINE: 'neutral', BUSY: 'warning' },
  documentStatus: { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', EXPIRED: 'dark' },
  paymentStatus: {
    PENDING: 'warning',
    AUTHORIZED: 'info',
    CAPTURED: 'success',
    FAILED: 'danger',
    CANCELLED: 'neutral',
    REFUNDED: 'dark',
    PARTIALLY_REFUNDED: 'warning',
  },
  paymentMethod: {
    CASH: 'accent',
    WALLET: 'brand',
    CARD: 'info',
    BANK: 'neutral',
    EXTERNAL_GATEWAY: 'info',
  },
  refundStatus: { PENDING: 'warning', PROCESSED: 'success', FAILED: 'danger', REJECTED: 'neutral' },
  withdrawalStatus: { REQUESTED: 'warning', APPROVED: 'info', PAID: 'success', REJECTED: 'danger' },
  campaignStatus: {
    DRAFT: 'neutral',
    SCHEDULED: 'info',
    ACTIVE: 'success',
    PAUSED: 'warning',
    ENDED: 'dark',
    ARCHIVED: 'neutral',
  },
  ticketStatus: {
    OPEN: 'warning',
    IN_PROGRESS: 'info',
    WAITING_USER: 'brand',
    RESOLVED: 'success',
    CLOSED: 'neutral',
  },
  ticketPriority: { LOW: 'neutral', NORMAL: 'info', HIGH: 'warning', CRITICAL: 'danger' },
  disputeStatus: {
    OPEN: 'warning',
    UNDER_REVIEW: 'info',
    RESOLVED_CUSTOMER: 'success',
    RESOLVED_PARTNER: 'success',
    RESOLVED_SPLIT: 'success',
    REJECTED: 'danger',
  },
  assignmentStatus: {
    OFFERED: 'info',
    ACCEPTED: 'success',
    REJECTED: 'danger',
    EXPIRED: 'neutral',
    CANCELLED: 'neutral',
    REASSIGNED: 'warning',
  },
  dispatchProblem: {
    UNASSIGNED: 'warning',
    NO_PARTNER_AVAILABLE: 'danger',
    ASSIGNED_NOT_MOVING: 'warning',
    ETA_EXCEEDED: 'danger',
    WAITING_CUSTOMER: 'info',
    PARTNER_HEARTBEAT_STALE: 'danger',
  },
  urgency: { STANDARD: 'neutral', URGENT: 'warning', EMERGENCY: 'danger' },
  riskSignal: {
    EXCESSIVE_CANCELLATIONS: 'warning',
    PROMO_ABUSE: 'danger',
    MULTIPLE_ACCOUNTS: 'danger',
    IMPOSSIBLE_GPS_MOVEMENT: 'danger',
    REPEATED_FAILED_PAYMENTS: 'warning',
    UNUSUAL_REFERRAL_BEHAVIOUR: 'warning',
  },
  ledgerDirection: { DEBIT: 'danger', CREDIT: 'success' },
  userRole: {
    SUPER_ADMIN: 'dark',
    ADMIN: 'brand',
    OPERATIONS_MANAGER: 'info',
    DISPATCHER: 'warning',
    SUPPORT: 'success',
    FINANCE: 'accent',
    MARKETING: 'brand',
    ANALYST: 'neutral',
    CUSTOMER: 'neutral',
    PARTNER: 'neutral',
  },
  partnerRole: {
    DRIVER: 'brand',
    COURIER: 'warning',
    TECHNICIAN: 'info',
    SERVICE_PROVIDER: 'success',
  },
};

export function StatusPill({
  group,
  value,
  className,
}: {
  group: EnumGroup;
  value: string | null | undefined;
  className?: string;
}) {
  const { enumLabel } = useI18n();
  if (!value) return <span className="text-text-tertiary">—</span>;
  const tone = TONES[group]?.[value] ?? 'neutral';
  return (
    <Badge tone={tone} className={className}>
      {enumLabel(group, value)}
    </Badge>
  );
}

export function BooleanPill({
  value,
  trueLabel,
  falseLabel,
}: {
  value: boolean;
  trueLabel: string;
  falseLabel: string;
}) {
  return <Badge tone={value ? 'success' : 'neutral'}>{value ? trueLabel : falseLabel}</Badge>;
}
