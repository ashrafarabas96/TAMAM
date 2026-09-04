import type { ChaletPricingProfile } from '@tamam/shared-types';

import {
  type DemandSignals,
  type PricingChalet,
  type RateRule,
  PROFILE_LIMITS,
  applyRateRules,
  hourlyToTotal,
  lastMinuteDiscountPercent,
  localClock,
  occupancyAdjustmentPercent,
  quoteSlot,
  ruleApplies,
} from './smart-pricing';

const TZ = 'Asia/Jerusalem';

/** "2026-10-01 12:00" local, as an absolute instant. October is UTC+3 there. */
const local = (hhmm: string, date = '2026-10-01'): Date => new Date(`${date}T${hhmm}:00+03:00`);

const chalet = (overrides: Partial<PricingChalet> = {}): PricingChalet => ({
  baseHourlyRateMinor: 10_000n, // 100.00 ILS/hour
  minimumHourlyRateMinor: 6_000n,
  maximumHourlyRateMinor: null,
  pricingProfile: 'BALANCED',
  smartPricingEnabled: true,
  lastMinutePricingEnabled: false,
  maxAutoDiscountPercent: null,
  targetOccupancyPercent: 80,
  timeZone: TZ,
  ...overrides,
});

/** Demand that moves nothing, so a test can vary one signal at a time. */
const neutralDemand = (overrides: Partial<DemandSignals> = {}): DemandSignals => ({
  occupancyPercent: 80,
  minutesUntilStart: 10_000,
  isGap: false,
  ...overrides,
});

const slot = { startAt: local('12:00'), endAt: local('16:00') };

describe('localClock', () => {
  it('reads the wall clock in the chalet zone, not UTC', () => {
    expect(localClock(local('12:00'), TZ)).toEqual({ minuteOfDay: 12 * 60, dayOfWeek: 4 });
  });

  it('handles an instant that is a different day in UTC', () => {
    // 2026-10-01 23:30 local is 20:30 UTC — still Thursday either way; the
    // interesting case is 01:00 local, which is the previous day in UTC.
    expect(localClock(local('01:00', '2026-10-02'), TZ).minuteOfDay).toBe(60);
    expect(localClock(local('01:00', '2026-10-02'), TZ).dayOfWeek).toBe(5);
  });
});

describe('ruleApplies', () => {
  const evening: RateRule = {
    kind: 'TIME_OF_DAY',
    label: 'Evening',
    startTime: '18:00',
    endTime: '23:00',
    priority: 0,
  };

  it('matches inside a time-of-day window', () => {
    expect(ruleApplies(evening, local('19:00'), TZ)).toBe(true);
  });

  it('excludes the closing edge, so two windows never both apply', () => {
    expect(ruleApplies(evening, local('23:00'), TZ)).toBe(false);
    expect(ruleApplies(evening, local('18:00'), TZ)).toBe(true);
  });

  it('handles a window that wraps past midnight', () => {
    const night: RateRule = { ...evening, startTime: '22:00', endTime: '02:00' };
    expect(ruleApplies(night, local('23:00'), TZ)).toBe(true);
    expect(ruleApplies(night, local('01:00', '2026-10-02'), TZ)).toBe(true);
    expect(ruleApplies(night, local('12:00'), TZ)).toBe(false);
  });

  it('matches a weekday rule', () => {
    const thursday: RateRule = { kind: 'DAY_OF_WEEK', label: 'Thu', dayOfWeek: 4, priority: 0 };
    expect(ruleApplies(thursday, local('12:00'), TZ)).toBe(true);
    expect(ruleApplies(thursday, local('12:00', '2026-10-02'), TZ)).toBe(false);
  });

  it('matches a date range inclusively at both ends', () => {
    const eid: RateRule = {
      kind: 'SPECIAL_DATE',
      label: 'Eid',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      priority: 0,
    };
    expect(ruleApplies(eid, local('12:00', '2026-10-01'), TZ)).toBe(true);
    expect(ruleApplies(eid, local('12:00', '2026-10-03'), TZ)).toBe(true);
    expect(ruleApplies(eid, local('12:00', '2026-10-04'), TZ)).toBe(false);
  });

  it('treats a single-day special date as a one-day range', () => {
    const single: RateRule = {
      kind: 'SPECIAL_DATE',
      label: 'One day',
      startDate: '2026-10-01',
      endDate: null,
      priority: 0,
    };
    expect(ruleApplies(single, local('12:00'), TZ)).toBe(true);
    expect(ruleApplies(single, local('12:00', '2026-10-02'), TZ)).toBe(false);
  });

  it('ignores an incomplete rule instead of matching everything', () => {
    expect(ruleApplies({ kind: 'TIME_OF_DAY', label: 'x', priority: 0 }, local('12:00'), TZ)).toBe(
      false,
    );
  });
});

describe('applyRateRules', () => {
  const thursday: RateRule = {
    kind: 'DAY_OF_WEEK',
    label: 'Thursday',
    dayOfWeek: 4,
    multiplier: 1.3,
    priority: 10,
  };
  const evening: RateRule = {
    kind: 'TIME_OF_DAY',
    label: 'Evening',
    startTime: '18:00',
    endTime: '23:00',
    multiplier: 1.2,
    priority: 5,
  };

  it('leaves the base rate alone when nothing matches', () => {
    expect(applyRateRules(10_000n, [evening], local('12:00'), TZ)).toEqual({
      rateMinor: 10_000n,
      rule: null,
    });
  });

  it('applies a multiplier', () => {
    expect(applyRateRules(10_000n, [thursday], local('12:00'), TZ).rateMinor).toBe(13_000n);
  });

  it('lets the highest priority win outright rather than compounding', () => {
    // A Thursday evening costs 30% more, not 56%.
    const result = applyRateRules(10_000n, [evening, thursday], local('19:00'), TZ);
    expect(result.rateMinor).toBe(13_000n);
    expect(result.rule?.label).toBe('Thursday');
  });

  it('honours an absolute rate over the base', () => {
    const fixed: RateRule = {
      kind: 'SPECIAL_DATE',
      label: 'Eid',
      startDate: '2026-10-01',
      hourlyRateMinor: 25_000n,
      priority: 100,
    };
    expect(applyRateRules(10_000n, [fixed], local('12:00'), TZ).rateMinor).toBe(25_000n);
  });
});

describe('occupancyAdjustmentPercent', () => {
  it('does nothing when the chalet is exactly on target', () => {
    expect(occupancyAdjustmentPercent(80, 80, 'BALANCED')).toBe(0);
  });

  it('discounts a quiet week', () => {
    expect(occupancyAdjustmentPercent(40, 80, 'BALANCED')).toBeLessThan(0);
  });

  it('raises the price on a busy week', () => {
    expect(occupancyAdjustmentPercent(95, 80, 'BALANCED')).toBeGreaterThan(0);
  });

  it('moves a conservative chalet less than an aggressive one', () => {
    const conservative = occupancyAdjustmentPercent(30, 80, 'CONSERVATIVE');
    const aggressive = occupancyAdjustmentPercent(30, 80, 'AGGRESSIVE_OCCUPANCY');
    expect(Math.abs(conservative)).toBeLessThan(Math.abs(aggressive));
  });

  it('never exceeds the profile caps, however extreme the calendar', () => {
    for (const profile of Object.keys(PROFILE_LIMITS) as ChaletPricingProfile[]) {
      const limits = PROFILE_LIMITS[profile];
      expect(occupancyAdjustmentPercent(0, 100, profile)).toBeGreaterThanOrEqual(
        -limits.discountCapPercent,
      );
      expect(occupancyAdjustmentPercent(100, 0, profile)).toBeLessThanOrEqual(
        limits.surgeCapPercent,
      );
    }
  });
});

describe('lastMinuteDiscountPercent', () => {
  it('deepens as the slot approaches', () => {
    const day = lastMinuteDiscountPercent(1_000, 'BALANCED');
    const soon = lastMinuteDiscountPercent(300, 'BALANCED');
    const imminent = lastMinuteDiscountPercent(60, 'BALANCED');
    expect(day).toBeGreaterThan(soon);
    expect(soon).toBeGreaterThan(imminent);
  });

  it('does nothing for a slot far in the future', () => {
    expect(lastMinuteDiscountPercent(10_000, 'BALANCED')).toBe(0);
  });

  it('does nothing for a slot that already started', () => {
    expect(lastMinuteDiscountPercent(-30, 'BALANCED')).toBe(0);
  });
});

describe('hourlyToTotal', () => {
  it('charges four hours as four hours', () => {
    expect(hourlyToTotal(10_000n, 240)).toBe(40_000n);
  });

  it('charges 90 minutes as an hour and a half, not two hours', () => {
    expect(hourlyToTotal(10_000n, 90)).toBe(15_000n);
  });

  it('rounds a part-minor-unit result to the nearest minor unit', () => {
    expect(hourlyToTotal(10_000n, 20)).toBe(3_333n);
  });
});

describe('quoteSlot', () => {
  it('quotes the base rate when nothing applies', () => {
    const quote = quoteSlot({
      chalet: chalet({ smartPricingEnabled: false }),
      slot,
      rules: [],
      demand: neutralDemand(),
    });
    expect(quote.effectiveHourlyRateMinor).toBe(10_000n);
    expect(quote.subtotalMinor).toBe(40_000n);
    expect(quote.adjustments).toEqual([]);
    expect(quote.clampedToMinimum).toBe(false);
  });

  it('leaves the price alone when the owner has Smart Pricing off', () => {
    const quote = quoteSlot({
      chalet: chalet({ smartPricingEnabled: false }),
      slot,
      rules: [],
      demand: neutralDemand({ occupancyPercent: 10 }),
    });
    expect(quote.effectiveHourlyRateMinor).toBe(10_000n);
  });

  it('still applies the owner’s own rate rules with Smart Pricing off', () => {
    const quote = quoteSlot({
      chalet: chalet({ smartPricingEnabled: false }),
      slot,
      rules: [
        { kind: 'DAY_OF_WEEK', label: 'Thursday', dayOfWeek: 4, multiplier: 1.3, priority: 1 },
      ],
      demand: neutralDemand(),
    });
    expect(quote.effectiveHourlyRateMinor).toBe(13_000n);
    expect(quote.adjustments[0]?.code).toBe('RATE_RULE');
    expect(quote.adjustments[0]?.label.ar).toBe('Thursday');
  });

  it('discounts a quiet week and says so in both languages', () => {
    const quote = quoteSlot({
      chalet: chalet(),
      slot,
      rules: [],
      demand: neutralDemand({ occupancyPercent: 30 }),
    });
    expect(quote.effectiveHourlyRateMinor).toBeLessThan(10_000n);
    const reason = quote.adjustments.find((a) => a.code === 'LOW_OCCUPANCY');
    expect(reason?.label.ar).toBe('إقبال منخفض هذا الأسبوع');
    expect(reason?.label.en).toBe('Quiet week');
  });

  it('never quotes below the owner’s floor, however deep the discounts', () => {
    const quote = quoteSlot({
      chalet: chalet({
        pricingProfile: 'AGGRESSIVE_OCCUPANCY',
        lastMinutePricingEnabled: true,
        minimumHourlyRateMinor: 9_000n,
      }),
      slot,
      rules: [],
      demand: { occupancyPercent: 0, minutesUntilStart: 30, isGap: true },
    });
    expect(quote.effectiveHourlyRateMinor).toBe(9_000n);
    expect(quote.clampedToMinimum).toBe(true);
    expect(quote.adjustments.some((a) => a.code === 'FLOOR_APPLIED')).toBe(true);
  });

  it('reports the floor was hit so an owner can see it was their own setting', () => {
    const quote = quoteSlot({
      chalet: chalet({ minimumHourlyRateMinor: 10_000n }),
      slot,
      rules: [],
      demand: neutralDemand({ occupancyPercent: 0 }),
    });
    const floor = quote.adjustments.find((a) => a.code === 'FLOOR_APPLIED');
    expect(floor?.label.ar).toBe('الحد الأدنى الذي حدده المالك');
    expect(quote.effectiveHourlyRateMinor).toBe(10_000n);
  });

  it('never quotes above the owner’s ceiling', () => {
    const quote = quoteSlot({
      chalet: chalet({
        maximumHourlyRateMinor: 11_000n,
        pricingProfile: 'AGGRESSIVE_OCCUPANCY',
      }),
      slot,
      rules: [
        { kind: 'DAY_OF_WEEK', label: 'Peak', dayOfWeek: 4, multiplier: 2, priority: 1 },
      ],
      demand: neutralDemand({ occupancyPercent: 100 }),
    });
    expect(quote.effectiveHourlyRateMinor).toBe(11_000n);
    expect(quote.clampedToMaximum).toBe(true);
  });

  it('honours the owner’s cap on automatic discounts', () => {
    const quote = quoteSlot({
      chalet: chalet({
        pricingProfile: 'AGGRESSIVE_OCCUPANCY',
        lastMinutePricingEnabled: true,
        maxAutoDiscountPercent: 10,
      }),
      slot,
      rules: [],
      demand: { occupancyPercent: 0, minutesUntilStart: 30, isGap: true },
    });
    // 10% off 100.00 and no further, even though the floor is far lower.
    expect(quote.effectiveHourlyRateMinor).toBe(9_000n);
    expect(quote.clampedToMinimum).toBe(false);
  });

  it('discounts a gap between two bookings', () => {
    const withGap = quoteSlot({
      chalet: chalet(),
      slot,
      rules: [],
      demand: neutralDemand({ isGap: true }),
    });
    const without = quoteSlot({ chalet: chalet(), slot, rules: [], demand: neutralDemand() });
    expect(withGap.effectiveHourlyRateMinor).toBeLessThan(without.effectiveHourlyRateMinor);
    expect(withGap.adjustments.some((a) => a.code === 'GAP_FILLER')).toBe(true);
  });

  it('only discounts last minute when the owner enabled it', () => {
    const off = quoteSlot({
      chalet: chalet(),
      slot,
      rules: [],
      demand: neutralDemand({ minutesUntilStart: 30 }),
    });
    const on = quoteSlot({
      chalet: chalet({ lastMinutePricingEnabled: true }),
      slot,
      rules: [],
      demand: neutralDemand({ minutesUntilStart: 30 }),
    });
    expect(off.adjustments.some((a) => a.code === 'LAST_MINUTE')).toBe(false);
    expect(on.adjustments.some((a) => a.code === 'LAST_MINUTE')).toBe(true);
  });

  it('applies an accepted offer even with Smart Pricing off', () => {
    const quote = quoteSlot({
      chalet: chalet({ smartPricingEnabled: false }),
      slot,
      rules: [],
      demand: neutralDemand(),
      offerDiscountPercent: 20,
    });
    expect(quote.effectiveHourlyRateMinor).toBe(8_000n);
  });

  it('treats an offer percentage as a discount whichever sign it arrives with', () => {
    const positive = quoteSlot({
      chalet: chalet({ smartPricingEnabled: false }),
      slot,
      rules: [],
      demand: neutralDemand(),
      offerDiscountPercent: 20,
    });
    const negative = quoteSlot({
      chalet: chalet({ smartPricingEnabled: false }),
      slot,
      rules: [],
      demand: neutralDemand(),
      offerDiscountPercent: -20,
    });
    expect(positive.effectiveHourlyRateMinor).toBe(negative.effectiveHourlyRateMinor);
  });

  it('charges for the minutes actually booked', () => {
    const quote = quoteSlot({
      chalet: chalet({ smartPricingEnabled: false }),
      slot: { startAt: local('12:00'), endAt: local('13:30') },
      rules: [],
      demand: neutralDemand(),
    });
    expect(quote.durationMinutes).toBe(90);
    expect(quote.subtotalMinor).toBe(15_000n);
  });

  it('keeps every adjustment on the quote so the price can be explained later', () => {
    const quote = quoteSlot({
      chalet: chalet({ lastMinutePricingEnabled: true }),
      slot,
      rules: [
        { kind: 'DAY_OF_WEEK', label: 'Thursday', dayOfWeek: 4, multiplier: 1.3, priority: 1 },
      ],
      demand: { occupancyPercent: 20, minutesUntilStart: 60, isGap: false },
    });
    expect(quote.adjustments.map((a) => a.code)).toEqual([
      'RATE_RULE',
      'LOW_OCCUPANCY',
      'LAST_MINUTE',
    ]);
    for (const adjustment of quote.adjustments) {
      expect(adjustment.label.ar.length).toBeGreaterThan(0);
      expect(adjustment.label.en.length).toBeGreaterThan(0);
    }
  });
});

describe('the floor holds across every profile and every signal', () => {
  const profiles = Object.keys(PROFILE_LIMITS) as ChaletPricingProfile[];
  const occupancies = [0, 25, 50, 75, 100];
  const leadTimes = [0, 30, 200, 500, 2_000];

  it.each(profiles)('%s never goes below the floor', (pricingProfile) => {
    for (const occupancyPercent of occupancies) {
      for (const minutesUntilStart of leadTimes) {
        for (const isGap of [true, false]) {
          const quote = quoteSlot({
            chalet: chalet({
              pricingProfile,
              lastMinutePricingEnabled: true,
              minimumHourlyRateMinor: 7_000n,
            }),
            slot,
            rules: [],
            demand: { occupancyPercent, minutesUntilStart, isGap },
            offerDiscountPercent: 50,
          });
          expect(quote.effectiveHourlyRateMinor).toBeGreaterThanOrEqual(7_000n);
        }
      }
    }
  });
});
