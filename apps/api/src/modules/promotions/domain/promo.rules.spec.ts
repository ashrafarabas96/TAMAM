import { ErrorCode, JobType, PaymentMethod, PromoType } from '@tamam/shared-types';

import { type PromoContext, type PromoRule, evaluatePromo } from './promo.rules';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ZONE_ID = '22222222-2222-4222-8222-222222222222';
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-03-15T10:00:00.000Z');

function rule(overrides: Partial<PromoRule> = {}): PromoRule {
  return {
    id: 'promo-1',
    code: 'WELCOME20',
    type: PromoType.PERCENTAGE,
    value: 20,
    maxDiscountMinor: null,
    minOrderMinor: 0n,
    currency: 'ILS',
    startsAt: new Date('2026-01-01T00:00:00.000Z'),
    endsAt: null,
    usageLimit: null,
    usageCount: 0,
    perUserLimit: 1,
    firstOrderOnly: false,
    jobTypes: [],
    paymentMethods: [],
    isActive: true,
    categoryIds: [],
    zoneIds: [],
    userIds: [],
    ...overrides,
  };
}

function ctx(overrides: Partial<PromoContext> = {}): PromoContext {
  return {
    userId: USER_ID,
    jobType: JobType.RIDE,
    categoryId: null,
    zoneId: ZONE_ID,
    paymentMethod: PaymentMethod.CASH,
    subtotalMinor: 10_000n,
    currency: 'ILS',
    isFirstOrder: true,
    userRedemptions: 0,
    now: NOW,
    ...overrides,
  };
}

describe('evaluatePromo', () => {
  it('applies a percentage discount', () => {
    expect(evaluatePromo(rule(), ctx())).toEqual({ ok: true, discountMinor: 2_000n });
  });

  it('applies a fixed discount in minor units', () => {
    expect(evaluatePromo(rule({ type: PromoType.FIXED_AMOUNT, value: 1_500 }), ctx())).toEqual({
      ok: true,
      discountMinor: 1_500n,
    });
  });

  it('caps the discount at maxDiscountMinor', () => {
    expect(evaluatePromo(rule({ value: 50, maxDiscountMinor: 1_000n }), ctx())).toEqual({
      ok: true,
      discountMinor: 1_000n,
    });
  });

  it('never discounts more than the order total', () => {
    expect(
      evaluatePromo(
        rule({ type: PromoType.FIXED_AMOUNT, value: 99_999 }),
        ctx({ subtotalMinor: 3_000n }),
      ),
    ).toEqual({ ok: true, discountMinor: 3_000n });
  });

  it('rejects an inactive code', () => {
    expect(evaluatePromo(rule({ isActive: false }), ctx())).toEqual({
      ok: false,
      code: ErrorCode.PROMO_INVALID,
    });
  });

  it('rejects a code that has not started', () => {
    expect(evaluatePromo(rule({ startsAt: new Date('2026-06-01T00:00:00.000Z') }), ctx())).toEqual({
      ok: false,
      code: ErrorCode.PROMO_INVALID,
    });
  });

  it('rejects an expired code', () => {
    expect(evaluatePromo(rule({ endsAt: new Date('2026-03-01T00:00:00.000Z') }), ctx())).toEqual({
      ok: false,
      code: ErrorCode.PROMO_EXPIRED,
    });
  });

  it('rejects a currency mismatch', () => {
    expect(evaluatePromo(rule({ currency: 'USD' }), ctx())).toEqual({
      ok: false,
      code: ErrorCode.PROMO_NOT_ELIGIBLE,
    });
  });

  it('rejects once the global usage limit is reached', () => {
    expect(evaluatePromo(rule({ usageLimit: 100, usageCount: 100 }), ctx())).toEqual({
      ok: false,
      code: ErrorCode.PROMO_USAGE_EXCEEDED,
    });
  });

  it('rejects once the per-user limit is reached', () => {
    expect(evaluatePromo(rule({ perUserLimit: 2 }), ctx({ userRedemptions: 2 }))).toEqual({
      ok: false,
      code: ErrorCode.PROMO_USAGE_EXCEEDED,
    });
  });

  it('allows a second redemption while the per-user limit is not reached', () => {
    expect(evaluatePromo(rule({ perUserLimit: 3 }), ctx({ userRedemptions: 2 }))).toEqual({
      ok: true,
      discountMinor: 2_000n,
    });
  });

  it('rejects a first-order-only code for a returning customer', () => {
    expect(evaluatePromo(rule({ firstOrderOnly: true }), ctx({ isFirstOrder: false }))).toEqual({
      ok: false,
      code: ErrorCode.PROMO_NOT_ELIGIBLE,
    });
  });

  it('rejects a job type outside the allow list', () => {
    expect(
      evaluatePromo(rule({ jobTypes: [JobType.DELIVERY] }), ctx({ jobType: JobType.RIDE })),
    ).toEqual({ ok: false, code: ErrorCode.PROMO_NOT_ELIGIBLE });
  });

  it('accepts a job type inside the allow list', () => {
    expect(evaluatePromo(rule({ jobTypes: [JobType.RIDE, JobType.DELIVERY] }), ctx())).toEqual({
      ok: true,
      discountMinor: 2_000n,
    });
  });

  it('rejects a category outside the allow list (including a job with no category)', () => {
    expect(evaluatePromo(rule({ categoryIds: [CATEGORY_ID] }), ctx())).toEqual({
      ok: false,
      code: ErrorCode.PROMO_NOT_ELIGIBLE,
    });
    expect(
      evaluatePromo(rule({ categoryIds: [CATEGORY_ID] }), ctx({ categoryId: 'other' })),
    ).toEqual({ ok: false, code: ErrorCode.PROMO_NOT_ELIGIBLE });
    expect(
      evaluatePromo(rule({ categoryIds: [CATEGORY_ID] }), ctx({ categoryId: CATEGORY_ID })),
    ).toEqual({ ok: true, discountMinor: 2_000n });
  });

  it('rejects a zone outside the allow list', () => {
    expect(evaluatePromo(rule({ zoneIds: ['other-zone'] }), ctx())).toEqual({
      ok: false,
      code: ErrorCode.PROMO_NOT_ELIGIBLE,
    });
  });

  it('rejects a user outside a targeted code', () => {
    expect(evaluatePromo(rule({ userIds: ['someone-else'] }), ctx())).toEqual({
      ok: false,
      code: ErrorCode.PROMO_NOT_ELIGIBLE,
    });
    expect(evaluatePromo(rule({ userIds: [USER_ID] }), ctx())).toEqual({
      ok: true,
      discountMinor: 2_000n,
    });
  });

  it('rejects a payment method outside the allow list', () => {
    expect(
      evaluatePromo(
        rule({ paymentMethods: [PaymentMethod.WALLET] }),
        ctx({ paymentMethod: PaymentMethod.CASH }),
      ),
    ).toEqual({
      ok: false,
      code: ErrorCode.PROMO_NOT_ELIGIBLE,
    });
  });

  it('rejects an order below the minimum', () => {
    expect(evaluatePromo(rule({ minOrderMinor: 15_000n }), ctx())).toEqual({
      ok: false,
      code: ErrorCode.PROMO_MIN_ORDER_NOT_MET,
    });
  });

  it('rejects a discount that rounds to zero', () => {
    expect(evaluatePromo(rule({ type: PromoType.FIXED_AMOUNT, value: 0 }), ctx())).toEqual({
      ok: false,
      code: ErrorCode.PROMO_NOT_ELIGIBLE,
    });
  });

  it('rounds percentage discounts half-up on odd amounts', () => {
    expect(evaluatePromo(rule({ value: 12.5 }), ctx({ subtotalMinor: 999n }))).toEqual({
      ok: true,
      discountMinor: 125n,
    });
  });
});
