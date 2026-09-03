import { DisputeStatus, ErrorCode, JobStatus, LedgerAccountType, LedgerEntryDirection } from '@tamam/shared-types';

import { AppException } from '../../../common/errors/app.exception';
import { type LedgerLine, platformAccountCode } from '../../ledger/domain/ledger.rules';

/**
 * Pure dispute rules (spec §64). No Nest, no Prisma: which jobs can be disputed, which disputes
 * can still be decided, and the balanced ledger lines a partner adjustment produces.
 */

/** A dispute in one of these states is still live — only one may exist per job. */
export const LIVE_DISPUTE_STATUSES: readonly DisputeStatus[] = [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW];

/** Decisions that close a dispute. */
export const DECIDED_DISPUTE_STATUSES: readonly DisputeStatus[] = [
  DisputeStatus.RESOLVED_CUSTOMER,
  DisputeStatus.RESOLVED_PARTNER,
  DisputeStatus.RESOLVED_SPLIT,
  DisputeStatus.REJECTED,
];

/** Customers may dispute work that is finished but not yet paid for; partners only a closed job. */
export const CUSTOMER_DISPUTABLE_JOB_STATUSES: readonly JobStatus[] = [JobStatus.COMPLETED, JobStatus.WORK_COMPLETED];
export const PARTNER_DISPUTABLE_JOB_STATUSES: readonly JobStatus[] = [JobStatus.COMPLETED];

export function assertJobDisputable(status: JobStatus, openedByCustomer: boolean): void {
  const allowed = openedByCustomer ? CUSTOMER_DISPUTABLE_JOB_STATUSES : PARTNER_DISPUTABLE_JOB_STATUSES;
  if (!allowed.includes(status)) {
    throw AppException.badRequest(ErrorCode.INVALID_STATE_TRANSITION, `A job in ${status} cannot be disputed`, { status, allowed: [...allowed] });
  }
}

export function assertDecidable(status: DisputeStatus): void {
  if (!LIVE_DISPUTE_STATUSES.includes(status)) {
    throw AppException.conflict('This dispute was already decided', ErrorCode.CONFLICT, { status });
  }
}

/**
 * Balanced lines for the partner side of a settlement.
 *
 *  - a **negative** adjustment claws money back: the partner wallet is debited and the platform
 *    refund expense credited (the platform recovers what it paid out);
 *  - a **positive** adjustment compensates the partner: the wallet is credited and the platform
 *    refund expense debited.
 */
export function partnerAdjustmentEntries(params: { adjustmentMinor: bigint; currency: string; partnerWalletId: string }): LedgerLine[] {
  const { adjustmentMinor, currency, partnerWalletId } = params;
  if (adjustmentMinor === 0n) return [];
  const amountMinor = adjustmentMinor < 0n ? -adjustmentMinor : adjustmentMinor;
  const expenseAccount = platformAccountCode(LedgerAccountType.PLATFORM_REFUND_EXPENSE, currency);
  if (adjustmentMinor < 0n) {
    return [
      { walletId: partnerWalletId, direction: LedgerEntryDirection.DEBIT, amountMinor },
      { accountCode: expenseAccount, direction: LedgerEntryDirection.CREDIT, amountMinor },
    ];
  }
  return [
    { walletId: partnerWalletId, direction: LedgerEntryDirection.CREDIT, amountMinor },
    { accountCode: expenseAccount, direction: LedgerEntryDirection.DEBIT, amountMinor },
  ];
}

/** `DP-YYMM-NNNNNN` (spec §64) — same shape as job, ticket and receipt numbers. */
export function disputeNumber(sequence: bigint, at: Date): string {
  const year = String(at.getUTCFullYear()).slice(2);
  const month = String(at.getUTCMonth() + 1).padStart(2, '0');
  return `DP-${year}${month}-${String(sequence).padStart(6, '0')}`;
}
