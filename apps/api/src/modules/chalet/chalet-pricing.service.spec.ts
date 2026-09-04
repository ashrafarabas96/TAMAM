import { ErrorCode } from '@tamam/shared-types';

import type { AppConfigService } from '../../config';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';

import type { ChaletAvailabilityService } from './chalet-availability.service';
import { ChaletPricingService } from './chalet-pricing.service';
import type { FreeWindow, Interval, Occupancy } from './domain/availability';

const CHALET_ID = '11111111-1111-4111-8111-111111111111';
const TZ = 'Asia/Jerusalem';

const local = (hhmm: string, date = '2026-10-01'): Date => new Date(`${date}T${hhmm}:00+03:00`);

const config = { env: { DEFAULT_TIMEZONE: TZ } } as unknown as AppConfigService;

const pricingRow = {
  baseHourlyRateMinor: 10_000n,
  minimumHourlyRateMinor: 6_000n,
  maximumHourlyRateMinor: null,
  pricingProfile: 'BALANCED',
  smartPricingEnabled: true,
  lastMinutePricingEnabled: false,
  maxAutoDiscountPercent: null,
  targetOccupancyPercent: 80,
  currency: 'ILS',
};

const schedule = {
  id: CHALET_ID,
  openingTime: '08:00',
  closingTime: '23:00',
  bookingIntervalMinutes: 15,
  minimumBookingDurationMinutes: 120,
  maximumBookingDurationMinutes: 720,
  defaultCleaningDurationMinutes: 90,
  holdDurationMinutes: 7,
  maximumGuests: 20,
  minimumGuests: null,
  status: 'ACTIVE',
};

interface Fixture {
  rateRules?: unknown[];
  /** Either a fixed list, or one computed per span so a week can be filled. */
  occupancies?: Occupancy[] | ((span: Interval) => Occupancy[]);
  gaps?: FreeWindow[];
  chalet?: unknown;
}

/** The same local time on whichever day the service is asking about. */
const sameHoursEachDay =
  (fromHour: number, toHour: number) =>
  (span: Interval): Occupancy[] => {
    const dayStart = new Date(span.startAt);
    const at = (hour: number): Date => new Date(dayStart.getTime() + (hour - 8) * 3_600_000);
    return [{ kind: 'BOOKING', startAt: at(fromHour), endAt: at(toHour) }];
  };

function makeService(fixture: Fixture = {}): ChaletPricingService {
  const prisma = {
    chalet: {
      findUnique: jest.fn().mockResolvedValue(
        fixture.chalet === undefined ? pricingRow : fixture.chalet,
      ),
    },
    chaletRateRule: { findMany: jest.fn().mockResolvedValue(fixture.rateRules ?? []) },
  } as unknown as PrismaService;

  const availability = {
    loadSchedule: jest.fn().mockResolvedValue(schedule),
    occupanciesBetween: jest.fn(async (_id: string, span: Interval) => {
      const given = fixture.occupancies ?? [];
      return typeof given === 'function' ? given(span) : given;
    }),
    gapsForDate: jest.fn().mockResolvedValue(fixture.gaps ?? []),
  } as unknown as ChaletAvailabilityService;

  return new ChaletPricingService(prisma, config, availability);
}

const slot = { startAt: local('12:00'), endAt: local('16:00') };

describe('ChaletPricingService.occupancyPercent', () => {
  it('reports an empty week as zero', async () => {
    const service = makeService();
    expect(await service.occupancyPercent(CHALET_ID, local('08:00'))).toBe(0);
  });

  it('measures against opening hours, not the whole day', async () => {
    // Four booked hours out of a fifteen-hour day, on every day of the week.
    const service = makeService({ occupancies: sameHoursEachDay(12, 16) });
    const percent = await service.occupancyPercent(CHALET_ID, local('08:00'));
    // 240/900 is 27%. Measured against a 24-hour day it would read 17%, which
    // would make every chalet that closes overnight look half empty.
    expect(percent).toBe(27);
  });

  it('counts only the days that are actually booked', async () => {
    // One booked day out of seven, four hours of the fifteen: 240/6300.
    const service = makeService({
      occupancies: [{ kind: 'BOOKING', startAt: local('12:00'), endAt: local('16:00') }],
    });
    expect(await service.occupancyPercent(CHALET_ID, local('08:00'))).toBe(4);
  });

  it('does not count time outside opening hours against the chalet', async () => {
    const service = makeService({
      // A block running all night, most of which the chalet is closed for.
      occupancies: [
        { kind: 'BLOCK', startAt: local('20:00'), endAt: local('10:00', '2026-10-02') },
      ],
    });
    const percent = await service.occupancyPercent(CHALET_ID, local('08:00'));
    expect(percent).toBeLessThan(100);
  });

  it('never reports more than a full week', async () => {
    const service = makeService({
      occupancies: [
        { kind: 'BOOKING', startAt: local('00:00'), endAt: local('00:00', '2026-11-01') },
      ],
    });
    expect(await service.occupancyPercent(CHALET_ID, local('08:00'))).toBe(100);
  });
});

describe('ChaletPricingService.quote', () => {
  it('quotes the base rate on a chalet at its occupancy target', async () => {
    // An empty calendar sits far below the default 80% target, so the target is
    // pulled down to meet it and isolate the base rate from demand.
    const onTarget = makeService({ chalet: { ...pricingRow, targetOccupancyPercent: 0 } });
    const quote = await onTarget.quote(CHALET_ID, slot, { now: local('08:00') });
    expect(quote.effectiveHourlyRateMinor).toBe(10_000n);
    expect(quote.subtotalMinor).toBe(40_000n);
    expect(quote.currency).toBe('ILS');
    expect(quote.adjustments).toEqual([]);
  });

  it('discounts an empty week', async () => {
    const service = makeService();
    const quote = await service.quote(CHALET_ID, slot, { now: local('08:00') });
    expect(quote.effectiveHourlyRateMinor).toBeLessThan(10_000n);
    expect(quote.adjustments.some((a) => a.code === 'LOW_OCCUPANCY')).toBe(true);
  });

  it('applies an owner rate rule read from the database', async () => {
    const service = makeService({
      chalet: { ...pricingRow, smartPricingEnabled: false },
      rateRules: [
        {
          kind: 'DAY_OF_WEEK',
          label: 'الخميس',
          startTime: null,
          endTime: null,
          dayOfWeek: 4,
          startDate: null,
          endDate: null,
          multiplier: 1.3,
          hourlyRateMinor: null,
          priority: 10,
        },
      ],
    });
    const quote = await service.quote(CHALET_ID, slot, { now: local('08:00') });
    expect(quote.effectiveHourlyRateMinor).toBe(13_000n);
    expect(quote.adjustments[0]?.label.ar).toBe('الخميس');
  });

  it('converts a Prisma Decimal multiplier rather than stringifying it', async () => {
    const service = makeService({
      chalet: { ...pricingRow, smartPricingEnabled: false },
      rateRules: [
        {
          kind: 'DAY_OF_WEEK',
          label: 'Thursday',
          startTime: null,
          endTime: null,
          dayOfWeek: 4,
          startDate: null,
          endDate: null,
          // Prisma hands back a Decimal-like object, not a number.
          multiplier: { toString: () => '1.500', valueOf: () => 1.5 },
          hourlyRateMinor: null,
          priority: 1,
        },
      ],
    });
    const quote = await service.quote(CHALET_ID, slot, { now: local('08:00') });
    expect(quote.effectiveHourlyRateMinor).toBe(15_000n);
  });

  it('reads a special-date rule’s dates as local calendar days', async () => {
    const service = makeService({
      chalet: { ...pricingRow, smartPricingEnabled: false },
      rateRules: [
        {
          kind: 'SPECIAL_DATE',
          label: 'العيد',
          startTime: null,
          endTime: null,
          dayOfWeek: null,
          startDate: new Date('2026-10-01T00:00:00.000Z'),
          endDate: new Date('2026-10-03T00:00:00.000Z'),
          multiplier: null,
          hourlyRateMinor: 25_000n,
          priority: 100,
        },
      ],
    });
    const quote = await service.quote(CHALET_ID, slot, { now: local('08:00') });
    expect(quote.effectiveHourlyRateMinor).toBe(25_000n);
  });

  it('only calls a slot a gap when it really sits inside one', async () => {
    const boxedIn = makeService({
      chalet: { ...pricingRow, targetOccupancyPercent: 0 },
      gaps: [
        {
          startAt: local('12:00'),
          endAt: local('16:00'),
          availableMinutes: 240,
          isGap: true,
        },
      ],
    });
    const openEnded = makeService({ chalet: { ...pricingRow, targetOccupancyPercent: 0 } });

    const inGap = await boxedIn.quote(CHALET_ID, slot, { now: local('08:00') });
    const notInGap = await openEnded.quote(CHALET_ID, slot, { now: local('08:00') });
    expect(inGap.effectiveHourlyRateMinor).toBeLessThan(notInGap.effectiveHourlyRateMinor);
    expect(inGap.adjustments.some((a) => a.code === 'GAP_FILLER')).toBe(true);
  });

  it('does not apply the gap discount to a slot only partly inside a gap', async () => {
    const service = makeService({
      chalet: { ...pricingRow, targetOccupancyPercent: 0 },
      gaps: [
        { startAt: local('13:00'), endAt: local('15:00'), availableMinutes: 120, isGap: true },
      ],
    });
    const quote = await service.quote(CHALET_ID, slot, { now: local('08:00') });
    expect(quote.adjustments.some((a) => a.code === 'GAP_FILLER')).toBe(false);
  });

  it('reports an unknown chalet as not found', async () => {
    const service = makeService({ chalet: null });
    await expect(service.quote(CHALET_ID, slot)).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });
});

describe('ChaletPricingService.toBreakdown', () => {
  it('renders money as numbers the apps can read directly', async () => {
    const service = makeService({ chalet: { ...pricingRow, targetOccupancyPercent: 0 } });
    const quote = await service.quote(CHALET_ID, slot, { now: local('08:00') });
    const breakdown = service.toBreakdown(quote);

    expect(breakdown.total).toEqual({ amount: 40_000, currency: 'ILS' });
    expect(breakdown.effectiveHourlyRate).toEqual({ amount: 10_000, currency: 'ILS' });
    expect(breakdown.durationMinutes).toBe(240);
    expect(breakdown.clampedToMinimum).toBe(false);
  });

  it('states every adjustment in both languages', async () => {
    const service = makeService();
    const quote = await service.quote(CHALET_ID, slot, { now: local('08:00') });
    const breakdown = service.toBreakdown(quote);

    expect(breakdown.adjustments.length).toBeGreaterThan(0);
    for (const adjustment of breakdown.adjustments) {
      expect(adjustment.label.length).toBeGreaterThan(0);
      expect(adjustment.labelAr.length).toBeGreaterThan(0);
    }
  });

  it('scales an hourly adjustment to the booking length', async () => {
    const service = makeService();
    const quote = await service.quote(CHALET_ID, slot, { now: local('08:00') });
    const breakdown = service.toBreakdown(quote);
    // The discount is quoted per hour; over four hours it is worth four times as much.
    const perHour = quote.adjustments.find((a) => a.code === 'LOW_OCCUPANCY');
    const scaled = breakdown.adjustments.find((a) => a.label === 'Quiet week');
    expect(scaled?.amount.amount).toBe(Number(perHour?.amountMinor) * 4);
  });

  it('carries the deposit through', async () => {
    const service = makeService({ chalet: { ...pricingRow, targetOccupancyPercent: 0 } });
    const quote = await service.quote(CHALET_ID, slot, { now: local('08:00') });
    expect(service.toBreakdown(quote, 5_000n).deposit).toEqual({ amount: 5_000, currency: 'ILS' });
  });
});

describe('ChaletPricingService.depositFor', () => {
  const service = makeService();

  it('asks for nothing when the chalet takes no deposit', () => {
    expect(
      service.depositFor(
        { depositType: 'NONE', depositAmountMinor: null, depositPercent: null },
        40_000n,
      ),
    ).toBe(0n);
  });

  it('asks for a fixed amount', () => {
    expect(
      service.depositFor(
        { depositType: 'FIXED', depositAmountMinor: 5_000n, depositPercent: null },
        40_000n,
      ),
    ).toBe(5_000n);
  });

  it('asks for a percentage of the booking', () => {
    expect(
      service.depositFor(
        { depositType: 'PERCENTAGE', depositAmountMinor: null, depositPercent: 25 },
        40_000n,
      ),
    ).toBe(10_000n);
  });
});
