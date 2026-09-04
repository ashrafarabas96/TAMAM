import {
  ErrorCode,
  LedgerAccountType,
  LedgerEntryDirection,
  LedgerTransactionType,
  PaymentMethod,
} from '@tamam/shared-types';

import {
  type LedgerLine,
  assertBalanced,
  platformAccountCode,
  refundEntries,
  settlementEntries,
  walletAccountCode,
} from './ledger.rules';

const CURRENCY = 'ILS';
const PARTNER_WALLET = walletAccountCode('11111111-1111-4111-8111-111111111111');
const CUSTOMER_WALLET = walletAccountCode('22222222-2222-4222-8222-222222222222');
const REVENUE = platformAccountCode(LedgerAccountType.PLATFORM_REVENUE, CURRENCY);
const CASH_CLEARING = platformAccountCode(LedgerAccountType.PLATFORM_CASH_CLEARING, CURRENCY);
const GATEWAY_CLEARING = platformAccountCode(LedgerAccountType.PLATFORM_GATEWAY_CLEARING, CURRENCY);
const PROMO_EXPENSE = platformAccountCode(LedgerAccountType.PLATFORM_PROMO_EXPENSE, CURRENCY);

/** Signed net movement of one account across the entry list (credit positive, debit negative). */
function net(entries: readonly LedgerLine[], accountCode: string): bigint {
  return entries.reduce((sum, e) => {
    if (e.accountCode !== accountCode) return sum;
    return e.direction === LedgerEntryDirection.CREDIT ? sum + e.amountMinor : sum - e.amountMinor;
  }, 0n);
}

function totals(entries: readonly LedgerLine[]): { debits: bigint; credits: bigint } {
  return entries.reduce(
    (acc, e) =>
      e.direction === LedgerEntryDirection.DEBIT
        ? { ...acc, debits: acc.debits + e.amountMinor }
        : { ...acc, credits: acc.credits + e.amountMinor },
    { debits: 0n, credits: 0n },
  );
}

const base = {
  currency: CURRENCY,
  partnerWalletAccountCode: PARTNER_WALLET,
  customerWalletAccountCode: CUSTOMER_WALLET,
  promoDiscountMinor: 0n,
  cancellationFeeMinor: 0n,
};

describe('assertBalanced', () => {
  it('accepts a balanced pair', () => {
    expect(() =>
      assertBalanced([
        { accountCode: REVENUE, direction: LedgerEntryDirection.CREDIT, amountMinor: 500n },
        { accountCode: CASH_CLEARING, direction: LedgerEntryDirection.DEBIT, amountMinor: 500n },
      ]),
    ).not.toThrow();
  });

  it('rejects an unbalanced set', () => {
    expect(() =>
      assertBalanced([
        { accountCode: REVENUE, direction: LedgerEntryDirection.CREDIT, amountMinor: 500n },
        { accountCode: CASH_CLEARING, direction: LedgerEntryDirection.DEBIT, amountMinor: 400n },
      ]),
    ).toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_FAILED }));
  });

  it('rejects a zero or negative amount', () => {
    expect(() =>
      assertBalanced([
        { accountCode: REVENUE, direction: LedgerEntryDirection.CREDIT, amountMinor: 0n },
        { accountCode: CASH_CLEARING, direction: LedgerEntryDirection.DEBIT, amountMinor: 0n },
      ]),
    ).toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_FAILED }));
  });

  it('rejects a single-sided transaction', () => {
    expect(() =>
      assertBalanced([
        { accountCode: REVENUE, direction: LedgerEntryDirection.CREDIT, amountMinor: 100n },
      ]),
    ).toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_FAILED }));
  });

  it('rejects an entry addressing both an account code and a wallet', () => {
    expect(() =>
      assertBalanced([
        {
          accountCode: REVENUE,
          walletId: 'w1',
          direction: LedgerEntryDirection.CREDIT,
          amountMinor: 100n,
        },
        { accountCode: CASH_CLEARING, direction: LedgerEntryDirection.DEBIT, amountMinor: 100n },
      ]),
    ).toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_FAILED }));
  });
});

describe('settlementEntries — cash', () => {
  it('nets the partner wallet at minus the commission (docs/DATABASE.md §2.7)', () => {
    const plan = settlementEntries({
      ...base,
      jobTotalMinor: 10_000n,
      commissionMinor: 1_500n,
      paymentMethod: PaymentMethod.CASH,
    });

    const { debits, credits } = totals(plan.entries);
    expect(debits).toBe(credits);
    expect(plan.type).toBe(LedgerTransactionType.JOB_CHARGE);
    expect(net(plan.entries, PARTNER_WALLET)).toBe(-1_500n);
    expect(net(plan.entries, REVENUE)).toBe(1_500n);
    expect(net(plan.entries, CASH_CLEARING)).toBe(0n);
    expect(plan.partnerNetMinor).toBe(8_500n);
  });

  it('funds a promo discount from the promo expense account so the partner keeps the full fare', () => {
    const plan = settlementEntries({
      ...base,
      jobTotalMinor: 9_000n,
      promoDiscountMinor: 1_000n,
      commissionMinor: 1_500n,
      paymentMethod: PaymentMethod.CASH,
    });

    const { debits, credits } = totals(plan.entries);
    expect(debits).toBe(credits);
    expect(plan.grossFareMinor).toBe(10_000n);
    expect(net(plan.entries, PROMO_EXPENSE)).toBe(-1_000n); // expense accounts carry a debit balance
    // partner earned 8 500 but holds 9 000 in cash → owes the platform 500
    expect(net(plan.entries, PARTNER_WALLET)).toBe(-500n);
    expect(net(plan.entries, REVENUE)).toBe(1_500n);
  });

  it('settles a fully discounted cash job with no cash movement', () => {
    const plan = settlementEntries({
      ...base,
      jobTotalMinor: 0n,
      promoDiscountMinor: 10_000n,
      commissionMinor: 1_500n,
      paymentMethod: PaymentMethod.CASH,
    });

    const { debits, credits } = totals(plan.entries);
    expect(debits).toBe(credits);
    expect(net(plan.entries, CASH_CLEARING)).toBe(0n);
    expect(net(plan.entries, PARTNER_WALLET)).toBe(8_500n);
    expect(net(plan.entries, REVENUE)).toBe(1_500n);
  });
});

describe('settlementEntries — wallet', () => {
  it('debits the customer wallet and credits the partner net of commission', () => {
    const plan = settlementEntries({
      ...base,
      jobTotalMinor: 10_000n,
      commissionMinor: 1_500n,
      paymentMethod: PaymentMethod.WALLET,
    });

    const { debits, credits } = totals(plan.entries);
    expect(debits).toBe(credits);
    expect(net(plan.entries, CUSTOMER_WALLET)).toBe(-10_000n);
    expect(net(plan.entries, PARTNER_WALLET)).toBe(8_500n);
    expect(net(plan.entries, REVENUE)).toBe(1_500n);
  });

  it('balances a discounted wallet job', () => {
    const plan = settlementEntries({
      ...base,
      jobTotalMinor: 8_000n,
      promoDiscountMinor: 2_000n,
      commissionMinor: 1_500n,
      paymentMethod: PaymentMethod.WALLET,
    });

    const { debits, credits } = totals(plan.entries);
    expect(debits).toBe(credits);
    expect(net(plan.entries, CUSTOMER_WALLET)).toBe(-8_000n);
    expect(net(plan.entries, PROMO_EXPENSE)).toBe(-2_000n);
    expect(net(plan.entries, PARTNER_WALLET)).toBe(8_500n);
  });

  it('refuses a wallet settlement without the customer wallet account', () => {
    expect(() =>
      settlementEntries({
        currency: CURRENCY,
        partnerWalletAccountCode: PARTNER_WALLET,
        promoDiscountMinor: 0n,
        cancellationFeeMinor: 0n,
        jobTotalMinor: 10_000n,
        commissionMinor: 1_000n,
        paymentMethod: PaymentMethod.WALLET,
      }),
    ).toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_FAILED }));
  });
});

describe('settlementEntries — gateway', () => {
  it('debits gateway clearing for card payments', () => {
    const plan = settlementEntries({
      ...base,
      jobTotalMinor: 10_000n,
      commissionMinor: 2_000n,
      paymentMethod: PaymentMethod.CARD,
    });

    const { debits, credits } = totals(plan.entries);
    expect(debits).toBe(credits);
    expect(net(plan.entries, GATEWAY_CLEARING)).toBe(-10_000n);
    expect(net(plan.entries, PARTNER_WALLET)).toBe(8_000n);
    expect(net(plan.entries, REVENUE)).toBe(2_000n);
  });

  it('treats EXTERNAL_GATEWAY and BANK like card', () => {
    for (const method of [PaymentMethod.EXTERNAL_GATEWAY, PaymentMethod.BANK]) {
      const plan = settlementEntries({
        ...base,
        jobTotalMinor: 5_000n,
        commissionMinor: 750n,
        paymentMethod: method,
      });
      const { debits, credits } = totals(plan.entries);
      expect(debits).toBe(credits);
      expect(net(plan.entries, GATEWAY_CLEARING)).toBe(-5_000n);
      expect(net(plan.entries, PARTNER_WALLET)).toBe(4_250n);
    }
  });

  it('clamps a commission larger than the fare', () => {
    const plan = settlementEntries({
      ...base,
      jobTotalMinor: 1_000n,
      commissionMinor: 5_000n,
      paymentMethod: PaymentMethod.CARD,
    });

    const { debits, credits } = totals(plan.entries);
    expect(debits).toBe(credits);
    expect(plan.commissionMinor).toBe(1_000n);
    expect(plan.partnerNetMinor).toBe(0n);
    expect(net(plan.entries, PARTNER_WALLET)).toBe(0n);
  });
});

describe('settlementEntries — cancellation fee', () => {
  it('charges the customer wallet and compensates the partner', () => {
    const plan = settlementEntries({
      ...base,
      jobTotalMinor: 0n,
      commissionMinor: 0n,
      cancellationFeeMinor: 1_000n,
      partnerFeeOnCancelMinor: 600n,
      paymentMethod: PaymentMethod.CASH,
    });

    const { debits, credits } = totals(plan.entries);
    expect(debits).toBe(credits);
    expect(plan.type).toBe(LedgerTransactionType.CANCELLATION_FEE);
    expect(net(plan.entries, CUSTOMER_WALLET)).toBe(-1_000n);
    expect(net(plan.entries, PARTNER_WALLET)).toBe(600n);
    expect(net(plan.entries, REVENUE)).toBe(400n);
  });

  it('charges gateway clearing for card jobs and keeps the whole fee as revenue when the partner gets nothing', () => {
    const plan = settlementEntries({
      ...base,
      jobTotalMinor: 0n,
      commissionMinor: 0n,
      cancellationFeeMinor: 500n,
      paymentMethod: PaymentMethod.EXTERNAL_GATEWAY,
    });

    const { debits, credits } = totals(plan.entries);
    expect(debits).toBe(credits);
    expect(net(plan.entries, GATEWAY_CLEARING)).toBe(-500n);
    expect(net(plan.entries, REVENUE)).toBe(500n);
  });

  it('never pays the partner more than the fee', () => {
    const plan = settlementEntries({
      ...base,
      jobTotalMinor: 0n,
      commissionMinor: 0n,
      cancellationFeeMinor: 500n,
      partnerFeeOnCancelMinor: 900n,
      paymentMethod: PaymentMethod.WALLET,
    });

    expect(plan.partnerCancellationCompensationMinor).toBe(500n);
    expect(net(plan.entries, PARTNER_WALLET)).toBe(500n);
    expect(net(plan.entries, REVENUE)).toBe(0n);
    const { debits, credits } = totals(plan.entries);
    expect(debits).toBe(credits);
  });

  it('produces no entries when there is nothing to settle', () => {
    const plan = settlementEntries({
      ...base,
      jobTotalMinor: 0n,
      commissionMinor: 0n,
      paymentMethod: PaymentMethod.CASH,
    });
    expect(plan.entries).toHaveLength(0);
  });

  it('rejects negative inputs', () => {
    expect(() =>
      settlementEntries({
        ...base,
        jobTotalMinor: -1n,
        commissionMinor: 0n,
        paymentMethod: PaymentMethod.CASH,
      }),
    ).toThrow(expect.objectContaining({ code: ErrorCode.VALIDATION_FAILED }));
  });
});

describe('refundEntries', () => {
  it('funds the customer wallet from the refund expense account', () => {
    const entries = refundEntries({
      amountMinor: 2_500n,
      currency: CURRENCY,
      customerWalletAccountCode: CUSTOMER_WALLET,
    });
    const { debits, credits } = totals(entries);
    expect(debits).toBe(credits);
    expect(net(entries, CUSTOMER_WALLET)).toBe(2_500n);
    expect(
      net(entries, platformAccountCode(LedgerAccountType.PLATFORM_REFUND_EXPENSE, CURRENCY)),
    ).toBe(-2_500n);
  });
});
