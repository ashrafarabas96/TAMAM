import { describe, expect, it } from 'vitest';

import {
  bookingInstantSchema,
  chaletAvailabilityQuerySchema,
  chaletSearchSchema,
  chaletPricingSchema,
  chaletRateRuleSchema,
  chaletSchedulingSchema,
  createChaletBlockSchema,
  externalChaletBookingSchema,
  holdChaletBookingSchema,
} from '../index';

const at = (iso: string) => iso;

describe('bookingInstantSchema', () => {
  it('accepts a whole minute with an offset', () => {
    expect(bookingInstantSchema.safeParse('2026-10-01T12:00:00+03:00').success).toBe(true);
    expect(bookingInstantSchema.safeParse('2026-10-01T12:15:00Z').success).toBe(true);
  });

  it('rejects seconds rather than rounding them away', () => {
    expect(bookingInstantSchema.safeParse('2026-10-01T12:00:30Z').success).toBe(false);
    expect(bookingInstantSchema.safeParse('2026-10-01T12:00:00.500Z').success).toBe(false);
  });

  it('rejects an instant with no offset, which would be ambiguous', () => {
    expect(bookingInstantSchema.safeParse('2026-10-01T12:00:00').success).toBe(false);
  });
});

describe('holdChaletBookingSchema', () => {
  const base = {
    chaletId: '11111111-1111-1111-1111-111111111111',
    startAt: at('2026-10-01T12:00:00+03:00'),
    endAt: at('2026-10-01T16:00:00+03:00'),
    guestCount: 6,
  };

  it('accepts a well-formed hold', () => {
    expect(holdChaletBookingSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a window that ends before it starts', () => {
    const r = holdChaletBookingSchema.safeParse({ ...base, endAt: at('2026-10-01T10:00:00+03:00') });
    expect(r.success).toBe(false);
  });

  it('rejects a zero-length window', () => {
    expect(holdChaletBookingSchema.safeParse({ ...base, endAt: base.startAt }).success).toBe(false);
  });

  it('rejects zero guests', () => {
    expect(holdChaletBookingSchema.safeParse({ ...base, guestCount: 0 }).success).toBe(false);
  });
});

describe('chaletPricingSchema', () => {
  const base = { baseHourlyRateMinor: 10_000, minimumHourlyRateMinor: 6_000 };

  it('accepts a floor below the base rate', () => {
    const parsed = chaletPricingSchema.parse(base);
    expect(parsed.pricingMode).toBe('OFF');
    expect(parsed.targetOccupancyPercent).toBe(80);
  });

  it('rejects a floor above the base rate, as the database does', () => {
    const r = chaletPricingSchema.safeParse({ ...base, minimumHourlyRateMinor: 20_000 });
    expect(r.success).toBe(false);
  });

  it('rejects a ceiling below the base rate', () => {
    const r = chaletPricingSchema.safeParse({ ...base, maximumHourlyRateMinor: 5_000 });
    expect(r.success).toBe(false);
  });
});

describe('chaletSchedulingSchema', () => {
  const base = {
    openingTime: '08:00',
    closingTime: '23:00',
    minimumBookingDurationMinutes: 120,
    maximumBookingDurationMinutes: 720,
  };

  it('defaults the interval to 15 minutes and the hold to 7', () => {
    const parsed = chaletSchedulingSchema.parse(base);
    expect(parsed.bookingIntervalMinutes).toBe(15);
    expect(parsed.holdDurationMinutes).toBe(7);
    expect(parsed.defaultCleaningDurationMinutes).toBe(90);
  });

  it('rejects a minimum that is not a whole number of intervals', () => {
    const r = chaletSchedulingSchema.safeParse({ ...base, minimumBookingDurationMinutes: 100 });
    expect(r.success).toBe(false);
  });

  it('rejects a maximum below the minimum', () => {
    const r = chaletSchedulingSchema.safeParse({ ...base, maximumBookingDurationMinutes: 60 });
    expect(r.success).toBe(false);
  });

  it('accepts a 30-minute grid when the minimum matches it', () => {
    const parsed = chaletSchedulingSchema.parse({
      ...base,
      bookingIntervalMinutes: 30,
      minimumBookingDurationMinutes: 180,
    });
    expect(parsed.bookingIntervalMinutes).toBe(30);
  });
});

describe('externalChaletBookingSchema', () => {
  const base = {
    startAt: at('2026-10-01T12:00:00+03:00'),
    endAt: at('2026-10-01T16:00:00+03:00'),
    guestCount: 4,
    guestName: 'أبو محمد',
  };

  it('defaults to a manually recorded owner booking', () => {
    expect(externalChaletBookingSchema.parse(base).source).toBe('OWNER_MANUAL');
  });

  it('refuses to let an external booking claim it came from TAMAM', () => {
    const r = externalChaletBookingSchema.safeParse({ ...base, source: 'TAMAM' });
    expect(r.success).toBe(false);
  });
});

describe('createChaletBlockSchema', () => {
  it('defaults to an owner block', () => {
    const parsed = createChaletBlockSchema.parse({
      startAt: at('2026-10-01T12:00:00+03:00'),
      endAt: at('2026-10-01T16:00:00+03:00'),
    });
    expect(parsed.kind).toBe('OWNER_BLOCK');
  });
});

describe('chaletRateRuleSchema', () => {
  it('accepts an evening surcharge', () => {
    const parsed = chaletRateRuleSchema.parse({
      label: 'مساء الخميس',
      startTime: '18:00',
      endTime: '23:00',
      adjustmentPercent: 25,
    });
    expect(parsed.priority).toBe(0);
    expect(parsed.isActive).toBe(true);
  });

  it('rejects a rule that applies to nothing in particular', () => {
    const r = chaletRateRuleSchema.safeParse({ label: 'anything', adjustmentPercent: 10 });
    expect(r.success).toBe(false);
  });

  it('rejects a discount deeper than the schema allows', () => {
    const r = chaletRateRuleSchema.safeParse({
      label: 'too deep',
      startTime: '08:00',
      adjustmentPercent: -95,
    });
    expect(r.success).toBe(false);
  });
});

describe('query schemas accept what a query string actually contains', () => {
  it('coerces a numeric duration arriving as a string', () => {
    // Every query parameter is a string. Without coercion `?durationMinutes=240`
    // fails validation and the caller gets a 422 for sending exactly what the
    // route documents.
    const parsed = chaletAvailabilityQuerySchema.parse({
      date: '2026-10-01',
      durationMinutes: '240',
    });
    expect(parsed.durationMinutes).toBe(240);
  });

  it('coerces a guest count arriving as a string', () => {
    expect(
      chaletAvailabilityQuerySchema.parse({ date: '2026-10-01', guestCount: '6' }).guestCount,
    ).toBe(6);
  });

  it('still rejects something that is not a number at all', () => {
    expect(
      chaletAvailabilityQuerySchema.safeParse({ date: '2026-10-01', durationMinutes: 'four hours' })
        .success,
    ).toBe(false);
  });

  it('still rejects a duration outside the bounds', () => {
    expect(
      chaletAvailabilityQuerySchema.safeParse({ date: '2026-10-01', durationMinutes: '0' }).success,
    ).toBe(false);
  });

  it('leaves the body schema strict, where JSON carries real numbers', () => {
    // A JSON body that sends "6" as a string is a client bug, not a query string.
    expect(
      holdChaletBookingSchema.safeParse({
        chaletId: '11111111-1111-1111-1111-111111111111',
        startAt: '2026-10-01T12:00:00+03:00',
        endAt: '2026-10-01T16:00:00+03:00',
        guestCount: '6',
      }).success,
    ).toBe(false);
  });

  it('coerces the search filters that arrive the same way', () => {
    const parsed = chaletSearchSchema.parse({ guestCount: '4', maxHourlyRateMinor: '12000' });
    expect(parsed.guestCount).toBe(4);
    expect(parsed.maxHourlyRateMinor).toBe(12_000);
  });
});
