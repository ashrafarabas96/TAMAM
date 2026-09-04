import type { FreeWindow } from './availability';
import {
  DEFAULT_GAP_SETTINGS,
  type GapFillerSettings,
  gapDiscountPercent,
  offeredRate,
  offersForGaps,
  offersForLastMinute,
} from './gap-filler';

const local = (hhmm: string, date = '2026-10-01'): Date => new Date(`${date}T${hhmm}:00+03:00`);

const window = (from: string, to: string, isGap: boolean): FreeWindow => ({
  startAt: local(from),
  endAt: local(to),
  availableMinutes: Math.round((local(to).getTime() - local(from).getTime()) / 60_000),
  isGap,
});

const settings: GapFillerSettings = DEFAULT_GAP_SETTINGS;

describe('gapDiscountPercent', () => {
  it('cuts deepest when the gap barely fits the minimum booking', () => {
    const tight = gapDiscountPercent(120, settings);
    const roomy = gapDiscountPercent(400, settings);
    expect(tight).toBeGreaterThan(roomy);
  });

  it('never exceeds the owner’s own maximum', () => {
    for (const minutes of [120, 150, 200, 300, 600, 1_000]) {
      expect(gapDiscountPercent(minutes, settings)).toBeLessThanOrEqual(
        settings.maximumDiscountPercent,
      );
    }
  });

  it('offers nothing on a gap too short to book', () => {
    expect(gapDiscountPercent(60, settings)).toBe(0);
  });

  it('follows a stricter owner maximum', () => {
    const strict = { ...settings, maximumDiscountPercent: 5 };
    expect(gapDiscountPercent(120, strict)).toBeLessThanOrEqual(5);
  });
});

describe('offersForGaps', () => {
  const now = local('06:00');

  it('offers a gap boxed in between two bookings', () => {
    const offers = offersForGaps([window('12:00', '16:00', true)], settings, now);
    expect(offers).toHaveLength(1);
    expect(offers[0]?.kind).toBe('GAP_FILLER');
    expect(offers[0]?.title.ar).toBe('فرصة بين حجزين — سعر مخفّض');
  });

  it('ignores the open end of the day, which the owner can already see', () => {
    expect(offersForGaps([window('17:00', '23:00', false)], settings, now)).toEqual([]);
  });

  it('skips a gap nobody could book anyway', () => {
    expect(offersForGaps([window('12:00', '13:00', true)], settings, now)).toEqual([]);
  });

  it('closes the offer before the slot starts', () => {
    const offers = offersForGaps([window('12:00', '16:00', true)], settings, now);
    expect(offers[0]?.expiresAt).toEqual(local('11:30'));
  });

  it('does not advertise a slot that can no longer be booked', () => {
    expect(offersForGaps([window('12:00', '16:00', true)], settings, local('11:45'))).toEqual([]);
  });

  it('offers each gap in a day separately', () => {
    const offers = offersForGaps(
      [window('10:00', '13:00', true), window('16:00', '20:00', true)],
      settings,
      now,
    );
    expect(offers).toHaveLength(2);
  });
});

describe('offersForLastMinute', () => {
  it('offers an empty window starting soon', () => {
    const offers = offersForLastMinute([window('14:00', '20:00', false)], settings, local('12:00'));
    expect(offers).toHaveLength(1);
    expect(offers[0]?.kind).toBe('LAST_MINUTE');
  });

  it('leaves a window far in the future alone', () => {
    expect(
      offersForLastMinute([window('20:00', '23:00', false)], settings, local('06:00')),
    ).toEqual([]);
  });

  it('does not double up on a gap the gap filler already handled', () => {
    expect(offersForLastMinute([window('14:00', '20:00', true)], settings, local('12:00'))).toEqual(
      [],
    );
  });

  it('starts the offer now when the window is already under way', () => {
    const offers = offersForLastMinute([window('11:00', '20:00', false)], settings, local('12:00'));
    expect(offers[0]?.slotStartAt).toEqual(local('12:00'));
  });

  it('drops a window with no room left for a minimum booking', () => {
    expect(
      offersForLastMinute([window('11:00', '13:00', false)], settings, local('12:00')),
    ).toEqual([]);
  });

  it('calls an early-morning window a morning offer', () => {
    // 08:00 local is 05:00 UTC, which is before the 09:00 UTC threshold.
    const offers = offersForLastMinute([window('08:00', '14:00', false)], settings, local('06:00'));
    expect(offers[0]?.kind).toBe('MORNING_SPECIAL');
    expect(offers[0]?.title.ar).toBe('عرض الصباح');
  });
});

describe('offeredRate', () => {
  it('advertises the discount when the floor allows it', () => {
    expect(offeredRate(10_000n, 6_000n, 25)).toEqual({
      hourlyRateMinor: 7_500n,
      discountPercent: 25,
    });
  });

  it('stops at the floor rather than advertising below it', () => {
    expect(offeredRate(10_000n, 9_000n, 25).hourlyRateMinor).toBe(9_000n);
  });

  it('restates the discount to match the price actually offered', () => {
    // Advertising 25% off and charging 10% off at checkout is worse than
    // advertising 10% honestly.
    expect(offeredRate(10_000n, 9_000n, 25).discountPercent).toBe(10);
  });

  it('advertises nothing when the floor is the base rate', () => {
    expect(offeredRate(10_000n, 10_000n, 25)).toEqual({
      hourlyRateMinor: 10_000n,
      discountPercent: 0,
    });
  });

  it('never advertises a negative discount', () => {
    expect(offeredRate(10_000n, 12_000n, 25).discountPercent).toBe(0);
  });
});
