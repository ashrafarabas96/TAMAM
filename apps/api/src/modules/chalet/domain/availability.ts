import { fromZonedTime, toZonedTime } from 'date-fns-tz';

/**
 * The availability engine: given what already occupies a chalet, work out what
 * a customer can still book.
 *
 * One rule shapes everything here. A booking occupies its own window *plus* the
 * cleaning that follows it, so the interval another booking has to avoid is
 * [startAt, endAt + cleaning). The database enforces exactly that; this module
 * computes the same thing ahead of time so the customer is never offered a slot
 * that the database will then refuse.
 *
 * Cleaning is allowed to run past closing time — the staff can tidy up after the
 * chalet stops taking bookings — but it is never allowed to run into the next
 * booking. Those are two different constraints and the code keeps them separate:
 * the booking must fit inside the day's bookable span, while the booking *plus*
 * its cleaning must avoid every occupancy.
 *
 * Everything is pure. No clock, no database, no timezone guessing beyond the one
 * passed in.
 */

/** A half-open interval [startAt, endAt). Both instants are absolute (UTC). */
export interface Interval {
  startAt: Date;
  endAt: Date;
}

/**
 * Something that already occupies the calendar: another booking (with its
 * cleaning already added by the caller), an owner block, or maintenance.
 */
export interface Occupancy extends Interval {
  kind: 'BOOKING' | 'BLOCK';
}

export interface OpeningHours {
  /** "HH:mm" local to the chalet. */
  openingTime: string;
  /** "HH:mm" local. Earlier than openingTime means the day runs past midnight. */
  closingTime: string;
  /** IANA zone the two strings above are written in. */
  timeZone: string;
}

export interface BookingRules {
  /** The grid every start time sits on, in minutes. */
  bookingIntervalMinutes: number;
  minimumBookingDurationMinutes: number;
  maximumBookingDurationMinutes: number;
  /** Added after the booking; part of what the slot occupies. */
  cleaningDurationMinutes: number;
}

/** A window a customer can book inside. */
export interface FreeWindow extends Interval {
  availableMinutes: number;
  /**
   * True when the window has an occupancy on both sides — the empty afternoon
   * between two bookings that the gap filler exists to sell.
   */
  isGap: boolean;
}

const MINUTE = 60_000;

export const minutesBetween = (a: Date, b: Date): number =>
  Math.round((b.getTime() - a.getTime()) / MINUTE);

export const plusMinutes = (d: Date, m: number): Date => new Date(d.getTime() + m * MINUTE);

/* ------------------------------------------------------------ the day span */

function parseHhmm(value: string): { hours: number; minutes: number } {
  const [h, m] = value.split(':');
  const hours = Number(h);
  const minutes = Number(m);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    throw new Error(`Invalid HH:mm value: ${value}`);
  }
  return { hours, minutes };
}

/**
 * Turn "2026-10-01" plus the chalet's opening hours into the absolute instants
 * the day starts and stops taking bookings.
 *
 * Closing earlier than opening means the chalet runs past midnight (08:00 to
 * 02:00), so the close lands on the following calendar day. Going through the
 * timezone rather than arithmetic matters on the two days a year the offset
 * changes: a chalet open 08:00-23:00 is open fifteen hours on both of them.
 */
export function bookableSpanForDate(date: string, hours: OpeningHours): Interval {
  const open = parseHhmm(hours.openingTime);
  const close = parseHhmm(hours.closingTime);
  const crossesMidnight =
    close.hours < open.hours || (close.hours === open.hours && close.minutes <= open.minutes);

  const startAt = fromZonedTime(`${date}T${hours.openingTime}:00`, hours.timeZone);
  const closeDate = crossesMidnight ? nextCalendarDay(date) : date;
  const endAt = fromZonedTime(`${closeDate}T${hours.closingTime}:00`, hours.timeZone);
  return { startAt, endAt };
}

function nextCalendarDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`Invalid date: ${date}`);
  }
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

/** The calendar date an instant falls on, in the chalet's own zone. */
export function localDateOf(at: Date, timeZone: string): string {
  const zoned = toZonedTime(at, timeZone);
  const y = zoned.getFullYear();
  const m = String(zoned.getMonth() + 1).padStart(2, '0');
  const d = String(zoned.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* ------------------------------------------------------------ free windows */

export const overlaps = (a: Interval, b: Interval): boolean =>
  a.startAt < b.endAt && b.startAt < a.endAt;

/**
 * Collapse overlapping and touching intervals into the fewest that cover the
 * same time. Two bookings back to back become one occupied stretch, so the
 * subtraction below never produces a zero-length window between them.
 */
export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = [...intervals]
    .filter((i) => i.endAt > i.startAt)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  const merged: Interval[] = [];
  for (const current of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && current.startAt <= last.endAt) {
      if (current.endAt > last.endAt) last.endAt = current.endAt;
      continue;
    }
    merged.push({ startAt: current.startAt, endAt: current.endAt });
  }
  return merged;
}

/**
 * The windows inside `span` that nothing occupies.
 *
 * A window is marked as a gap when an occupancy sits on both sides of it, which
 * is the shape the gap filler looks for: an empty stretch that is hard to sell
 * because it is boxed in, rather than the open end of the day.
 */
export function freeWindows(span: Interval, occupancies: readonly Interval[]): FreeWindow[] {
  const blocking = mergeIntervals(occupancies).filter((o) => overlaps(o, span));
  const windows: FreeWindow[] = [];

  let cursor = span.startAt;
  for (const [index, occupied] of blocking.entries()) {
    const gapEnd = occupied.startAt < span.endAt ? occupied.startAt : span.endAt;
    if (gapEnd > cursor) {
      windows.push(makeWindow(cursor, gapEnd, index > 0, true));
    }
    if (occupied.endAt > cursor) cursor = occupied.endAt;
  }
  if (cursor < span.endAt) {
    windows.push(makeWindow(cursor, span.endAt, blocking.length > 0, false));
  }
  return windows;
}

function makeWindow(
  startAt: Date,
  endAt: Date,
  occupiedBefore: boolean,
  occupiedAfter: boolean,
): FreeWindow {
  return {
    startAt,
    endAt,
    availableMinutes: minutesBetween(startAt, endAt),
    isGap: occupiedBefore && occupiedAfter,
  };
}

/* ----------------------------------------------------------- start times */

/**
 * Round an instant up to the next point on the chalet's booking grid.
 *
 * The grid is anchored to the day's opening time rather than to the hour, so a
 * chalet that opens at 08:20 on a 15-minute interval offers 08:20, 08:35, 08:50
 * — not 08:30. Anchoring to the hour would make the first slot unreachable.
 */
export function ceilToInterval(at: Date, anchor: Date, intervalMinutes: number): Date {
  if (intervalMinutes <= 0) throw new Error('bookingIntervalMinutes must be positive');
  const elapsed = at.getTime() - anchor.getTime();
  if (elapsed <= 0) return anchor;
  const step = intervalMinutes * MINUTE;
  return new Date(anchor.getTime() + Math.ceil(elapsed / step) * step);
}

export const isOnInterval = (at: Date, anchor: Date, intervalMinutes: number): boolean =>
  (at.getTime() - anchor.getTime()) % (intervalMinutes * MINUTE) === 0;

export interface StartTimeOptions {
  span: Interval;
  occupancies: readonly Occupancy[];
  rules: BookingRules;
  durationMinutes: number;
  /** Nothing before this is offered; the caller passes "now" for today. */
  notBefore?: Date;
  /** Guards against returning a whole day of 15-minute steps. */
  limit?: number;
}

/**
 * Every start time on the grid where a booking of this length actually fits.
 *
 * The two constraints are checked separately, because they are different: the
 * booking itself has to end by closing time, while the booking plus its cleaning
 * has to stay clear of everything else on the calendar. Cleaning after the last
 * booking of the day may run past closing — that is the staff's time, not a
 * customer's.
 */
export function suggestStartTimes(options: StartTimeOptions): Date[] {
  const { span, occupancies, rules, durationMinutes } = options;
  const limit = options.limit ?? 96;
  if (durationMinutes < rules.minimumBookingDurationMinutes) return [];
  if (durationMinutes > rules.maximumBookingDurationMinutes) return [];

  const occupied = mergeIntervals(occupancies);
  const earliest =
    options.notBefore !== undefined && options.notBefore > span.startAt
      ? options.notBefore
      : span.startAt;

  const results: Date[] = [];
  let candidate = ceilToInterval(earliest, span.startAt, rules.bookingIntervalMinutes);

  while (results.length < limit) {
    const bookingEnd = plusMinutes(candidate, durationMinutes);
    if (bookingEnd > span.endAt) break;

    const claimed = {
      startAt: candidate,
      endAt: plusMinutes(bookingEnd, rules.cleaningDurationMinutes),
    };
    const conflict = occupied.find((o) => overlaps(o, claimed));
    if (conflict === undefined) {
      results.push(candidate);
      candidate = plusMinutes(candidate, rules.bookingIntervalMinutes);
      continue;
    }

    // Nothing before the conflict ends can work either, so skip straight there
    // instead of stepping through the occupied stretch one interval at a time.
    candidate = ceilToInterval(conflict.endAt, span.startAt, rules.bookingIntervalMinutes);
  }
  return results;
}

/* -------------------------------------------------------------- one slot */

export type SlotRejection =
  | 'FREE'
  | 'OVERLAPS_BOOKING'
  | 'OVERLAPS_BLOCK'
  | 'OUTSIDE_HOURS'
  | 'DURATION_OUT_OF_BOUNDS'
  | 'NOT_ON_INTERVAL';

export interface SlotCheck {
  available: boolean;
  reason: SlotRejection;
}

/**
 * Whether one exact window can be booked, and if not, which rule stopped it.
 *
 * This answer is advisory. Between this check and the write, someone else may
 * take the slot; the database is what finally decides. Checking here is about
 * telling the customer *why* — "that is inside another booking's cleaning time"
 * is a better answer than a failed write.
 */
export function checkSlot(
  requested: Interval,
  span: Interval,
  occupancies: readonly Occupancy[],
  rules: BookingRules,
): SlotCheck {
  const durationMinutes = minutesBetween(requested.startAt, requested.endAt);
  if (
    durationMinutes < rules.minimumBookingDurationMinutes ||
    durationMinutes > rules.maximumBookingDurationMinutes
  ) {
    return { available: false, reason: 'DURATION_OUT_OF_BOUNDS' };
  }
  if (requested.startAt < span.startAt || requested.endAt > span.endAt) {
    return { available: false, reason: 'OUTSIDE_HOURS' };
  }
  if (!isOnInterval(requested.startAt, span.startAt, rules.bookingIntervalMinutes)) {
    return { available: false, reason: 'NOT_ON_INTERVAL' };
  }

  const claimed = {
    startAt: requested.startAt,
    endAt: plusMinutes(requested.endAt, rules.cleaningDurationMinutes),
  };
  const conflict = occupancies.find((o) => overlaps(o, claimed));
  if (conflict !== undefined) {
    return {
      available: false,
      reason: conflict.kind === 'BLOCK' ? 'OVERLAPS_BLOCK' : 'OVERLAPS_BOOKING',
    };
  }
  return { available: true, reason: 'FREE' };
}

/**
 * The windows a booking of `durationMinutes` could actually start in, given the
 * cleaning that would follow it. Used to answer "when could I come instead?"
 * after a slot check fails.
 */
export function bookableWindows(
  span: Interval,
  occupancies: readonly Occupancy[],
  rules: BookingRules,
  durationMinutes: number,
  notBefore?: Date,
): FreeWindow[] {
  const starts = suggestStartTimes({ span, occupancies, rules, durationMinutes, notBefore });
  return starts.map((startAt) => {
    const endAt = plusMinutes(startAt, durationMinutes);
    return { startAt, endAt, availableMinutes: durationMinutes, isGap: false };
  });
}
