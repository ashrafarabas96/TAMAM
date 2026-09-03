import { JobUrgency } from '@tamam/shared-types';

import { applyPromoAndTax, computeDeliveryFare, computeHomeServiceFare, computeRideFare } from './fare-calculator';

const rideRule = { baseFare: 500, perKm: 200, perMinute: 30, minimumFare: 1000, bookingFee: 200, zoneFee: 0, serviceFeePercent: 0, taxPercent: 0, waitingPerMinute: 50, freeWaitingMinutes: 3, surgeMultiplier: 1 };

describe('computeRideFare', () => {
  it('meters distance and time in integer minor units', () => {
    const r = computeRideFare(rideRule, { distanceMeters: 5000, durationSeconds: 600, surgeMultiplier: 1 });
    // 500 + 5km*200 + 10min*30 = 1800 + booking 200
    expect(r.totalMinor).toBe(2000n);
    expect(r.lines.find((l) => l.code === 'DISTANCE')?.amountMinor).toBe(1000n);
  });
  it('applies the minimum fare', () => {
    const r = computeRideFare(rideRule, { distanceMeters: 300, durationSeconds: 60, surgeMultiplier: 1 });
    expect(r.lines.some((l) => l.code === 'MINIMUM_FARE_ADJUSTMENT')).toBe(true);
    expect(r.totalMinor).toBe(1200n);
  });
  it('applies surge to the metered part only', () => {
    const r = computeRideFare(rideRule, { distanceMeters: 5000, durationSeconds: 600, surgeMultiplier: 1.5 });
    expect(r.lines.find((l) => l.code === 'SURGE')?.amountMinor).toBe(900n);
    expect(r.totalMinor).toBe(2900n);
  });
  it('bills waiting beyond the free minutes', () => {
    const r = computeRideFare(rideRule, { distanceMeters: 5000, durationSeconds: 600, waitingSeconds: 6 * 60, surgeMultiplier: 1 });
    expect(r.lines.find((l) => l.code === 'WAITING')?.amountMinor).toBe(150n);
  });
});

describe('computeDeliveryFare', () => {
  const rule = { base: 800, perKm: 150, perKgOverThreshold: 100, weightThresholdKg: 5, sizeMultipliers: { SMALL: 1, MEDIUM: 1.2, LARGE: 1.5, XL: 2 }, urgencySurchargePercent: { STANDARD: 0, URGENT: 20, EMERGENCY: 50 }, perAdditionalStop: 300, minimumFare: 1000, bookingFee: 0, taxPercent: 0 };
  it('applies size multiplier, weight and urgency', () => {
    const r = computeDeliveryFare(rule, { distanceMeters: 4000, size: 'LARGE', weightKg: 7.5, urgency: JobUrgency.URGENT, additionalStops: 0, surgeMultiplier: 1 });
    // core 800+600=1400 → ×1.5 = 2100 → +3kg*100 = 2400 → +20% = 2880
    expect(r.totalMinor).toBe(2880n);
  });
});

describe('computeHomeServiceFare', () => {
  const rule = { inspectionFee: 3000, inspectionFeeWaivedOnApproval: true, urgencySurchargePercent: { STANDARD: 0, URGENT: 20, EMERGENCY: 50 }, bookingFee: 0, taxPercent: 0 };
  it('charges only the inspection fee before a quote', () => {
    const r = computeHomeServiceFare(rule, { pricingMethod: 'INSPECTION_QUOTE', fixedPriceMinor: null, startingFromMinor: null, hourlyRateMinor: null, hours: null, optionsMinor: 0n, inspectionFeeMinor: null, urgency: JobUrgency.STANDARD, quote: null, quoteApproved: false });
    expect(r.totalMinor).toBe(3000n);
  });
  it('uses the approved quote and waives the inspection fee', () => {
    const r = computeHomeServiceFare(rule, { pricingMethod: 'INSPECTION_QUOTE', fixedPriceMinor: null, startingFromMinor: null, hourlyRateMinor: null, hours: null, optionsMinor: 500n, inspectionFeeMinor: null, urgency: JobUrgency.STANDARD, quote: { laborMinor: 10000n, partsMinor: 4000n, feesMinor: 0n, discountMinor: 1000n }, quoteApproved: true });
    expect(r.totalMinor).toBe(13500n);
    expect(r.lines.some((l) => l.code === 'INSPECTION_FEE')).toBe(false);
  });
});

describe('applyPromoAndTax', () => {
  it('caps promo at subtotal and taxes the discounted amount', () => {
    const base = computeRideFare(rideRule, { distanceMeters: 5000, durationSeconds: 600, surgeMultiplier: 1 });
    const r = applyPromoAndTax(base, 5000n, 10);
    expect(r.totalMinor).toBe(0n);
    const r2 = applyPromoAndTax(base, 500n, 10);
    expect(r2.totalMinor).toBe(1650n); // (2000-500) * 1.10
  });
});
