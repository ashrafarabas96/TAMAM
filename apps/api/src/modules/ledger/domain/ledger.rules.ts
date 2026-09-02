import { ErrorCode, LedgerAccountType, LedgerEntryDirection, LedgerTransactionType, PaymentMethod } from '@tamam/shared-types';

import { AppException } from '../../../common/errors/app.exception';

/**
 * Pure double-entry rules (spec §56). No Nest, no Prisma — every function here is
 * deterministic so the accounting can be unit-tested without a database.
 *
 * Conventions
 *  - amounts are positive `bigint` minor units; the sign lives in `direction`
 *  - platform accounts are addressed by code `<TYPE>:<CURRENCY>` (e.g. `PLATFORM_REVENUE:ILS`)
 *  - wallets are addressed by `walletId` (the service resolves it to `WALLET:<walletId>`)
 */
export interface LedgerLine {
  /** Platform account code, e.g. `PLATFORM_REVENUE:ILS`. Mutually exclusive with `walletId`. */
  accountCode?: string;
  /** Wallet id — resolved to the `WALLET:<walletId>` account. */
  walletId?: string;
  direction: LedgerEntryDirection;
  amountMinor: bigint;
}

export const platformAccountCode = (type: LedgerAccountType, currency: string): string => `${type}:${currency}`;

export const walletAccountCode = (walletId: string): string => `WALLET:${walletId}`;

const debit = (accountCode: string, amountMinor: bigint): LedgerLine => ({ accountCode, direction: LedgerEntryDirection.DEBIT, amountMinor });
const credit = (accountCode: string, amountMinor: bigint): LedgerLine => ({ accountCode, direction: LedgerEntryDirection.CREDIT, amountMinor });

/** Sum of debits must equal the sum of credits, every amount strictly positive (DB trigger enforces the same). */
export function assertBalanced(entries: readonly LedgerLine[]): void {
  if (entries.length < 2) {
    throw AppException.validation([{ field: 'entries', message: 'a ledger transaction needs at least two entries' }], 'Unbalanced ledger transaction');
  }
  let debits = 0n;
  let credits = 0n;
  entries.forEach((entry, index) => {
    if (entry.amountMinor <= 0n) {
      throw AppException.validation([{ field: `entries.${index}.amountMinor`, message: 'entry amount must be positive' }], 'Invalid ledger entry');
    }
    if (!entry.accountCode && !entry.walletId) {
      throw AppException.validation([{ field: `entries.${index}`, message: 'entry needs accountCode or walletId' }], 'Invalid ledger entry');
    }
    if (entry.accountCode && entry.walletId) {
      throw AppException.validation([{ field: `entries.${index}`, message: 'entry accepts either accountCode or walletId, not both' }], 'Invalid ledger entry');
    }
    if (entry.direction === LedgerEntryDirection.DEBIT) debits += entry.amountMinor;
    else credits += entry.amountMinor;
  });
  if (debits !== credits) {
    throw AppException.validation(
      [{ field: 'entries', message: `debits (${debits}) must equal credits (${credits})` }],
      'Unbalanced ledger transaction',
    );
  }
}

export interface SettlementInput {
  /** What the customer is charged — the fare after the promo discount (jobs.final_total_minor). */
  jobTotalMinor: bigint;
  /** Platform commission, computed on the gross fare (fare before the discount). */
  commissionMinor: bigint;
  paymentMethod: PaymentMethod;
  /** Discount the platform funds so the partner still earns the full fare. */
  promoDiscountMinor: bigint;
  /** Cancellation fee charged to the customer (0 for a completed job). */
  cancellationFeeMinor: bigint;
  /** Share of the cancellation fee paid to the partner (cancellation policy). */
  partnerFeeOnCancelMinor?: bigint;
  currency: string;
  /** Required for WALLET settlements and for cancellation fees on CASH/WALLET jobs. */
  customerWalletAccountCode?: string;
  partnerWalletAccountCode: string;
}

export interface SettlementPlan {
  type: LedgerTransactionType;
  entries: LedgerLine[];
  /** Fare before the promo discount — what the partner earns against. */
  grossFareMinor: bigint;
  /** Commission actually applied (clamped to the gross fare). */
  commissionMinor: bigint;
  /** Gross fare minus commission — the partner's earning for this job. */
  partnerNetMinor: bigint;
  /** Share of the cancellation fee credited to the partner. */
  partnerCancellationCompensationMinor: bigint;
}

const clamp = (value: bigint, min: bigint, max: bigint): bigint => (value < min ? min : value > max ? max : value);

function requireNonNegative(field: string, value: bigint): void {
  if (value < 0n) throw AppException.validation([{ field, message: 'amount cannot be negative' }], 'Invalid settlement input');
}

/**
 * Builds the balanced settlement lines for one job (spec §56, docs/DATABASE.md §2.7).
 *
 *  - **CASH** — the partner collected the money: cash clearing is debited against the partner
 *    wallet and immediately offset by the cash the partner keeps, so the wallet nets
 *    `promoDiscount − commission` (i.e. exactly `−commission` for an undiscounted job).
 *  - **WALLET** — the customer wallet is debited, the partner wallet credited net of commission.
 *  - **CARD / EXTERNAL_GATEWAY / BANK** — the gateway clearing account is debited instead.
 *  - **Promo discount** — `PLATFORM_PROMO_EXPENSE` is debited so the partner keeps the full fare.
 *  - **Cancellation fee** — charged to the customer (wallet for CASH/WALLET jobs, gateway clearing
 *    otherwise); the partner is compensated by the configured amount, the remainder is revenue.
 */
export function settlementEntries(input: SettlementInput): SettlementPlan {
  requireNonNegative('jobTotalMinor', input.jobTotalMinor);
  requireNonNegative('commissionMinor', input.commissionMinor);
  requireNonNegative('promoDiscountMinor', input.promoDiscountMinor);
  requireNonNegative('cancellationFeeMinor', input.cancellationFeeMinor);
  requireNonNegative('partnerFeeOnCancelMinor', input.partnerFeeOnCancelMinor ?? 0n);

  const { currency, partnerWalletAccountCode } = input;
  const revenue = platformAccountCode(LedgerAccountType.PLATFORM_REVENUE, currency);
  const cashClearing = platformAccountCode(LedgerAccountType.PLATFORM_CASH_CLEARING, currency);
  const gatewayClearing = platformAccountCode(LedgerAccountType.PLATFORM_GATEWAY_CLEARING, currency);
  const promoExpense = platformAccountCode(LedgerAccountType.PLATFORM_PROMO_EXPENSE, currency);

  const grossFareMinor = input.jobTotalMinor + input.promoDiscountMinor;
  const commissionMinor = clamp(input.commissionMinor, 0n, grossFareMinor);
  const partnerNetMinor = grossFareMinor - commissionMinor;
  const isCash = input.paymentMethod === PaymentMethod.CASH;
  const isWallet = input.paymentMethod === PaymentMethod.WALLET;

  const entries: LedgerLine[] = [];

  if (grossFareMinor > 0n) {
    if (isCash) {
      if (input.jobTotalMinor > 0n) {
        // Customer handed cash to the partner: recognise the charge, then offset it with the cash held.
        entries.push(debit(cashClearing, input.jobTotalMinor), credit(partnerWalletAccountCode, input.jobTotalMinor));
      }
      if (input.promoDiscountMinor > 0n) {
        entries.push(debit(promoExpense, input.promoDiscountMinor), credit(partnerWalletAccountCode, input.promoDiscountMinor));
      }
      if (commissionMinor > 0n) {
        entries.push(debit(partnerWalletAccountCode, commissionMinor), credit(revenue, commissionMinor));
      }
      if (input.jobTotalMinor > 0n) {
        entries.push(debit(partnerWalletAccountCode, input.jobTotalMinor), credit(cashClearing, input.jobTotalMinor));
      }
    } else {
      if (input.jobTotalMinor > 0n) {
        if (isWallet) {
          if (!input.customerWalletAccountCode) {
            throw AppException.validation([{ field: 'customerWalletAccountCode', message: 'wallet settlements need the customer wallet account' }], 'Invalid settlement input');
          }
          entries.push(debit(input.customerWalletAccountCode, input.jobTotalMinor));
        } else {
          entries.push(debit(gatewayClearing, input.jobTotalMinor));
        }
      }
      if (input.promoDiscountMinor > 0n) entries.push(debit(promoExpense, input.promoDiscountMinor));
      if (partnerNetMinor > 0n) entries.push(credit(partnerWalletAccountCode, partnerNetMinor));
      if (commissionMinor > 0n) entries.push(credit(revenue, commissionMinor));
    }
  }

  const partnerCancellationCompensationMinor = clamp(input.partnerFeeOnCancelMinor ?? 0n, 0n, input.cancellationFeeMinor);
  if (input.cancellationFeeMinor > 0n) {
    let chargeAccount: string;
    if (isCash || isWallet) {
      if (!input.customerWalletAccountCode) {
        throw AppException.validation([{ field: 'customerWalletAccountCode', message: 'cancellation fees on cash/wallet jobs are charged to the customer wallet' }], 'Invalid settlement input');
      }
      chargeAccount = input.customerWalletAccountCode;
    } else {
      chargeAccount = gatewayClearing;
    }
    entries.push(debit(chargeAccount, input.cancellationFeeMinor));
    if (partnerCancellationCompensationMinor > 0n) entries.push(credit(partnerWalletAccountCode, partnerCancellationCompensationMinor));
    const platformShare = input.cancellationFeeMinor - partnerCancellationCompensationMinor;
    if (platformShare > 0n) entries.push(credit(revenue, platformShare));
  }

  if (entries.length) assertBalanced(entries);

  return {
    type: grossFareMinor > 0n ? LedgerTransactionType.JOB_CHARGE : LedgerTransactionType.CANCELLATION_FEE,
    entries,
    grossFareMinor,
    commissionMinor,
    partnerNetMinor,
    partnerCancellationCompensationMinor,
  };
}

/** Balanced lines for a refund: the platform expense account funds the customer wallet credit. */
export function refundEntries(params: { amountMinor: bigint; currency: string; customerWalletAccountCode: string }): LedgerLine[] {
  requireNonNegative('amountMinor', params.amountMinor);
  const entries: LedgerLine[] = [
    debit(platformAccountCode(LedgerAccountType.PLATFORM_REFUND_EXPENSE, params.currency), params.amountMinor),
    credit(params.customerWalletAccountCode, params.amountMinor),
  ];
  assertBalanced(entries);
  return entries;
}

/** Guard used by callers that hand in an already-built entry list. */
export function assertSupportedCurrency(currency: string): void {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, `currency must be a 3-letter ISO code (got ${currency})`);
  }
}
