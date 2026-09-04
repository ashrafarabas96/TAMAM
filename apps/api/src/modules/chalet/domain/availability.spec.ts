import {
  type BookingRules,
  type Occupancy,
  type OpeningHours,
  bookableSpanForDate,
  ceilToInterval,
  checkSlot,
  freeWindows,
  localDateOf,
  mergeIntervals,
  suggestStartTimes,
} from './availability';

const TZ = 'Asia/Jerusalem';

const hours: OpeningHours = { openingTime: '08:00', closingTime: '23:00', timeZone: TZ };

const rules: BookingRules = {
  bookingIntervalMinutes: 15,
  minimumBookingDurationMinutes: 120,
  maximumBookingDurationMinutes: 720,
  cleaningDurationMinutes: 90,
};

/** "2026-10-01 12:00" in the chalet's own zone, as an absolute instant. */
const local = (hhmm: string, date = '2026-10-01'): Date =>
  new Date(`${date}T${hhmm}:00+03:00`);

const booking = (from: string, to: string): Occupancy => ({
  kind: 'BOOKING',
  startAt: local(from),
  endAt: local(to),
});

const block = (from: string, to: string): Occupancy => ({
  kind: 'BLOCK',
  startAt: local(from),
  endAt: local(to),
});

describe('bookableSpanForDate', () => {
  it('turns local opening hours into absolute instants', () => {
    const span = bookableSpanForDate('2026-10-01', hours);
    expect(span.startAt.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect(span.endAt.toISOString()).toBe('2026-10-01T20:00:00.000Z');
  });

  it('carries a chalet that closes after midnight into the next day', () => {
    const span = bookableSpanForDate('2026-10-01', {
      ...hours,
      openingTime: '10:00',
      closingTime: '02:00',
    });
    expect(span.endAt.getTime() - span.startAt.getTime()).toBe(16 * 3_600_000);
  });

  it('keeps the day the same length across a daylight-saving change', () => {
    // Israel ends DST on 2026-10-25, so that local day has 25 hours. A chalet
    // open 08:00-23:00 is still open for fifteen of them.
    const span = bookableSpanForDate('2026-10-25', hours);
    expect(span.endAt.getTime() - span.startAt.getTime()).toBe(15 * 3_600_000);
  });

  it('reads back the local date of an instant', () => {
    expect(localDateOf(new Date('2026-10-01T20:30:00.000Z'), TZ)).toBe('2026-10-01');
    // 22:30 UTC is already the next day in Jerusalem.
    expect(localDateOf(new Date('2026-10-01T22:30:00.000Z'), TZ)).toBe('2026-10-02');
  });
});

describe('mergeIntervals', () => {
  it('joins overlapping and touching stretches', () => {
    const merged = mergeIntervals([
      { startAt: local('12:00'), endAt: local('14:00') },
      { startAt: local('13:00'), endAt: local('15:00') },
      { startAt: local('15:00'), endAt: local('16:00') },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.endAt).toEqual(local('16:00'));
  });

  it('drops empty intervals rather than emitting zero-length windows', () => {
    expect(mergeIntervals([{ startAt: local('12:00'), endAt: local('12:00') }])).toEqual([]);
  });

  it('leaves separate stretches apart', () => {
    expect(
      mergeIntervals([
        { startAt: local('12:00'), endAt: local('13:00') },
        { startAt: local('14:00'), endAt: local('15:00') },
      ]),
    ).toHaveLength(2);
  });
});

describe('freeWindows', () => {
  const span = bookableSpanForDate('2026-10-01', hours);

  it('returns the whole day when nothing is booked', () => {
    const windows = freeWindows(span, []);
    expect(windows).toHaveLength(1);
    expect(windows[0]?.availableMinutes).toBe(15 * 60);
    expect(windows[0]?.isGap).toBe(false);
  });

  it('splits the day around a booking and its cleaning', () => {
    // 12:00-16:00 booked, cleaning until 17:30.
    const windows = freeWindows(span, [
      { startAt: local('12:00'), endAt: local('17:30') },
    ]);
    expect(windows.map((w) => [w.startAt, w.endAt])).toEqual([
      [local('08:00'), local('12:00')],
      [local('17:30'), local('23:00')],
    ]);
  });

  it('marks a window boxed in by two bookings as a gap', () => {
    const windows = freeWindows(span, [
      { startAt: local('08:00'), endAt: local('12:00') },
      { startAt: local('15:00'), endAt: local('23:00') },
    ]);
    expect(windows).toHaveLength(1);
    expect(windows[0]?.isGap).toBe(true);
    expect(windows[0]?.availableMinutes).toBe(180);
  });

  it('does not call the open end of the day a gap', () => {
    const windows = freeWindows(span, [{ startAt: local('08:00'), endAt: local('12:00') }]);
    expect(windows[0]?.isGap).toBe(false);
  });

  it('returns nothing when the whole day is occupied', () => {
    expect(freeWindows(span, [{ startAt: local('06:00'), endAt: local('23:30') }])).toEqual([]);
  });

  it('ignores occupancies that fall outside the day', () => {
    const windows = freeWindows(span, [
      { startAt: local('12:00', '2026-10-02'), endAt: local('16:00', '2026-10-02') },
    ]);
    expect(windows).toHaveLength(1);
    expect(windows[0]?.availableMinutes).toBe(15 * 60);
  });
});

describe('ceilToInterval', () => {
  const anchor = local('08:00');

  it('leaves a time already on the grid alone', () => {
    expect(ceilToInterval(local('08:30'), anchor, 15)).toEqual(local('08:30'));
  });

  it('rounds up to the next step', () => {
    expect(ceilToInterval(local('08:31'), anchor, 15)).toEqual(local('08:45'));
  });

  it('anchors the grid to opening time, not the hour', () => {
    const odd = local('08:20');
    expect(ceilToInterval(local('08:25'), odd, 15)).toEqual(local('08:35'));
  });

  it('never returns a time before the anchor', () => {
    expect(ceilToInterval(local('06:00'), anchor, 15)).toEqual(anchor);
  });
});

describe('suggestStartTimes', () => {
  const span = bookableSpanForDate('2026-10-01', hours);

  it('offers the grid from opening time when the day is empty', () => {
    const starts = suggestStartTimes({ span, occupancies: [], rules, durationMinutes: 120 });
    expect(starts[0]).toEqual(local('08:00'));
    expect(starts[1]).toEqual(local('08:15'));
  });

  it('stops early enough for the booking itself to end by closing time', () => {
    const starts = suggestStartTimes({ span, occupancies: [], rules, durationMinutes: 120 });
    expect(starts[starts.length - 1]).toEqual(local('21:00'));
  });

  it('lets the cleaning run past closing time', () => {
    // 21:00-23:00 leaves cleaning until 00:30, which is fine: no one is waiting.
    const starts = suggestStartTimes({ span, occupancies: [], rules, durationMinutes: 120 });
    expect(starts).toContainEqual(local('21:00'));
  });

  it('never lets the cleaning run into the next booking', () => {
    // Booked 17:00 onwards. A 120-minute booking plus 90 of cleaning needs to be
    // finished by 17:00, so the last workable start is 13:30.
    const starts = suggestStartTimes({
      span,
      occupancies: [booking('17:00', '20:00')],
      rules,
      durationMinutes: 120,
    });
    const before = starts.filter((s) => s < local('17:00'));
    expect(before[before.length - 1]).toEqual(local('13:30'));
    expect(starts).not.toContainEqual(local('13:45'));
  });

  it('resumes on the grid once the occupancy ends', () => {
    const starts = suggestStartTimes({
      span,
      // 12:00-16:00 booked with cleaning to 17:30 — the caller adds the cleaning.
      occupancies: [booking('12:00', '17:30')],
      rules,
      durationMinutes: 120,
    });
    expect(starts).toContainEqual(local('17:30'));
    expect(starts).not.toContainEqual(local('17:15'));
    expect(starts).not.toContainEqual(local('16:00'));
  });

  it('offers nothing when the requested length does not fit anywhere', () => {
    const starts = suggestStartTimes({
      span,
      occupancies: [booking('08:00', '22:00')],
      rules,
      durationMinutes: 120,
    });
    expect(starts).toEqual([]);
  });

  it('refuses a duration outside the chalet bounds', () => {
    expect(
      suggestStartTimes({ span, occupancies: [], rules, durationMinutes: 60 }),
    ).toEqual([]);
    expect(
      suggestStartTimes({ span, occupancies: [], rules, durationMinutes: 900 }),
    ).toEqual([]);
  });

  it('hides times that have already passed today', () => {
    const starts = suggestStartTimes({
      span,
      occupancies: [],
      rules,
      durationMinutes: 120,
      notBefore: local('14:07'),
    });
    expect(starts[0]).toEqual(local('14:15'));
  });

  it('honours a 30-minute grid', () => {
    const starts = suggestStartTimes({
      span,
      occupancies: [],
      rules: { ...rules, bookingIntervalMinutes: 30, minimumBookingDurationMinutes: 60 },
      durationMinutes: 120,
    });
    expect(starts[1]).toEqual(local('08:30'));
    expect(starts).not.toContainEqual(local('08:15'));
  });
});

describe('checkSlot — the spec §11 cleaning buffer', () => {
  const span = bookableSpanForDate('2026-10-01', hours);
  // The booking in the spec: 12:00 to 16:00, cleaned until 17:30.
  const occupied = [booking('12:00', '17:30')];
  const twoHourRules = { ...rules, minimumBookingDurationMinutes: 60 };

  it('accepts the booking itself on an empty day', () => {
    expect(checkSlot({ startAt: local('12:00'), endAt: local('16:00') }, span, [], rules)).toEqual({
      available: true,
      reason: 'FREE',
    });
  });

  it('refuses a booking starting at 16:00, inside the cleaning window', () => {
    expect(
      checkSlot({ startAt: local('16:00'), endAt: local('18:00') }, span, occupied, twoHourRules),
    ).toEqual({ available: false, reason: 'OVERLAPS_BOOKING' });
  });

  it('refuses 17:15, still one quarter-hour short', () => {
    expect(
      checkSlot({ startAt: local('17:15'), endAt: local('19:15') }, span, occupied, twoHourRules)
        .available,
    ).toBe(false);
  });

  it('accepts 17:30, exactly when the cleaning ends', () => {
    expect(
      checkSlot({ startAt: local('17:30'), endAt: local('19:30') }, span, occupied, twoHourRules),
    ).toEqual({ available: true, reason: 'FREE' });
  });

  it('refuses a booking wholly inside another', () => {
    expect(
      checkSlot({ startAt: local('13:00'), endAt: local('14:00') }, span, occupied, twoHourRules)
        .reason,
    ).toBe('OVERLAPS_BOOKING');
  });

  it('says which kind of thing is in the way', () => {
    expect(
      checkSlot({ startAt: local('13:00'), endAt: local('15:00') }, span, [block('12:00', '16:00')], twoHourRules)
        .reason,
    ).toBe('OVERLAPS_BLOCK');
  });

  it('refuses a start that is off the grid', () => {
    expect(
      checkSlot({ startAt: local('12:05'), endAt: local('14:05') }, span, [], twoHourRules).reason,
    ).toBe('NOT_ON_INTERVAL');
  });

  it('refuses a booking that runs past closing time', () => {
    expect(
      checkSlot({ startAt: local('22:00'), endAt: local('23:30') }, span, [], twoHourRules).reason,
    ).toBe('OUTSIDE_HOURS');
  });

  it('refuses a booking that starts before opening', () => {
    expect(
      checkSlot({ startAt: local('07:00'), endAt: local('09:00') }, span, [], twoHourRules).reason,
    ).toBe('OUTSIDE_HOURS');
  });

  it('refuses a booking shorter than the chalet allows', () => {
    expect(
      checkSlot({ startAt: local('12:00'), endAt: local('13:00') }, span, [], rules).reason,
    ).toBe('DURATION_OUT_OF_BOUNDS');
  });

  it('refuses a booking longer than the chalet allows', () => {
    expect(
      checkSlot({ startAt: local('08:00'), endAt: local('21:00') }, span, [], rules).reason,
    ).toBe('DURATION_OUT_OF_BOUNDS');
  });

  it('allows a booking whose cleaning runs past closing', () => {
    expect(
      checkSlot({ startAt: local('21:00'), endAt: local('23:00') }, span, [], rules).available,
    ).toBe(true);
  });
});

describe('a chalet with no cleaning time', () => {
  const span = bookableSpanForDate('2026-10-01', hours);
  const noCleaning = { ...rules, cleaningDurationMinutes: 0, minimumBookingDurationMinutes: 60 };

  it('lets one booking start exactly when the last ends', () => {
    expect(
      checkSlot(
        { startAt: local('16:00'), endAt: local('18:00') },
        span,
        [booking('12:00', '16:00')],
        noCleaning,
      ),
    ).toEqual({ available: true, reason: 'FREE' });
  });

  it('still refuses a start one minute earlier', () => {
    expect(
      checkSlot(
        { startAt: local('15:45'), endAt: local('17:45') },
        span,
        [booking('12:00', '16:00')],
        noCleaning,
      ).available,
    ).toBe(false);
  });
});
